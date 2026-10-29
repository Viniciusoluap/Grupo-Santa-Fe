// Lote 03 — correções 06, 07, 08 e 10 (PCI/PLS). Mesmo teste em
// Prospecta/server/pci-lote3.test.ts.
import { readFileSync } from "node:fs";
import { strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  CAMPOS_PCI,
  analisarCronogramaPci,
  errosPci,
  formularioPciVazio,
  limiteBdiPci,
  normalizarFormularioPci,
  numeroPci,
  pendenciasPci,
  type FormularioPci,
} from "@/lib/pci-gerador";
import { LISTAS_PCI, opcaoExataPci } from "@/lib/pci-listas";
import { curvasPadraoPci, faixaCurvaPci, incrementoMaximoEtapaPci, situacaoCurvaPls, situacaoPropostoPls } from "@/lib/pci-curvas";
import { OPCOES_ALTERA_AREA, OPCOES_SISTEMA_CONSTRUTIVO, dadosPlsPadrao } from "@/lib/medicao-caixa";
import { PastaBiff8 } from "@/lib/caixa/biff8";
import { PastaXlsx, gerarPlanilhaPci, lerFormularioPci } from "@/lib/caixa/pci-gerador";
import { lerPci } from "@/lib/caixa/pci";
import { compararEstruturasPci, lerEstruturaModeloPci, xlsCompativelCom } from "@/lib/caixa/pci-modelo-estrutura";
import { curvaDeEvolucao, execucaoPlsValida, situacaoDaPls, type EntradaMedicaoCaixa } from "@/lib/caixa/medicao-xls";
import { gerarPdfMedicao } from "@/lib/caixa/medicao-pdf";

const MODELO = new Uint8Array(readFileSync(new URL("../caixa/__fixtures__/pci-modelo-anonimo.xls", import.meta.url)));
const JSON_LISTAS = JSON.parse(readFileSync(new URL("../../../../docs/handoffs/lote3/pci-listas.json", import.meta.url), "utf8")) as {
  listas: { aba: string; celula: string; intervalo_validacao: string | null; rotulo: string | null; secao: string | null; campo_sistema: string | null; opcoes: string[]; opcoes_exibicao: string[] }[];
};

function form(cronograma: (number | null)[], campos: Record<string, unknown> = {}): FormularioPci {
  const f = formularioPciVazio();
  Object.assign(f.campos, { prazoMeses: cronograma.length, valorImovel: 250000, ...campos });
  f.cronograma = cronograma;
  return normalizarFormularioPci(f);
}

