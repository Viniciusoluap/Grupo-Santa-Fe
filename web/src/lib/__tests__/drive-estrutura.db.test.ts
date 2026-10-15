// Pedido 15/10 — estrutura de pastas legível no Google Drive. Mesmos cenários de
// .tmp-test/drive-estrutura.test.ts da Prospecta, com um Drive simulado em memória.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { criarDriveFake } from "./drive-fake";
import { dataArquivo } from "@/lib/drive-estrutura";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "www.gruposantafee.com.br" }) }));
const sessao = vi.hoisted(() => ({ user: { id: "", role: "admin" } }));
vi.mock("@/auth", () => ({ auth: async () => sessao }));
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;
process.env.AUTH_SECRET ||= "segredo-de-teste";

const JSON_WEB = JSON.stringify({ web: { client_id: "123-abc.apps.googleusercontent.com", client_secret: "GOCSPX-s", redirect_uris: ["https://www.gruposantafee.com.br/api/google-drive/callback"] } });
const PASTA = "application/vnd.google-apps.folder";
const hoje = dataArquivo(new Date());

describe.skipIf(!url)("Drive: estrutura de pastas legível (banco real)", () => {
  const drive = criarDriveFake();
  let prisma: typeof import("@/lib/db").prisma;
  let modulo: typeof import("@/lib/incorporacao/registro-drive");
  let conexao: typeof import("@/lib/google-drive-conexao");
  let blob: typeof import("@/lib/blob");
  let raiz = "";
  let leadId = "";
  let estudoId = "";
  let arquivoAntigo = "";
  const antigas: string[] = [];

  beforeAll(async () => {
    vi.stubGlobal("fetch", drive.fetchFake);
    ({ prisma } = await import("@/lib/db"));
    modulo = await import("@/lib/incorporacao/registro-drive");
    conexao = await import("@/lib/google-drive-conexao");
    blob = await import("@/lib/blob");
    const acoes = await import("@/lib/actions/google-drive");
    const adminId = (await prisma.usuario.findFirst({ where: { papel: "admin", ativo: true }, select: { id: true } }))!.id;
    sessao.user.id = adminId;
    await prisma.googleDriveOauth.deleteMany();
    await acoes.salvarCredencialGoogleDrive(JSON_WEB);
    await conexao.concluirConexao("codigo", "https://www.gruposantafee.com.br", adminId);
    raiz = (await prisma.googleDriveOauth.findUnique({ where: { id: 1 } }))!.rootFolderId!;
    // Referências de outros testes não podem apontar para IDs deste Drive simulado.
    const prefixo = `outro-${Date.now()}-`;
    await prisma.$executeRaw`UPDATE estudo_documentos_registro SET "driveFileId" = ${prefixo} || "driveFileId" WHERE "driveFileId" ~ '^f[0-9]+$'`;
    await prisma.$executeRaw`UPDATE arquivos SET "driveFileId" = ${prefixo} || "driveFileId" WHERE "driveFileId" ~ '^f[0-9]+$'`;
    await prisma.$executeRaw`UPDATE imovel_fotos SET "driveFileId" = ${prefixo} || "driveFileId" WHERE "driveFileId" ~ '^f[0-9]+$'`;

    leadId = (await prisma.lead.create({ data: { nome: "Maria da Silva", telefone: "94999999999", servico: "financiamento" } })).id;
    estudoId = (await prisma.estudoIncorporacao.create({ data: { nome: "Loteamento Jardim X", municipio: "Parauapebas" } })).id;
    // Estrutura antiga: incorporacao-<id>/documento-<item>/arquivo, sem etiqueta interna.
    const a = drive.novo({ name: `incorporacao-${estudoId}`, mimeType: PASTA, parents: [raiz] });
    const b = drive.novo({ name: "documento-padrao-0", mimeType: PASTA, parents: [a] });
    antigas.push(a, b);
    arquivoAntigo = drive.novo({ name: "scan.pdf", mimeType: "application/pdf", parents: [b], dados: Buffer.from("%PDF-1.4") });
    await prisma.estudoDocumentoRegistro.create({ data: { estudoId, itemId: "padrao-0", nome: "scan.pdf", mime: "application/pdf", tamanho: 8, sha256: "x".repeat(64), driveFileId: arquivoAntigo, enviadoPorId: adminId } });
  });
  afterAll(async () => { vi.unstubAllGlobals(); await prisma.$disconnect(); });

  it("Testar Google Drive reorganiza o que já existia e manda as pastas antigas vazias para a lixeira", async () => {
    const r = await modulo.diagnosticarDrive();
    expect(r.ok).toBe(true);
    expect(r.etapas.at(-1)).toMatchObject({ ok: true, etapa: expect.stringMatching(/1 arquivo\(s\) movido\(s\), 2 pasta\(s\) antiga\(s\)/) });
    expect(drive.caminho(arquivoAntigo, raiz)).toMatch(new RegExp(`^Incorporação/Loteamento Jardim X \\(nº ${estudoId.slice(-6).toUpperCase()}\\)/Registro do loteamento/.+ — ${hoje}\\.pdf$`));
    for (const id of antigas) expect(drive.arquivos.get(id)!.trashed).toBe(true);
    expect(drive.arquivos.get(raiz)!.appProperties).toEqual({ pastaSistema: "raiz" });
  });

  it("contrato do cliente vai para Clientes/<Nome (nº)>/Jurídico e abre pela mesma rota", async () => {
    const r = await blob.salvarContratoCliente({ leadId, rotulo: "Contrato CT-9 assinado", nome: "CT-9-assinado.pdf", bytes: Buffer.from("%PDF-1.4 contrato") });
    const id = r.url!.split("/").pop()!;
    const arquivo = await prisma.arquivo.findUnique({ where: { id } });
    expect(arquivo?.dados).toBeNull();
    expect(drive.caminho(arquivo!.driveFileId!, raiz)).toBe(`Clientes/Maria da Silva (nº ${leadId.slice(-6).toUpperCase()})/Jurídico/Contrato CT-9 assinado — ${hoje}.pdf`);
    const { GET } = await import("@/app/api/arquivo/[id]/route");
    const resposta = await GET(new Request("http://x") as never, { params: Promise.resolve({ id }) });
    expect(Buffer.from(await resposta.arrayBuffer()).toString()).toBe("%PDF-1.4 contrato");
  });

  it("cliente renomeado: a mesma pasta é renomeada, nunca duplicada", async () => {
    await prisma.lead.update({ where: { id: leadId }, data: { nome: "Maria Souza" } });
    await blob.salvarContratoCliente({ leadId, rotulo: "Contrato CT-10", nome: "CT-10.pdf", bytes: Buffer.from("%PDF-1.4") });
    const pastas = drive.filtrar("trashed = false").filter((p) => p.appProperties?.pastaSistema === `cliente:${leadId}`);
    expect(pastas.map((p) => p.name)).toEqual([`Maria Souza (nº ${leadId.slice(-6).toUpperCase()})`]);
  });

  it("sem cliente vinculado o contrato fica no banco", async () => {
    const r = await blob.salvarContratoCliente({ leadId: null, rotulo: "Contrato CT-11", nome: "CT-11.pdf", bytes: Buffer.from("%PDF-1.4") });
    const arquivo = await prisma.arquivo.findUnique({ where: { id: r.url!.split("/").pop()! } });
    expect(arquivo?.driveFileId).toBeNull();
    expect(arquivo?.dados).not.toBeNull();
  });

  it("Reconectar reaproveita a mesma pasta raiz", async () => {
    await conexao.concluirConexao("codigo", "https://www.gruposantafee.com.br", sessao.user.id);
    expect((await prisma.googleDriveOauth.findUnique({ where: { id: 1 } }))!.rootFolderId).toBe(raiz);
    expect(drive.filtrar("trashed = false").filter((a) => a.name === "Grupo Santa Fé — Documentos do sistema")).toHaveLength(1);
  });
});
