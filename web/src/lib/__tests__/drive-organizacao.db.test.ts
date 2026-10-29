// Pedido de 29/10 (SPEC-DRIVE-ORGANIZACAO.md) — organização completa do Google Drive,
// com banco real e o Drive simulado em memória (nenhuma chamada ao Google).
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { criarDriveFake } from "./drive-fake";
import { dataArquivo } from "@/lib/drive-estrutura";

let sessaoId = "";
vi.setConfig({ testTimeout: 90_000, hookTimeout: 60_000 });
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendEmail: async () => false }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "www.gruposantafee.com.br" }) }));
vi.mock("@/auth", () => ({ auth: async () => (sessaoId ? { user: { id: sessaoId, role: "admin" } } : null) }));
vi.mock("@/lib/auth/modulos", async (original) => {
  const real = await original<typeof import("@/lib/auth/modulos")>();
  const atual = async () => {
    if (!sessaoId) return null;
    const { prisma } = await import("@/lib/db");
    const u = await prisma.usuario.findUnique({ where: { id: sessaoId } });
    return u ? { id: u.id, nome: u.nome, perfil: u.papel, ativo: u.ativo, permissoes: JSON.parse(u.permissoes), corretorId: null } : null;
  };
  return { ...real, ...real.criarGuardas(atual), usuarioAtual: atual };
});
vi.mock("@/lib/crm/acesso-lead", async (original) => ({
  ...await original<typeof import("@/lib/crm/acesso-lead")>(),
  obterAtorCrm: async () => ({ id: sessaoId, nome: "Admin", papel: "admin", corretorId: null }),
}));
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;
process.env.AUTH_SECRET ||= "segredo-de-teste";

const JSON_WEB = JSON.stringify({ web: { client_id: "123-abc.apps.googleusercontent.com", client_secret: "GOCSPX-s", redirect_uris: ["https://www.gruposantafee.com.br/api/google-drive/callback"] } });
const PASTA = "application/vnd.google-apps.folder";
const hoje = dataArquivo(new Date());
const curto = (id: string) => id.slice(-6).toUpperCase();