describe("07 — seletores conferidos com o JSON oficial", () => {
  it("o módulo de listas é exatamente o JSON extraído do Excel oficial", () => {
    expect(LISTAS_PCI).toHaveLength(JSON_LISTAS.listas.length);
    JSON_LISTAS.listas.forEach((j, i) => {
      expect(LISTAS_PCI[i]).toEqual({ aba: j.aba, celula: j.celula, intervalo: j.intervalo_validacao ?? j.celula, rotulo: j.rotulo ?? "", secao: j.secao, campoSistema: j.campo_sistema, opcoes: j.opcoes, opcoesExibicao: j.opcoes_exibicao });
    });
  });

  it("todo campo com lista na Proposta vira seletor com as opções exatas; O106 (sem lista) segue texto", () => {
    const proposta = JSON_LISTAS.listas.filter((j) => j.aba === "Proposta_Constr_Individual");
    for (const j of proposta) {
      if (j.celula === "X58") continue; // hemisfério da latitude: parte do campo de coordenada (N/S)
      const campo = CAMPOS_PCI.find((c) => c.celula === j.celula);
      expect(campo, j.celula).toBeDefined();
      expect(campo!.tipo, j.celula).toBe("lista");
      expect(campo!.opcoes, j.celula).toEqual(j.opcoes);
    }
    expect(CAMPOS_PCI.find((c) => c.id === "esquadriasInternas")?.tipo).toBe("texto");
    // cômodos aceitam "4+" (antes eram inteiros); pavimentos começam em 1
    expect(CAMPOS_PCI.find((c) => c.id === "pavimentos")?.opcoes).toEqual(["1", "2", "3", "4+"]);
    expect(CAMPOS_PCI.find((c) => c.id === "vagas")?.opcoes).toEqual(["0", "1", "2", "3", "4+"]);
  });

  it("células corrigidas e campos que faltavam", () => {
    const porId = (id: string) => CAMPOS_PCI.find((c) => c.id === id);
    expect(porId("alvaraValidade")?.celula).toBe("AH64");
    expect(porId("longitude")?.celulaHemisferio).toBeUndefined();
    expect(porId("longitude")?.hemisferioFixo).toBe("W");
    for (const [id, cel] of [["certidaoMatricula", "Q63"], ["projetoArquitetonico", "AL63"], ["docSistemaInovador", "AS89"], ["datecNumero", "N76"], ["normaAbnt", "L79"], ["fabricanteEps", "G83"],
      ["executor", "AN140"], ["preExecutado", "AS161"], ["justificativaPrazo", "M163"], ["justificativaPrazoTexto", "AA163"], ["justificativaIncidencias", "AG155"], ["obrasPreExistentes", "G165"], ["observacoes", "G245"]]) {
      expect(porId(id)?.celula, id).toBe(cel);
    }
    expect(limiteBdiPci("Construtora")).toBe(18);
    expect(limiteBdiPci("Profissional Autônomo")).toBe(6);
  });

  it("valor legado vira a opção exata; fora da lista bloqueia", () => {
    expect(opcaoExataPci(CAMPOS_PCI.find((c) => c.id === "finalidade")!.opcoes!, "constr.terr.proprio fgts")).toBe(" Constr.Terr.Próprio FGTS");
    const f = form([100], { esgoto: "Rede pública", pavimentos: 5, quartos: 2, uf: "ma" });
    expect(f.campos.quartos).toBe("2");
    expect(f.campos.uf).toBe("MA");
    const erros = errosPci(f, { paraGerar: false });
    expect(erros.some((e) => e.includes("Rede pública"))).toBe(true);
    expect(erros.some((e) => e.includes("Pavimentos"))).toBe(true);
    expect(errosPci(form([100], { esgoto: "Rede de Esgoto", pavimentos: "4+" }), { paraGerar: true })).toEqual([]);
  });

  it("Alteração de Projeto usa as listas oficiais da aba Alteração", () => {
    expect(OPCOES_SISTEMA_CONSTRUTIVO).toHaveLength(13);
    expect(OPCOES_ALTERA_AREA).toEqual(["Sim", "Não", "Não se aplica"]);
  });
});

