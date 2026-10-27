// Lote 2, correção 04 — perfil Engenheiro e documentos do usuário (Postgres real; rode com TEST_DATABASE_URL).
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

let sessaoId = "";
vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: async () => (sessaoId ? { user: { id: sessaoId } } : null) }));
// Mesmo padrão dos outros testes de banco: usuário da sessão lido do banco a cada chamada.
vi.mock("@/lib/auth/modulos", async (original) => {
  const real = await original<typeof import("@/lib/auth/modulos")>();
  const atual = async () => {
    if (!sessaoId) return null;
    const { prisma } = await import("@/lib/db");
    const u = await prisma.usuario.findUnique({ where: { id: sessaoId } });
    return u ? { id: u.id, nome: u.nome, perfil: u.papel, ativo: u.ativo, permissoes: JSON.parse(u.permissoes), corretorId: null } : null;
  };
  const guardas = real.criarGuardas(atual);
  return { ...real, ...guardas, usuarioAtual: atual };
});
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/email", () => ({ sendEmail: async () => false }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;${url}` }); } }));
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

describe.skipIf(!url)("correção 04 — perfil Engenheiro", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let acoes: typeof import("@/lib/actions/engenheiro");
  let usuarios: typeof import("@/lib/actions/usuarios");
  let listarEngenheiros: typeof import("@/lib/engenheiros").listarEngenheiros;
  let envio: typeof import("@/app/api/usuarios/[id]/documentos/route");
  let leitura: typeof import("@/app/api/usuarios/[id]/documentos/[documentoId]/route");
  const sufixo = Math.random().toString(36).slice(2, 8);
  const ids = { admin: "", outro: "", eng: "" };

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    acoes = await import("@/lib/actions/engenheiro");
    usuarios = await import("@/lib/actions/usuarios");
    ({ listarEngenheiros } = await import("@/lib/engenheiros"));
    envio = await import("@/app/api/usuarios/[id]/documentos/route");
    leitura = await import("@/app/api/usuarios/[id]/documentos/[documentoId]/route");
    ids.admin = (await prisma.usuario.create({ data: { nome: "Admin Eng", email: `admin-eng-${sufixo}@teste.local`, senha: "x", papel: "admin" } })).id;
    ids.outro = (await prisma.usuario.create({ data: { nome: "Outro Colab", email: `outro-eng-${sufixo}@teste.local`, senha: "x", papel: "colaborador" } })).id;
    sessaoId = ids.admin;
  });
  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { id: { in: [ids.admin, ids.outro, ids.eng].filter(Boolean) } } });
    await prisma.$disconnect();
  });

  it("cadastro como Engenheiro = colaborador + perfil com CREA; listarEngenheiros traz o CREA", async () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries({ nome: "Eng Teste", email: `eng-${sufixo}@teste.local`, papel: "engenheiro", senha: "senha-forte-1", telefone: "(62) 99999-0000", crea: "12345/D", creaUf: "GO" })) fd.append(k, v);
    fd.append("permissoes", "projetos");
    expect(await usuarios.criarUsuario(fd)).toEqual({ success: true });
    const u = await prisma.usuario.findUniqueOrThrow({ where: { email: `eng-${sufixo}@teste.local` }, include: { perfilEngenheiro: true } });
    ids.eng = u.id;
    expect(u.papel).toBe("colaborador");
    expect(JSON.parse(u.permissoes)).toEqual(["projetos"]);
    expect(u.perfilEngenheiro).toMatchObject({ ativo: true, crea: "12345/D", creaUf: "GO" });
    const lista = await listarEngenheiros();
    expect(lista.find((e) => e.id === ids.eng)).toMatchObject({ engenheiro: true, crea: "12345/D", creaUf: "GO", telefone: "(62) 99999-0000", email: `eng-${sufixo}@teste.local` });
    expect(lista.find((e) => e.id === ids.outro)).toMatchObject({ engenheiro: false, crea: null });
    expect((await listarEngenheiros({ apenasEngenheiros: true })).some((e) => e.id === ids.outro)).toBe(false);
  });

  it("salvar perfil valida CREA/UF e grava endereço + CREAs adicionais", async () => {
    expect(await acoes.salvarPerfilEngenheiro(ids.eng, { crea: "123456", creaUf: "GO", creasAdicionais: [{ numero: "999", uf: "GO" }] })).toEqual({ erro: "O CREA adicional deve ser de outro estado (o principal já é GO)." });
    expect(await acoes.salvarPerfilEngenheiro(ids.eng, { cep: "74000000", logradouro: "Rua A", numero: "10", bairro: "Centro", cidade: "Goiânia", uf: "GO", crea: "123456", creaUf: "GO", creasAdicionais: [{ numero: "777777", uf: "DF" }] })).toEqual({ ok: true });
    const r = await acoes.obterPerfilEngenheiro(ids.eng);
    expect("erro" in r).toBe(false);
    if ("erro" in r) return;
    expect(r.perfil).toMatchObject({ cep: "74000-000", crea: "123456", creasAdicionais: [{ numero: "777777", uf: "DF" }] });
    expect(r.podeGerenciar).toBe(true);
  });

  const pdf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(1024 * 1024 + 500, 7)]); // 2 partes
  const chamarEnvio = (corpo: Record<string, unknown>) => envio.POST(new NextRequest("http://x/api", { method: "POST", body: JSON.stringify(corpo), headers: { "content-type": "application/json" } }), { params: Promise.resolve({ id: ids.eng }) });
  async function enviarPdf(nome: string, substituirId?: string) {
    const uploadId = crypto.randomUUID();
    const partes = [pdf.subarray(0, 1024 * 1024), pdf.subarray(1024 * 1024)];
    for (const [parte, b] of partes.entries()) expect((await chamarEnvio({ acao: "parte", categoria: "anuidade_crea", uploadId, parte, total: 2, nome, chunk: b.toString("base64") })).status).toBe(200);
    return chamarEnvio({ acao: "finalizar", categoria: "anuidade_crea", uploadId, substituirId });
  }
  const ler = (docId: string, query = "") => leitura.GET(new NextRequest(`http://x/api${query}`), { params: Promise.resolve({ id: ids.eng, documentoId: docId }) });

  it("envio em partes, download em partes com o original e o nome original; acesso restrito", async () => {
    const r = await enviarPdf("Anuidade 2026.pdf");
    expect(r.status).toBe(200);
    const { id } = (await r.json()) as { id: string };
    const p1 = await ler(id, "?offset=0");
    expect(p1.headers.get("X-Document-Size")).toBe(String(pdf.length));
    expect(p1.headers.get("Content-Disposition")).toContain("filename*=UTF-8''Anuidade%202026.pdf");
    const b1 = Buffer.from(await p1.arrayBuffer());
    const b2 = Buffer.from(await (await ler(id, `?offset=${b1.length}`)).arrayBuffer());
    expect(Buffer.concat([b1, b2]).equals(pdf)).toBe(true);
    const inteiro = await ler(id);
    expect(inteiro.headers.get("Content-Type")).toBe("application/pdf");
    expect(Buffer.from(await inteiro.arrayBuffer()).equals(pdf)).toBe(true);

    sessaoId = ids.outro; // outro colaborador: não vê nem envia
    expect((await ler(id, "?offset=0")).status).toBe(404);
    expect((await chamarEnvio({ acao: "finalizar", categoria: "outros", uploadId: crypto.randomUUID() })).status).toBe(403);
    sessaoId = ids.eng; // o próprio engenheiro: consulta, não gerencia
    expect((await ler(id, "?offset=0")).status).toBe(200);
    expect((await chamarEnvio({ acao: "finalizar", categoria: "outros", uploadId: crypto.randomUUID() })).status).toBe(403);
    expect(await acoes.excluirDocumentoUsuario(ids.eng, id)).toEqual({ erro: "Sem permissão para os dados deste usuário." });
    sessaoId = ids.admin;

    expect((await enviarPdf("Anuidade 2027.pdf", id)).status).toBe(200);
    expect(await prisma.documentoUsuario.findUniqueOrThrow({ where: { id }, select: { nomeOriginal: true } })).toEqual({ nomeOriginal: "Anuidade 2027.pdf" });
    expect(await acoes.excluirDocumentoUsuario(ids.eng, id)).toEqual({ ok: true });
    expect(await prisma.documentoUsuario.count({ where: { usuarioId: ids.eng } })).toBe(0);
  });

  it("trocar para Colaborador desliga o perfil sem perder o CREA; voltar a Engenheiro reativa", async () => {
    expect(await usuarios.alterarPerfilUsuario(ids.eng, "colaborador")).toEqual({ success: true });
    expect(await prisma.perfilEngenheiro.findUniqueOrThrow({ where: { usuarioId: ids.eng } })).toMatchObject({ ativo: false, crea: "123456" });
    expect((await listarEngenheiros()).find((e) => e.id === ids.eng)).toMatchObject({ engenheiro: false, crea: null });
    expect(await usuarios.alterarPerfilUsuario(ids.eng, "engenheiro")).toEqual({ success: true });
    expect((await listarEngenheiros({ apenasEngenheiros: true })).find((e) => e.id === ids.eng)).toMatchObject({ crea: "123456", creaUf: "GO" });
  });
});
