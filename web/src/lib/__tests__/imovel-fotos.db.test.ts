// Pedido de 15/10 — fotos de imóveis no Google Drive. Mesmos cenários de
// .tmp-test/imovel-fotos.test.ts da Prospecta, com um Drive simulado em memória.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { criarDriveFake } from "./drive-fake";
import { dataArquivo } from "@/lib/drive-estrutura";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "www.gruposantafee.com.br" }) }));
const sessao = vi.hoisted(() => ({ user: { id: "", role: "admin" } as { id: string; role: string } | null }));
vi.mock("@/auth", () => ({ auth: async () => sessao.user && sessao }));
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;
process.env.AUTH_SECRET ||= "segredo-de-teste";

const JSON_WEB = JSON.stringify({ web: { client_id: "123-abc.apps.googleusercontent.com", client_secret: "GOCSPX-s", redirect_uris: ["https://www.gruposantafee.com.br/api/google-drive/callback"] } });
const JPG = "data:image/jpeg;base64," + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString("base64");
const JPG2 = "data:image/jpeg;base64," + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 9, 9, 9]).toString("base64");
const hoje = dataArquivo(new Date());

describe.skipIf(!url)("Fotos de imóveis no Google Drive (banco real)", () => {
  const drive = criarDriveFake();
  let prisma: typeof import("@/lib/db").prisma;
  let fotos: typeof import("@/lib/imovel-fotos");
  let raiz = "";
  let imovelId = "";
  const curto = () => imovelId.slice(-6).toUpperCase();
  const novoImovel = async (titulo: string, publicado = true) =>
    (await prisma.imovel.create({ data: { slug: `${titulo}-${Date.now()}`.toLowerCase().replace(/\s+/g, "-"), titulo, tipo: "casa", status: "venda", descricao: "", preco: 1, area: 1, bairro: "Centro", cidade: "Canaã", publicadoSite: publicado } })).id;

  beforeAll(async () => {
    vi.stubGlobal("fetch", drive.fetchFake);
    ({ prisma } = await import("@/lib/db"));
    fotos = await import("@/lib/imovel-fotos");
    const conexao = await import("@/lib/google-drive-conexao");
    const acoes = await import("@/lib/actions/google-drive");
    const adminId = (await prisma.usuario.findFirst({ where: { papel: "admin", ativo: true }, select: { id: true } }))!.id;
    sessao.user = { id: adminId, role: "admin" };
    await prisma.googleDriveOauth.deleteMany();
    await acoes.salvarCredencialGoogleDrive(JSON_WEB);
    await conexao.concluirConexao("codigo", "https://www.gruposantafee.com.br", adminId);
    raiz = (await prisma.googleDriveOauth.findUnique({ where: { id: 1 } }))!.rootFolderId!;
    const prefixo = `outro-${Date.now()}-`;
    await prisma.$executeRaw`UPDATE estudo_documentos_registro SET "driveFileId" = ${prefixo} || "driveFileId" WHERE "driveFileId" ~ '^f[0-9]+$'`;
    await prisma.$executeRaw`UPDATE arquivos SET "driveFileId" = ${prefixo} || "driveFileId" WHERE "driveFileId" ~ '^f[0-9]+$'`;
    await prisma.$executeRaw`UPDATE imovel_fotos SET "driveFileId" = ${prefixo} || "driveFileId" WHERE "driveFileId" ~ '^f[0-9]+$'`;
    imovelId = await novoImovel("Casa Jardim");
  });
  afterAll(async () => { vi.unstubAllGlobals(); await prisma.$disconnect(); });

  it("fotos em Imóveis/<Título (nº)>/01 - Fotos com o checklist de pastas", async () => {
    const urls = await fotos.aplicarFotosImovel(imovelId, [JPG, JPG2], null);
    expect(urls.every((u) => /^\/api\/imovel-foto\/[a-z0-9]+$/.test(u))).toBe(true);
    const linhas = await prisma.imovelFoto.findMany({ where: { imovelId }, orderBy: { criadoEm: "asc" } });
    expect(linhas.every((l) => l.driveFileId && l.dados === null)).toBe(true);
    const ids = urls.map((u) => u.split("/").pop());
    const porId = new Map(linhas.map((l) => [l.id, l.driveFileId!]));
    expect(drive.caminho(porId.get(ids[0]!)!, raiz)).toBe(`Imóveis/Casa Jardim (nº ${curto()})/01 - Fotos/Foto 01 — ${hoje}.jpg`);
    expect(drive.caminho(porId.get(ids[1]!)!, raiz)).toBe(`Imóveis/Casa Jardim (nº ${curto()})/01 - Fotos/Foto 02 — ${hoje}.jpg`);
    const sub = drive.filtrar("trashed = false").filter((a) => a.appProperties?.pastaSistema?.startsWith(`imovel:${imovelId}:`)).map((a) => a.name).sort();
    expect(sub).toEqual(["01 - Fotos", "02 - Documentos do imóvel", "03 - Plantas e projetos", "04 - Propostas e contratos"]);
  });

  it("retirar foto manda para a lixeira; renomear o imóvel renomeia a pasta e renumera", async () => {
    const atual = JSON.parse((await prisma.imovel.findUnique({ where: { id: imovelId } }))!.imagens) as string[];
    const removidaId = atual[0].split("/").pop()!;
    const removidaDrive = (await prisma.imovelFoto.findUnique({ where: { id: removidaId } }))!.driveFileId!;
    await prisma.imovel.update({ where: { id: imovelId }, data: { titulo: "Casa Jardim Reformada" } });
    const final = await fotos.aplicarFotosImovel(imovelId, [atual[1]], null);
    expect(drive.arquivos.get(removidaDrive)!.trashed).toBe(true);
    const ficou = (await prisma.imovelFoto.findUnique({ where: { id: final[0].split("/").pop()! } }))!;
    expect(drive.caminho(ficou.driveFileId!, raiz)).toBe(`Imóveis/Casa Jardim Reformada (nº ${curto()})/01 - Fotos/Foto 01 — ${hoje}.jpg`);
  });

  it("Drive fora do ar: foto no banco e enviada depois pelo Testar Google Drive", async () => {
    const outro = await novoImovel("Apto Centro");
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: { errors: [{ reason: "backendError" }] } }), { status: 500 }));
    const [u] = await fotos.aplicarFotosImovel(outro, [JPG], null);
    const id = u.split("/").pop()!;
    expect((await prisma.imovelFoto.findUnique({ where: { id } }))).toMatchObject({ driveFileId: null });
    vi.stubGlobal("fetch", drive.fetchFake);
    expect((await fotos.enviarFotosPendentesAoDrive()).enviadas).toBeGreaterThanOrEqual(1);
    const depois = (await prisma.imovelFoto.findUnique({ where: { id } }))!;
    expect(depois.dados).toBeNull();
    expect(drive.caminho(depois.driveFileId!, raiz)).toBe(`Imóveis/Apto Centro (nº ${outro.slice(-6).toUpperCase()})/01 - Fotos/Foto 01 — ${hoje}.jpg`);
  });

  it("cadastro antigo com foto dentro do anúncio é migrado", async () => {
    const antigo = await novoImovel("Lote Antigo");
    await prisma.imovel.update({ where: { id: antigo }, data: { imagens: JSON.stringify([JPG]) } });
    await fotos.enviarFotosPendentesAoDrive();
    expect(JSON.parse((await prisma.imovel.findUnique({ where: { id: antigo } }))!.imagens)[0]).toMatch(/^\/api\/imovel-foto\//);
  });

  it("rota: imóvel publicado é público; não publicado só para a equipe", async () => {
    const privado = await novoImovel("Casa Privada", false);
    const [u] = await fotos.aplicarFotosImovel(privado, [JPG], null);
    const { GET } = await import("@/app/api/imovel-foto/[id]/route");
    const chamar = () => GET(new Request("http://x") as never, { params: Promise.resolve({ id: u.split("/").pop()! }) });
    expect((await chamar()).status).toBe(200);
    const admin = sessao.user;
    sessao.user = null;
    expect((await chamar()).status).toBe(404);
    sessao.user = admin;
    const publico = JSON.parse((await prisma.imovel.findUnique({ where: { id: imovelId } }))!.imagens)[0].split("/").pop();
    sessao.user = null;
    const r = await GET(new Request("http://x") as never, { params: Promise.resolve({ id: publico }) });
    expect(r.status).toBe(200);
    expect(r.headers.get("Cache-Control")).toContain("public");
    sessao.user = admin;
  });
});