describe("06 — cronograma físico-financeiro", () => {
  it("numeroPci segue a máscara pt-BR (lerNumero)", () => {
    expect(numeroPci("1.000,50")).toBe(1000.5);
    expect(numeroPci("101.000")).toBe(101000);
    expect(numeroPci("25,5")).toBe(25.5);
    expect(numeroPci("1234.56")).toBe(1234.56);
    expect(numeroPci("R$ 1.234,56")).toBe(1234.56);
    expect(numeroPci("")).toBeNull();
  });

  it("faixa 0–100: 101000 (e 101.000 digitado) é rejeitado ao salvar e ao gerar", () => {
    const f = form([25, "101.000" as unknown as number, 100]);
    expect(f.cronograma[1]).toBe(101000);
    const e = errosPci(f, { paraGerar: false });
    expect(e.join(" ")).toMatch(/Etapa 2: 101\.000,00% fora da faixa 0,00% a 100,00%/);
    expect(errosPci(form([25, 100.5]), { paraGerar: false }).join(" ")).toMatch(/Etapa 2/);
    expect(errosPci(form([-1, 100]), { paraGerar: false }).join(" ")).toMatch(/Etapa 1/);
  });

  it("acumulado não pode diminuir; última etapa = 100 (bloqueia só a geração)", () => {
    expect(errosPci(form([30, 20, 100]), { paraGerar: false }).join(" ")).toMatch(/Etapa 2: 20,00% é menor que a etapa 1 \(30,00%\)/);
    const incompleto = form([30, 60, 90]);
    expect(errosPci(incompleto, { paraGerar: false })).toEqual([]);
    expect(errosPci(incompleto, { paraGerar: true }).join(" ")).toMatch(/terminar em 100,00%/);
    expect(errosPci(form([30, null, 100]), { paraGerar: true }).join(" ")).toMatch(/Etapa 2: informe/);
    expect(errosPci(form([30, 60, 100]), { paraGerar: true })).toEqual([]);
  });

  it("incremental = AI(k) − AI(k−1), etapa 0 = pré-executado; nunca soma acumulados; 2 casas", () => {
    const a = analisarCronogramaPci(form([25.333, 50, 75.5, 100], { preExecutado: 10 }));
    expect(a.etapa0).toBe(10);
    expect(a.incrementais).toEqual([15.33, 24.67, 25.5, 24.5]);
    expect(errosPci(form([5, 100], { preExecutado: 10 }), { paraGerar: false }).join(" ")).toMatch(/menor que a etapa 0/);
    expect(errosPci(form([80, 100], { preExecutado: 71 }), { paraGerar: false }).join(" ")).toMatch(/pré-executada.*limite/);
  });

  it("avisos da coluna AX (não bloqueiam): curva lenta/rápida e incremento máximo com pré-executado", () => {
    // faixa 1 (≤ 264.000): etapa 1 lenta 0 / rápida 8; etapa 2 lenta 19
    const semPre = analisarCronogramaPci(form([50, 60, 100]));
    expect(semPre.avisos.map((x) => x.etapa)).toContain(1); // 50 > rápida (8)
    expect(semPre.erros).toEqual([]);
    const comPre = analisarCronogramaPci(form([40, 100], { preExecutado: 10 }));
    expect(comPre.avisos.find((x) => x.etapa === 1)?.mensagem).toMatch(/excede o limite de 23 p\.p\./);
    expect(incrementoMaximoEtapaPci(300000)).toBe(17);
    expect(incrementoMaximoEtapaPci(600000)).toBe(14);
    expect(pendenciasPci(form([50, 60, 100])).some((p) => p.includes("curva rápida"))).toBe(true);
  });

  it("ida e volta na fixture: pré-executado em AS161 e cache da etapa 0 (AI165)", () => {
    const f = form([25, 50, 75, 100], { preExecutado: 10, executor: "Construtora" });
    f.custos = f.custos.map(() => 1000);
    const r = gerarPlanilhaPci(MODELO, "xls", f);
    const p = PastaBiff8.abrir(r.bytes);
    expect(p.ler("Proposta_Constr_Individual", "AS161")).toBe(10);
    expect(p.ler("Proposta_Constr_Individual", "AI165")).toBe(10);
    expect(p.ler("Proposta_Constr_Individual", "AN141")).toBe(18);
    expect(lerFormularioPci(r.bytes).campos.preExecutado).toBe(10);
    expect(lerPci(r.bytes).cronogramaProposto).toEqual([10, 25, 50, 75, 100]);
  });
});

