// Lote 03, correções 09b e 10 — exclusão lógica de versão do modelo da PCI e
// confirmação de mudança crítica, com o banco real (TEST_DATABASE_URL).
// Gêmeo de Prospecta/server/pci-lote3-db.test.ts.
import { readFileSync } from "node:fs";
import { strToU8, zipSync } from "fflate";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;

const MODELO = new Uint8Array(readFileSync(new URL("../caixa/__fixtures__/pci-modelo-anonimo.xls", import.meta.url)));

/** .xlsm só com a aba da proposta (sem a PLS): mudança crítica. */
function xlsmSemPls(): Uint8Array {
  return zipSync({
    "xl/workbook.xml": strToU8(`<workbook xmlns:r="r"><sheets><sheet name="Proposta_Constr_Individual" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`),
    "xl/worksheets/sheet1.xml": strToU8(`<worksheet><sheetData/><!-- ${Date.now()} --></worksheet>`),
  });
}

describe.skipIf(!url)("PCI da CAIXA › modelos (lote 03, banco real)", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let dados: typeof import("@/lib/obras/pci-gerador-dados");
  const criados: string[] = [];
  let atualAntes: string | null = null;

  beforeAll(async () => {
    prisma = (await import("@/lib/db")).prisma;
    dados = await import("@/lib/obras/pci-gerador-dados");
    atualAntes = (await prisma.pciModelo.findFirst({ where: { atual: true }, select: { id: true } }))?.id ?? null;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.pciModelo.updateMany({ where: { id: { in: criados } }, data: { atual: false } });
    await prisma.pciModelo.deleteMany({ where: { id: { in: criados } } });
    if (atualAntes) await prisma.pciModelo.update({ where: { id: atualAntes }, data: { atual: true } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it("relatório guardado; mudança crítica só vira atual com confirmação; exclusão lógica preserva o arquivo", async () => {
    const base = await dados.gravarModeloPci(`pci-${Date.now()}.xls`, MODELO, "teste-lote3", null);
    expect(base.repetido).toBe(false);
    criados.push(base.id);
    expect(base.relatorio?.critico).toBe(false);
    await dados.definirModeloAtualPci(base.id, { usuarioId: "teste-lote3" });

    const v2 = await dados.gravarModeloPci("pci-critico.xlsm", xlsmSemPls(), "teste-lote3", null);
    criados.push(v2.id);
    expect(v2.aguardandoConfirmacao).toBe(true);
    expect(v2.relatorio?.criticas.join(" ")).toMatch(/PLS/);
    let lista = await dados.listarModelosPci();
    expect(lista.find((m) => m.id === v2.id)).toMatchObject({ atual: false, aguardandoConfirmacao: true, pcisGeradas: 0 });
    await expect(dados.definirModeloAtualPci(v2.id, { usuarioId: "teste-lote3" })).rejects.toThrow(/mudanças críticas/);
    await dados.definirModeloAtualPci(v2.id, { usuarioId: "teste-lote3", confirmarCritica: true });
    lista = await dados.listarModelosPci();
    expect(lista.find((m) => m.id === v2.id)).toMatchObject({ atual: true, aguardandoConfirmacao: false });
    // Modelo atual .xlsm sem .xls compatível: gerar fica bloqueado pedindo a .xls.
    const atual = lista.find((m) => m.id === v2.id)!;
    await expect(dados.modeloParaGerarPci(atual)).rejects.toThrow(/Envie a versão \.xls do modelo oficial/);

    // Exclusão lógica: a atual não pode; as outras saem da lista, mas o arquivo continua.
    await expect(dados.excluirModeloPci(v2.id, "teste-lote3")).rejects.toThrow(/versão atual não pode ser excluída/);
    expect(await dados.previaExclusaoModeloPci(base.id)).toMatchObject({ atual: false, pcisGeradas: 0 });
    await dados.excluirModeloPci(base.id, "teste-lote3");
    expect((await dados.listarModelosPci()).some((m) => m.id === base.id)).toBe(false);
    const excluido = await prisma.pciModelo.findUnique({ where: { id: base.id }, select: { excluidoEm: true, excluidoPorId: true } });
    expect(excluido?.excluidoEm).not.toBeNull();
    expect(excluido?.excluidoPorId).toBe("teste-lote3");
    expect((await dados.arquivoDoModeloPci(base.id))?.dados.length).toBe(MODELO.length);
    await expect(dados.excluirModeloPci(base.id, "teste-lote3")).rejects.toThrow(/não encontrado/);
    const auditoria = await prisma.pciModeloAuditoria.findMany({ where: { modeloId: { in: [base.id, v2.id] } }, orderBy: { criadoEm: "asc" }, select: { acao: true } });
    expect(auditoria.map((a) => a.acao)).toEqual(expect.arrayContaining(["enviar", "confirmar_critica", "excluir"]));
  });
});
