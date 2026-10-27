// Pedido de 18/10 — a PCI original (intacta) e cada medição preenchida (.pdf; Lote 02 sem .xls)
// ficam no Google Drive da obra: Obras/<Obra (nº)>/Medições CAIXA. Drive simulado.
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
const hoje = dataArquivo(new Date());
const PCI = readFileSync(join(__dirname, "../caixa/__fixtures__/pci-modelo-anonimo.xls"));

describe.skipIf(!url)("Medições CAIXA no Google Drive (banco real)", () => {
  const drive = criarDriveFake();
  let prisma: typeof import("@/lib/db").prisma;
  let raiz = "";
  let obraId = "";
  let pasta = "";

  beforeAll(async () => {
    vi.stubGlobal("fetch", drive.fetchFake);
    ({ prisma } = await import("@/lib/db"));
    const conexao = await import("@/lib/google-drive-conexao");
    const acoes = await import("@/lib/actions/google-drive");
    const adminId = (await prisma.usuario.findFirst({ where: { papel: "admin", ativo: true }, select: { id: true } }))!.id;
    sessao.user.id = adminId;
    await prisma.googleDriveOauth.deleteMany();
    await acoes.salvarCredencialGoogleDrive(JSON_WEB);
    await conexao.concluirConexao("codigo", "https://www.gruposantafee.com.br", adminId);
    raiz = (await prisma.googleDriveOauth.findUnique({ where: { id: 1 } }))!.rootFolderId!;
    obraId = (await prisma.obra.create({ data: { nome: "Casa Teste PCI", clienteNome: "Cliente", clienteTel: "94999999999" } })).id;
    pasta = `Obras/Casa Teste PCI (nº ${obraId.slice(-6).toUpperCase()})/Medições CAIXA`;
  });
  afterAll(async () => {
    vi.unstubAllGlobals();
    if (obraId) {
      await prisma.obraFoto.deleteMany({ where: { obraId } });
      await prisma.obraProgressoHistorico.deleteMany({ where: { obraId } });
      await prisma.obraPci.deleteMany({ where: { obraId } });
      await prisma.obra.delete({ where: { id: obraId } });
    }
    await prisma.$disconnect();
  });

  const nomesNaPasta = () => [...drive.arquivos.values()].filter(a => !a.trashed && a.mimeType !== "application/vnd.google-apps.folder")
    .map(a => drive.caminho(a.id, raiz)).filter(c => c.startsWith(pasta)).sort();

  it("PCI enviada: a original vai intacta para o Drive, uma vez por versão", async () => {
    const { gravarPci } = await import("@/lib/obras/pci");
    const r = await gravarPci(obraId, "PCI_cliente.xls", new Uint8Array(PCI), sessao.user.id);
    expect(r.drive).toBe("ok");
    expect(nomesNaPasta()).toEqual([`${pasta}/PCI original — ${hoje}.xls`]);
    const original = [...drive.arquivos.values()].find(a => a.name.startsWith("PCI original"))!;
    expect(Buffer.compare(original.dados!, PCI)).toBe(0);
    // Reenviar o mesmo arquivo não duplica no Drive.
    expect((await gravarPci(obraId, "PCI_cliente.xls", new Uint8Array(PCI), sessao.user.id)).drive).toBeNull();
    expect(nomesNaPasta()).toHaveLength(1);
  });

  it("PCI enviada e não vinculada: salvar devolve o motivo legível (não um erro genérico do Next)", async () => {
    const acoes = await import("@/lib/actions/obra-progresso");
    const { SERVICOS_PROGRESSO } = await import("@/lib/financeiro/progresso");
    const itens = SERVICOS_PROGRESSO.map(s => ({ chave: s.chave, incidencia: s.incidenciaPadrao, execucao: "0" }));
    expect(await acoes.salvarProgressoObra(obraId, itens, "pls")).toEqual({ ok: false, erro: "Vincule a PCI e use as incidências da planilha antes de salvar." });
  });

  it("medição salva: só o .pdf preenchido (Lote 02, sem .xls) fica na mesma pasta; a PCI original não muda", async () => {
    const acoes = await import("@/lib/actions/obra-progresso");
    expect((await acoes.vincularPciObra(obraId)).ok).toBe(true);
    const itens = (await prisma.obraProgressoItem.findMany({ where: { obraId }, orderBy: { chave: "asc" } }))
      .map(i => ({ chave: i.chave, incidencia: String(i.incidencia), execucao: i.chave === "infraestrutura" ? "100" : "0" }));
    const salvo = await acoes.salvarProgressoObra(obraId, itens, "pls");
    expect(salvo.ok).toBe(true);
    const medicaoId = (salvo as { medicaoId: string }).medicaoId;
    const r = await acoes.copiarMedicaoNoDrive(medicaoId);
    expect(r).toMatchObject({ ok: true, drive: "ok" });
    const nomes = nomesNaPasta();
    expect(nomes).toHaveLength(2);
    expect(nomes.filter(n => /\/PLS \(levantamento \d{2}-\d{2}-\d{4}\) — .+\.pdf$/.test(n))).toHaveLength(1);
    expect(nomes.some(n => n.startsWith(`${pasta}/PLS`) && n.endsWith(".xls"))).toBe(false);
    const pdf = [...drive.arquivos.values()].find(a => a.name.startsWith("PLS") && a.name.endsWith(".pdf"))!;
    expect(pdf.dados!.subarray(0, 4).toString()).toBe("%PDF");
    const pci = await prisma.obraPci.findUnique({ where: { obraId }, include: { versao: true } });
    expect(Buffer.compare(Buffer.from(pci!.versao.dados), PCI)).toBe(0);
  });

  it("sem Google Drive conectado a medição continua salva e o arquivo segue no download", async () => {
    const conexao = await import("@/lib/google-drive-conexao");
    await conexao.desconectarOAuth(sessao.user.id);
    const acoes = await import("@/lib/actions/obra-progresso");
    const m = await prisma.obraProgressoHistorico.findFirstOrThrow({ where: { obraId } });
    expect(await acoes.copiarMedicaoNoDrive(m.id)).toMatchObject({ ok: true, drive: "indisponivel" });
  });
});