describe("10 — saída .xls, listas (DV) e compatibilidade de versões", () => {
  it("o .xls gerado preserva as 71 validações de dados do modelo", () => {
    const antes = PastaBiff8.abrir(MODELO);
    const depois = PastaBiff8.abrir(gerarPlanilhaPci(MODELO, "xls", form([100])).bytes);
    const total = (p: PastaBiff8) => p.abas.reduce((s, a) => s + p.validacoesDeDados(a.nome).length, 0);
    expect(total(antes)).toBe(71);
    expect(total(depois)).toBe(71);
    const v85 = depois.validacoesDeDados("PLS").find((v) => v.intervalo.startsWith("V85"));
    expect(v85?.opcoes).toHaveLength(21);
  });

  it("mesma versão: sem mudanças; estrutura .xls compatível com a referência", () => {
    const e = lerEstruturaModeloPci(MODELO, "xls");
    const r = compararEstruturasPci({ versao: 1, estrutura: e }, e);
    expect(r.critico).toBe(false);
    expect(r.celulasAlteradas).toEqual([]);
    expect(r.listasAlteradas).toEqual([]);
    expect(xlsCompativelCom(e, { ...e, formato: "xlsm" })).toBe(true);
    const mudou = { ...e, formato: "xlsm" as const, celulas: { ...e.celulas, "Proposta_Constr_Individual!AI166": "formula" as const } };
    expect(xlsCompativelCom(e, mudou)).toBe(false);
    const critico = compararEstruturasPci({ versao: 1, estrutura: e }, mudou);
    expect(critico.critico).toBe(true);
    expect(critico.criticas.join(" ")).toMatch(/AI166 deixou de ser campo de entrada/);
  });

  it(".xlsm: lê dataValidations do XML; aba PLS ausente é mudança crítica", () => {
    const sheet = `<worksheet><sheetData><row r="98"><c r="G98" t="inlineStr"><is><t>x</t></is></c></row><row r="2"><c r="BA2" t="inlineStr"><is><t>Forro</t></is></c></row></sheetData>`
      + `<dataValidations count="2"><dataValidation type="list" allowBlank="1" sqref="O74"><formula1>"Residencial,Comercial"</formula1></dataValidation>`
      + `<dataValidation type="list" sqref="V98:AB98"><formula1>$BA$2:$BA$2</formula1></dataValidation></dataValidations></worksheet>`;
    const xlsm = zipSync({
      "xl/workbook.xml": strToU8(`<workbook xmlns:r="r"><sheets><sheet name="Proposta_Constr_Individual" sheetId="1" r:id="rId1"/></sheets></workbook>`),
      "xl/_rels/workbook.xml.rels": strToU8(`<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`),
      "xl/worksheets/sheet1.xml": strToU8(sheet),
    });
    const v = new PastaXlsx(unzipSync(xlsm)).validacoesDeDados("Proposta_Constr_Individual");
    expect(v).toEqual([
      { aba: "Proposta_Constr_Individual", intervalo: "O74", tipo: 3, opcoes: ["Residencial", "Comercial"], referencia: null, permiteBranco: true },
      { aba: "Proposta_Constr_Individual", intervalo: "V98:AB98", tipo: 3, opcoes: ["Forro"], referencia: "$BA$2:$BA$2", permiteBranco: false },
    ]);
    const e = lerEstruturaModeloPci(xlsm, "xlsm");
    const r = compararEstruturasPci({ versao: 1, estrutura: lerEstruturaModeloPci(MODELO, "xls") }, e);
    expect(r.critico).toBe(true);
    expect(r.abasRemovidas).toContain("PLS");
    expect(r.criticas.join(" ")).toMatch(/aba "PLS" não existe/);
    expect(r.avisos.join(" ")).toMatch(/gerada em \.xls/);
  });
});