describe.skipIf(!url)("Drive: organização completa (banco real, Drive simulado)", () => {
  const drive = criarDriveFake();
  let prisma: typeof import("@/lib/db").prisma;
  let org: typeof import("@/lib/drive-organizacao");
  let raiz = "";
  const sufixo = Math.random().toString(36).slice(2, 8);
  const ids = { admin: "", eng: "" };
  /** Pasta do sistema com etiqueta (como o sistema cria). */
  const pastaSistema = (chave: string, nome: string, pai: string) => drive.novo({ name: nome, mimeType: PASTA, parents: [pai], appProperties: { pastaSistema: chave } });
  const pastaDe = (chave: string) => drive.filtrar("trashed = false").find((a) => a.appProperties?.pastaSistema === chave)?.id ?? null;
  let clientes = "";

  beforeAll(async () => {
    vi.stubGlobal("fetch", drive.fetchFake);
    ({ prisma } = await import("@/lib/db"));
    org = await import("@/lib/drive-organizacao");
    const acoes = await import("@/lib/actions/google-drive");
    const conexao = await import("@/lib/google-drive-conexao");
    ids.admin = (await prisma.usuario.create({ data: { nome: "Admin Drive", email: `admin-drive-${sufixo}@teste.local`, senha: "x", papel: "admin" } })).id;
    ids.eng = (await prisma.usuario.create({ data: { nome: "Engenheira Drive", email: `eng-drive-${sufixo}@teste.local`, senha: "x", papel: "colaborador" } })).id;
    sessaoId = ids.admin;
    await prisma.googleDriveOauth.deleteMany();
    await acoes.salvarCredencialGoogleDrive(JSON_WEB);
    await conexao.concluirConexao("codigo", "https://www.gruposantafee.com.br", ids.admin);
    raiz = (await prisma.googleDriveOauth.findUnique({ where: { id: 1 } }))!.rootFolderId!;
    drive.arquivos.get(raiz)!.appProperties = { pastaSistema: "raiz" }; // sem reorganização legada neste teste
    // IDs deste Drive simulado ("f1", "f2"…) não podem colidir com referências de outros testes.
    const p = `outro-${Date.now()}-`;
    for (const tabela of ["arquivos", "estudo_documentos_registro", "imovel_fotos", "documentos_usuario", "pci_modelos", "obra_pci_versoes", "whatsapp_midias"])
      await prisma.$executeRawUnsafe(`UPDATE ${tabela} SET "driveFileId" = $1 || "driveFileId" WHERE "driveFileId" ~ '^f[0-9]+$'`, p);
    await prisma.$executeRawUnsafe(`UPDATE pci_geradas SET "planilhaDriveFileId" = $1 || "planilhaDriveFileId", "pdfDriveFileId" = $1 || "pdfDriveFileId" WHERE "planilhaDriveFileId" ~ '^f[0-9]+$' OR "pdfDriveFileId" ~ '^f[0-9]+$'`, p);
    clientes = pastaSistema("clientes", "Clientes", raiz);
  });
  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { id: { in: Object.values(ids).filter(Boolean) } } });
    vi.unstubAllGlobals();
    await prisma.$disconnect();
  });

  it("documento do engenheiro enviado no cadastro vai para Equipe/<Nome (nº)>/<Categoria>; excluir manda para a lixeira", async () => {
    const envio = await import("@/app/api/usuarios/[id]/documentos/route");
    const chamar = (corpo: Record<string, unknown>) => envio.POST(new NextRequest("http://x/api", { method: "POST", body: JSON.stringify(corpo), headers: { "content-type": "application/json" } }), { params: Promise.resolve({ id: ids.eng }) });
    const pdf = Buffer.from("%PDF-1.4\nanuidade");
    const uploadId = crypto.randomUUID();
    expect((await chamar({ acao: "parte", categoria: "anuidade_crea", uploadId, parte: 0, total: 1, nome: "boleto.pdf", chunk: pdf.toString("base64") })).status).toBe(200);
    const r = await chamar({ acao: "finalizar", categoria: "anuidade_crea", uploadId });
    expect(r.status).toBe(200);
    const { id } = (await r.json()) as { id: string };
    const doc = await prisma.documentoUsuario.findUniqueOrThrow({ where: { id } });
    expect(doc.driveFileId).toBeTruthy();
    expect(drive.caminho(doc.driveFileId!, raiz)).toBe(`Equipe/Engenheira Drive (nº ${curto(ids.eng)})/Anuidade CREA/Anuidade CREA — ${hoje}.pdf`);
    expect(drive.arquivos.get(doc.driveFileId!)!.dados!.toString()).toBe(pdf.toString());
    expect(doc.conteudo).not.toBeNull(); // o banco continua servindo o app

    const acoes = await import("@/lib/actions/engenheiro");
    expect(await acoes.excluirDocumentoUsuario(ids.eng, id)).toEqual({ ok: true });
    expect(drive.arquivos.get(doc.driveFileId!)!.trashed).toBe(true);
  });

  it("sincronizador: envia o que está só no banco, ignora o que já foi, respeita o lote e o prazo", async () => {
    const pendente = await prisma.documentoUsuario.create({ data: { usuarioId: ids.eng, categoria: "documento_pessoal", nomeOriginal: "rg.png", mime: "image/png", tamanho: 4, conteudo: new Uint8Array([137, 80, 78, 71]) } });
    const jaEnviado = drive.novo({ name: "x.pdf", mimeType: "application/pdf", parents: [raiz] });
    const enviado = await prisma.documentoUsuario.create({ data: { usuarioId: ids.eng, categoria: "outros", nomeOriginal: "a.pdf", mime: "application/pdf", tamanho: 4, conteudo: new Uint8Array([1, 2, 3, 4]), driveFileId: jaEnviado } });

    // Prazo zero: nada é processado e o ciclo continua na próxima execução.
    const parado = await org.sincronizarDrive({ prazoMs: 0 });
    expect(parado).toMatchObject({ enviados: 0, cicloConcluido: false });
    expect((await prisma.documentoUsuario.findUniqueOrThrow({ where: { id: pendente.id } })).driveFileId).toBeNull();

    const consulta = vi.spyOn(prisma.documentoUsuario, "findMany");
    const r = await org.sincronizarDrive({ prazoMs: 30_000, lote: 1 });
    expect(r.cicloConcluido).toBe(true);
    expect(r.falhas).toBe(0);
    expect(consulta.mock.calls.every(([a]) => a?.take === 1)).toBe(true);
    consulta.mockRestore();

    const doc = await prisma.documentoUsuario.findUniqueOrThrow({ where: { id: pendente.id } });
    expect(drive.caminho(doc.driveFileId!, raiz)).toBe(`Equipe/Engenheira Drive (nº ${curto(ids.eng)})/Documento pessoal/Documento pessoal — ${hoje}.png`);
    expect((await prisma.documentoUsuario.findUniqueOrThrow({ where: { id: enviado.id } })).driveFileId).toBe(jaEnviado);
    // O já enviado não foi reenviado, só levado ao lugar certo.
    expect(drive.filtrar("trashed = false").filter((a) => a.name === `Outros — ${hoje}.pdf`)).toHaveLength(1);
    expect(drive.caminho(jaEnviado, raiz)).toBe(`Equipe/Engenheira Drive (nº ${curto(ids.eng)})/Outros/Outros — ${hoje}.pdf`);
    expect(await org.ultimoRelatorioDrive()).toMatchObject({ cicloConcluido: true });
  });

  it("órfãs: pasta de lead apagado vai para a lixeira; lead arquivado e pasta sem etiqueta ficam", async () => {
    const arquivado = await prisma.lead.create({ data: { nome: "Arquivado", telefone: "1", servico: "construcao", arquivadoEm: new Date() } });
    const apagado = pastaSistema("cliente:lead-que-nao-existe", "Apagado (nº X)", clientes);
    const dentro = drive.novo({ name: "RG.pdf", mimeType: "application/pdf", parents: [apagado] });
    const vivo = pastaSistema(`cliente:${arquivado.id}`, "Arquivado", clientes);
    const manual = drive.novo({ name: "Pasta do dono", mimeType: PASTA, parents: [clientes] });
    const subpasta = pastaSistema("cliente:outro:juridico", "Jurídico", clientes);
    const obras = pastaDe("obras") ?? pastaSistema("obras", "Obras", raiz);
    const obraApagada = pastaSistema("obra:obra-inexistente", "Obra X", obras);
    // Pasta de topo em OUTRA raiz (ex.: ambiente de teste) nunca é varrida.
    const outraRaiz = drive.novo({ name: "Outra raiz", mimeType: PASTA, parents: ["root"] });
    const clientesOutraRaiz = pastaSistema("clientes", "Clientes", outraRaiz);
    const deOutraRaiz = pastaSistema("cliente:nao-existe-2", "Y", clientesOutraRaiz);

    const r = await org.sincronizarDrive({ prazoMs: 30_000 });
    expect(r.pastasOrfas).toBe(2);
    expect(drive.arquivos.get(apagado)!.trashed).toBe(true);
    expect(drive.arquivos.get(obraApagada)!.trashed).toBe(true);
    expect(drive.arquivos.get(dentro)!.trashed).toBe(false); // vai junto com a pasta (lixeira do Drive), nunca exclusão permanente
    expect(drive.arquivos.has(dentro)).toBe(true);
    for (const id of [vivo, manual, subpasta, deOutraRaiz]) expect(drive.arquivos.get(id)!.trashed).toBe(false);
    await prisma.lead.delete({ where: { id: arquivado.id } });
  });

  it("exclusões mandam a pasta certa para a lixeira: lead, obra, estudo, imóvel e usuário", async () => {
    const lead = await prisma.lead.create({ data: { nome: "Lead Excluir", telefone: "1", servico: "construcao", arquivadoEm: new Date() } });
    const obra = await prisma.obra.create({ data: { nome: "Obra Excluir", clienteNome: "C", clienteTel: "1" } });
    const estudo = await prisma.estudoIncorporacao.create({ data: { nome: "Estudo Excluir", municipio: "Parauapebas" } });
    const imovel = await prisma.imovel.create({ data: { slug: `imovel-excluir-${sufixo}`, titulo: "Imóvel Excluir", tipo: "casa", status: "venda", descricao: "x", preco: 1, area: 1, bairro: "Centro" } });
    const usuario = await prisma.usuario.create({ data: { nome: "Usuário Excluir", email: `excluir-${sufixo}@teste.local`, senha: "x", papel: "colaborador" } });
    const pastas = {
      lead: pastaSistema(`cliente:${lead.id}`, "Lead", clientes),
      obra: pastaSistema(`obra:${obra.id}`, "Obra", raiz),
      estudo: pastaSistema(`incorporacao:${estudo.id}`, "Estudo", raiz),
      imovel: pastaSistema(`imovel:${imovel.id}`, "Imóvel", raiz),
      usuario: pastaSistema(`equipe:${usuario.id}`, "Usuário", raiz),
    };
    expect(await (await import("@/lib/actions/leads")).excluirLeadDefinitivamente(lead.id)).toEqual({ ok: true });
    const { excluirServicoDefinitivo } = await import("@/lib/crm/excluir-servico");
    expect(await excluirServicoDefinitivo("obra", obra.id)).toEqual({ excluido: true });
    expect(await excluirServicoDefinitivo("estudo", estudo.id)).toEqual({ excluido: true });
    expect(await (await import("@/lib/imoveis/excluir")).excluirImovelDefinitivo(imovel.id)).toEqual({ excluido: true });
    await (await import("@/lib/actions/usuarios")).excluirUsuario(usuario.id);
    for (const id of Object.values(pastas)) expect(drive.arquivos.get(id)!.trashed).toBe(true);
    expect(pastaDe(`cliente:${lead.id}`)).toBeNull();
  });

  it("lead com documento no Drive pode ser excluído; o documento de um lead duplicado sai da pasta antes", async () => {
    const original = await prisma.lead.create({ data: { nome: "Original", telefone: "1", servico: "construcao", arquivadoEm: new Date() } });
    const copia = await prisma.lead.create({ data: { nome: "Cópia", telefone: "1", servico: "construcao" } });
    const pastaOriginal = pastaSistema(`cliente:${original.id}`, "Original", clientes);
    const atendimento = pastaSistema(`cliente:${original.id}:atendimento`, "Atendimento", pastaOriginal);
    const rg = drive.novo({ name: "RG.pdf", mimeType: "application/pdf", parents: [atendimento] });
    const cnh = drive.novo({ name: "CNH.pdf", mimeType: "application/pdf", parents: [atendimento] });
    const aRg = await prisma.arquivo.create({ data: { nome: "rg.pdf", mime: "application/pdf", driveFileId: rg } });
    const aCnh = await prisma.arquivo.create({ data: { nome: "cnh.pdf", mime: "application/pdf", driveFileId: cnh } });
    await prisma.documentoCliente.create({ data: { leadId: original.id, tipo: "rg", arquivoId: aRg.id } });
    await prisma.documentoCliente.create({ data: { leadId: original.id, tipo: "address_proof", arquivoId: aCnh.id } });
    await prisma.documentoCliente.create({ data: { leadId: copia.id, tipo: "address_proof", arquivoId: aCnh.id } });
    // Documento só no banco ainda bloqueia.
    const soBanco = await prisma.arquivo.create({ data: { nome: "x.pdf", mime: "application/pdf", dados: new Uint8Array([1]) } });
    const docBanco = await prisma.documentoCliente.create({ data: { leadId: original.id, tipo: "pis", arquivoId: soBanco.id } });
    const leads = await import("@/lib/actions/leads");
    expect(await leads.excluirLeadDefinitivamente(original.id)).toMatchObject({ ok: false, erro: expect.stringContaining("1 documento") });
    await prisma.documentoCliente.delete({ where: { id: docBanco.id } });
    await prisma.arquivo.delete({ where: { id: soBanco.id } });

    expect(await leads.excluirLeadDefinitivamente(original.id)).toEqual({ ok: true });
    expect(drive.arquivos.get(pastaOriginal)!.trashed).toBe(true);
    expect(await prisma.arquivo.findUnique({ where: { id: aRg.id } })).toBeNull();
    expect(await prisma.arquivo.findUnique({ where: { id: aCnh.id } })).not.toBeNull();
    expect(drive.caminho(cnh, raiz)).toBe(`Clientes/Cópia (nº ${curto(copia.id)})/Atendimento/Comprovante de endereço atualizado — ${dataArquivo(aCnh.criadoEm)}.pdf`);
    await prisma.documentoCliente.deleteMany({ where: { leadId: copia.id } });
    await prisma.arquivo.delete({ where: { id: aCnh.id } });
    await prisma.lead.delete({ where: { id: copia.id } });
  });

  it("mídia do WhatsApp: com cliente em Atendimento/WhatsApp, sem cliente por número", async () => {
    const lead = await prisma.lead.create({ data: { nome: "Cliente Zap", telefone: "1", servico: "construcao" } });
    const conexao = await prisma.conexaoWhatsApp.create({ data: { usuarioId: ids.admin } });
    const comCliente = await prisma.mensagemWhatsapp.create({ data: { conexaoId: conexao.id, leadId: lead.id, destinatario: "5594999990000", mensagem: "foto", midiaMime: "image/jpeg", enviadaEm: new Date() } });
    const semCliente = await prisma.mensagemWhatsapp.create({ data: { conexaoId: conexao.id, destinatario: "5594988887777", mensagem: "doc", midiaMime: "application/pdf", midiaNome: "boleto.pdf", enviadaEm: new Date() } });
    const { guardarMidia } = await import("@/lib/whatsapp/midia");
    await guardarMidia(comCliente.id, Buffer.from([255, 216, 255, 0]).toString("base64"), {});
    await guardarMidia(semCliente.id, Buffer.from("%PDF").toString("base64"), {});
    const m1 = await prisma.whatsappMidia.findUniqueOrThrow({ where: { mensagemId: comCliente.id } });
    const m2 = await prisma.whatsappMidia.findUniqueOrThrow({ where: { mensagemId: semCliente.id } });
    expect(drive.caminho(m1.driveFileId!, raiz)).toBe(`Clientes/Cliente Zap (nº ${curto(lead.id)})/Atendimento/WhatsApp/Mídia — ${hoje}.jpg`);
    expect(drive.caminho(m2.driveFileId!, raiz)).toBe(`WhatsApp sem cliente/+5594988887777/Mídia — ${hoje}.pdf`);
    await prisma.conexaoWhatsApp.delete({ where: { id: conexao.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
  });
});
