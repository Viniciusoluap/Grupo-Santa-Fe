// Pedido de 23/10 (H6): PLS fiel à PCI. Mesmo teste em
// Prospecta/server/pls-fiel-pci.test.ts.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PastaBiff8 } from "@/lib/caixa/biff8";
import { formatarCoordenada, isoParaSerial, lerPci } from "@/lib/caixa/pci";
import { calcularPls, curvaDeEvolucao, gerarXlsMedicao, type EntradaMedicaoCaixa } from "@/lib/caixa/medicao-xls";
import { gerarPdfMedicao } from "@/lib/caixa/medicao-pdf";
import { dadosFixosDasMedicoes, dadosPlsPadrao, normalizarDadosMedicao, validarDadosMedicao } from "@/lib/medicao-caixa";

const MODELO = new Uint8Array(readFileSync(new URL("../caixa/__fixtures__/pci-modelo-anonimo.xls", import.meta.url)));

function entrada(extra: Partial<EntradaMedicaoCaixa> = {}, pls: Record<string, unknown> = {}): EntradaMedicaoCaixa {
  const pci = lerPci(MODELO);
  return {
    tipo: "pls", pci,
    execucoes: [100, 100, 50, 50, 0, 0, 0, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    progresso: 29.35,
    anteriores: [{ data: "2026-06-25", progresso: 10.1, aferido: true }, { data: "2026-07-25", progresso: 20, aferido: false }],
    dados: { pls: { ...dadosPlsPadrao(), dataLevantamento: "2026-08-25", ...pls }, repactuacao: null, alteracao: null },
    fotos: [],
    ...extra,
  };
}

describe("1) coordenadas exatamente como na PCI", () => {
  it("número do formato 00°00'00\" vira graus, minutos e segundos", () => {
    expect(formatarCoordenada(52918, "S")).toBe(`05° 29' 18" S`);
    expect(formatarCoordenada(472701, "W")).toBe(`47° 27' 01" W`);
  });
  it("PCIs já enviadas (\"52918 S\") também saem certas; modelo zerado fica em branco", () => {
    expect(formatarCoordenada("52918 S")).toBe(`05° 29' 18" S`);
    expect(formatarCoordenada("472701 W")).toBe(`47° 27' 01" W`);
    expect(formatarCoordenada(`0°00'00.0"`, "S")).toBe("");
  });
  it("o PDF mostra a coordenada formatada", () => {
    const e = entrada();
    e.pci = { ...e.pci, identificacao: { ...e.pci.identificacao, latitude: "52918 S", longitude: "472701 W" } };
    const pdf = Buffer.from(gerarPdfMedicao(MODELO, e)).toString("latin1");
    expect(pdf).toContain("29' 18");
    expect(pdf).toContain("27' 01");
    expect(pdf).not.toContain("52918");
  });
});

describe("2) contrato, valor e contratação: perguntados 1x e pré-preenchidos", () => {
  it("vem da PLS mais recente que tiver cada campo; a PCI é reserva; contrato zerado do modelo é ignorado", () => {
    const fixos = dadosFixosDasMedicoes([
      { pls: { numeroContrato: null, valorImovel: null, dataContratacao: null } },
      { pls: { numeroContrato: "8.4444.0001234-5", valorImovel: 250000, dataContratacao: "2026-03-10" } },
      { pls: { numeroContrato: "ANTIGO", valorImovel: 1, dataContratacao: "2025-01-01" } },
    ], { contrato: "0.00000000000-0", valorImovel: 220000, dataContratacao: "2026-04-24" });
    expect(fixos).toMatchObject({ numeroContrato: "8.4444.0001234-5", valorImovel: 250000, dataContratacao: "2026-03-10" });
    expect(dadosFixosDasMedicoes([], { contrato: "0.00000000000-0", valorImovel: 220000, dataContratacao: "2026-04-24" }))
      .toMatchObject({ numeroContrato: null, valorImovel: 220000, dataContratacao: "2026-04-24" });
  });
  it("formulário: normaliza e valida os campos novos", () => {
    const d = normalizarDadosMedicao("pls", { pls: { dataLevantamento: "2026-08-25", numeroContrato: " 123 ", valorImovel: "250000", dataContratacao: "2026-13-40" } });
    expect(d.pls).toMatchObject({ numeroContrato: "123", valorImovel: 250000 });
    expect(validarDadosMedicao("pls", d)).toContain("Data da contratação: data inválida.");
  });
  it("XLS e PDF usam os dados informados na PLS", () => {
    const e = entrada({}, { numeroContrato: "8.4444.0001234-5", valorImovel: 250000, dataContratacao: "2026-03-10" });
    const xls = PastaBiff8.abrir(gerarXlsMedicao(MODELO, e));
    expect(xls.ler("PLS", "S51")).toBe("8.4444.0001234-5");
    expect(xls.ler("PLS", "AQ77")).toBe(250000);
    expect(xls.ler("PLS", "AL78")).toBe(isoParaSerial("2026-03-10"));
    const pdf = Buffer.from(gerarPdfMedicao(MODELO, e)).toString("latin1");
    expect(pdf).toContain("8.4444.0001234-5");
    expect(pdf).toContain("250.000,00");
    expect(pdf).toContain("10/03/2026");
  });
});

describe("3) início e término previsto vêm do Editar Obra", () => {
  it("cálculo, XLS e PDF usam as datas da obra; sem elas, contratação + 30 dias", () => {
    const e = entrada({ obra: { inicio: "2026-05-04", termino: "2026-11-30" } });
    const r = calcularPls(e);
    expect(r).toMatchObject({ inicio: "2026-05-04", termino: "2026-11-30", etapa: 3 });
    const xls = PastaBiff8.abrir(gerarXlsMedicao(MODELO, e));
    expect(xls.ler("PLS", "AL79")).toBe(isoParaSerial("2026-05-04"));
    const pdf = Buffer.from(gerarPdfMedicao(MODELO, e)).toString("latin1");
    expect(pdf).toContain("04/05/2026");
    expect(pdf).toContain("30/11/2026");
    expect(calcularPls(entrada()).inicio).toBe("2026-05-24"); // 24/04 + 30 dias (fórmula do modelo)
  });
});

describe("4) curva de evolução preenchida", () => {
  it("PLS por etapa, aferido = medição confirmada pelo banco, adotado e mês de referência", () => {
    const curva = curvaDeEvolucao("2026-05-04", [
      { data: "2026-06-25", progresso: 10.1, aferido: true },
      { data: "2026-07-25", progresso: 20 },
      { data: "2026-08-25", progresso: 29.35 },
    ], 6);
    expect(curva.map((l) => l.mes)).toEqual(["2026-05-04", "2026-06-04", "2026-07-04", "2026-08-04", "2026-09-04", "2026-10-04", "2026-11-04"]);
    expect(curva[1]).toMatchObject({ pls: 10.1, aferido: 10.1, adotado: 10.1 });
    expect(curva[2]).toMatchObject({ pls: 20, aferido: null, adotado: 20 });
    expect(curva[3]).toMatchObject({ pls: 29.35, adotado: 29.35 });
    expect(curva[0]).toMatchObject({ pls: null, adotado: 0 });
    expect(curva[4]).toMatchObject({ pls: null, adotado: null });
  });
  it("XLS grava PLS (AF), aferido (AJ) e mês de referência (AT)", () => {
    const e = entrada({ obra: { inicio: "2026-05-04", termino: null } });
    const xls = PastaBiff8.abrir(gerarXlsMedicao(MODELO, e));
    expect(xls.ler("PLS", "AF96")).toBe(10.1);
    expect(xls.ler("PLS", "AF98")).toBe(29.35);
    expect(xls.ler("PLS", "AJ96")).toBe(10.1);
    expect(xls.ler("PLS", "AT96")).toBe(isoParaSerial("2026-06-04"));
  });
  it("QA: mês de referência só até o prazo; término sem data da obra mantém a fórmula; repactuação prevalece", () => {
    const xls = PastaBiff8.abrir(gerarXlsMedicao(MODELO, entrada({ obra: { inicio: "2026-05-04", termino: null } })));
    expect(xls.ler("PLS", "AT101")).toBe(isoParaSerial("2026-11-04")); // etapa 6 = prazo
    expect(xls.ler("PLS", "AT110")).not.toBe(isoParaSerial("2027-08-04"));
    expect(xls.ehFormula("PLS", "AL80")).toBe(true);
    const rep = calcularPls(entrada({ obra: { inicio: "2026-05-04", termino: "2026-11-30" } }, { houveRepactuacao: true, etapasRepactuadas: 9 }));
    expect(rep.termino).toBe("2027-02-04");
  });
  it("Codex: sem nº de contrato válido, o placeholder do modelo é apagado do XLS", () => {
    const xls = PastaBiff8.abrir(gerarXlsMedicao(MODELO, entrada()));
    expect(xls.ler("PLS", "S51")).toBeNull();
  });
});