describe("08 — PLS: status, acumulados e aferido (recalculados no servidor)", () => {
  const base = lerPci(MODELO);
  const pci = { ...base, incidencias: [100, ...Array(19).fill(0)], dataContratacao: "2026-01-01", valorImovel: 220000, prazoMeses: 6, cronogramaProposto: [0, 10, 25, 45, 65, 85, 100] };
  const ent = (acumulado: number, data: string, anteriores: EntradaMedicaoCaixa["anteriores"] = [], pls: Record<string, unknown> = {}, extra: Partial<EntradaMedicaoCaixa> = {}): EntradaMedicaoCaixa => ({
    tipo: "pls", pci, execucoes: [acumulado, ...Array(19).fill(0)], progresso: acumulado, anteriores,
    dados: { pls: { ...dadosPlsPadrao(), numeroContrato: "123", alvaraVigencia: "2027-12-31", dataLevantamento: data, ...pls }, repactuacao: null, alteracao: null },
    fotos: [], obra: { inicio: "2026-02-01", termino: null }, ...extra,
  });

  it("curvas padrão por faixa e regras de situação", () => {
    expect(faixaCurvaPci(264000)).toBe(1);
    expect(faixaCurvaPci(264000.5)).toBe(2);
    expect(faixaCurvaPci(500001)).toBe(3);
    expect(curvasPadraoPci(null)).toBeNull();
    expect(curvasPadraoPci(200000)!.lenta.slice(0, 4)).toEqual([0, 0, 19, 28]);
    expect(situacaoPropostoPls({ etapa: 2, acumuladoPls: 15, proposto: 25, prazoExtrapolado: false })).toBe("NORMAL");
    expect(situacaoPropostoPls({ etapa: 2, acumuladoPls: 14.9, proposto: 25, prazoExtrapolado: false })).toBe("ATRASADA");
    expect(situacaoPropostoPls({ etapa: 2, acumuladoPls: 35.1, proposto: 25, prazoExtrapolado: false })).toBe("ADIANTADA");
    expect(situacaoPropostoPls({ etapa: 2, acumuladoPls: 50, proposto: 0, prazoExtrapolado: false })).toBe("");
    expect(situacaoCurvaPls({ etapa: 31, adotado: 10, curvas: curvasPadraoPci(200000), prazoExtrapolado: false })).toBe("ATRASADA");
  });

  it("primeira medição (etapa 1): NORMAL nas duas; aferido vazio é sinalizado", () => {
    const s = situacaoDaPls(ent(5, "2026-03-01"));
    expect(s).toMatchObject({ etapa: 1, situacaoCurva: "NORMAL", situacaoProposto: "NORMAL", adotado: 5, acumuladoPls: 5, proposto: 10, pendencias: [] });
    expect(s.avisos.join(" ")).toMatch(/Aferido em branco/);
  });

  it("intermediária atrasada: OBRA LENTA (abaixo da lenta) e ATRASADA (proposto − 10)", () => {
    const s = situacaoDaPls(ent(10, "2026-05-01", [{ data: "2026-03-01", progresso: 5, aferido: true }]));
    expect(s).toMatchObject({ etapa: 3, situacaoCurva: "OBRA LENTA", situacaoProposto: "ATRASADA" });
    expect(s.avisos.join(" ")).not.toMatch(/Aferido em branco/);
  });

  it("adiantada: OBRA RÁPIDA e ADIANTADA", () => {
    expect(situacaoDaPls(ent(40, "2026-04-01"))).toMatchObject({ etapa: 2, situacaoCurva: "OBRA RÁPIDA", situacaoProposto: "ADIANTADA" });
  });

  it("final: 100% na última etapa do prazo → NORMAL", () => {
    expect(situacaoDaPls(ent(100, "2026-08-01", [{ data: "2026-05-01", progresso: 60 }]))).toMatchObject({ etapa: 6, situacaoCurva: "NORMAL", situacaoProposto: "NORMAL" });
  });

  it("reprogramada: fim do contrato = início + etapas repactuadas; depois dele, PRAZO EXTRAPOLADO", () => {
    const dentro = situacaoDaPls(ent(90, "2026-09-01", [], { houveRepactuacao: true, etapasRepactuadas: 8 }));
    expect(dentro).toMatchObject({ etapa: 7, fimContrato: "2026-10-01", prazoExtrapolado: false, situacaoCurva: "NORMAL", situacaoProposto: "" });
    const fora = situacaoDaPls(ent(90, "2026-10-02", [], { houveRepactuacao: true, etapasRepactuadas: 8 }));
    expect(fora).toMatchObject({ situacaoCurva: "PRAZO EXTRAPOLADO", situacaoProposto: "PRAZO EXTRAPOLADO" });
    // sem repactuação: contratação + 24 meses
    expect(situacaoDaPls(ent(90, "2028-01-02")).situacaoCurva).toBe("PRAZO EXTRAPOLADO");
  });

  it("aferido = medição anterior confirmada; adotado usa o aferido; PLS = executado declarado", () => {
    const c = curvaDeEvolucao("2026-02-01", [{ data: "2026-03-01", progresso: 5, aferido: true }, { data: "2026-04-01", progresso: 12 }, { data: "2026-05-01", progresso: 20 }], 6);
    expect(c[1]).toMatchObject({ pls: 5, aferido: 5, adotado: 5 });
    expect(c[2]).toMatchObject({ pls: 12, aferido: null, adotado: 12 });
  });

  it("dados faltando: nunca inventa — situação vazia e PDF com 'pendente'", () => {
    const e = ent(10, "2026-05-01", [], { numeroContrato: null, alvaraVigencia: null }, { obra: { inicio: null, termino: null } });
    e.pci = { ...pci, dataContratacao: null, valorImovel: null };
    const s = situacaoDaPls(e);
    expect(s.situacaoCurva).toBe("");
    expect(s.pendencias).toEqual(expect.arrayContaining(["Nº do contrato", "Data de contratação", "Data de início da obra", "Valor do imóvel", "Vigência do alvará"]));
    const texto = Buffer.from(gerarPdfMedicao(MODELO, e)).toString("latin1");
    expect(texto).toContain("pendente");
  });

  it("execução do item: 0 a 100% em passos de 5%", () => {
    expect(execucaoPlsValida(35)).toBe(true);
    expect(execucaoPlsValida(33)).toBe(false);
    expect(execucaoPlsValida(105)).toBe(false);
    expect(situacaoDaPls(ent(33, "2026-03-01")).avisos.join(" ")).toMatch(/passos de 5%/);
  });
});
