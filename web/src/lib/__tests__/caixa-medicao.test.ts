import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PastaBiff8 } from "../caixa/biff8";
import { imagensDaAba } from "../caixa/biff8-imagens";
import { lerPci } from "../caixa/pci";
import { calcularAlteracao, calcularPls, dias360, etapaDaData, gerarXlsMedicao, localEData, somarMeses, type EntradaMedicaoCaixa } from "../caixa/medicao-xls";
import { gerarPdfMedicao } from "../caixa/medicao-pdf";
import { calcularProgresso, SERVICOS_PROGRESSO } from "../financeiro/progresso";
import {
  dadosAlteracaoPadrao,
  dadosPlsPadrao,
  dadosRepactuacaoPadrao,
  normalizarDadosMedicao,
  validarDadosMedicao,
} from "../medicao-caixa";

// Pedido de 18/10 — PCI/PLS da CAIXA. O modelo de teste é uma PCI real com os
// dados pessoais trocados por fictícios e as fotos removidas.
const MODELO = new Uint8Array(readFileSync(new URL("../caixa/__fixtures__/pci-modelo-anonimo.xls", import.meta.url)));

// JPEG 2×1 válido (gerado uma vez com sharp), para testar as fotos.
const JPEG = new Uint8Array(Buffer.from(
  "/9j/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAABAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAL/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAABf/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJAFmX//2Q==",
  "base64",
));

function entradaPls(): EntradaMedicaoCaixa {
  const pci = lerPci(MODELO);
  return {
    tipo: "pls",
    pci,
    execucoes: [100, 100, 50, 50, 0, 0, 0, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    progresso: 29.35,
    anteriores: [{ data: "2026-06-25", progresso: 10.1 }],
    dados: { pls: { ...dadosPlsPadrao({ alvaraEmissao: pci.alvaraEmissao, alvaraVigencia: pci.alvaraVigencia }), dataLevantamento: "2026-08-25", observacoes: "Obra em andamento normal." }, repactuacao: null, alteracao: null },
    fotos: [
      { dados: JPEG, tipo: "jpeg", legenda: "Fundação" },
      { dados: JPEG, tipo: "jpeg", legenda: null },
    ],
  };
}

describe("PCI da CAIXA", () => {
  it("lê as incidências exatas da 1ª aba (total fecha 100%)", () => {
    const pci = lerPci(MODELO);
    expect(pci.formato).toBe("xls");
    expect(pci.incidencias).toHaveLength(20);
    expect(pci.incidencias[1]).toBe(6.99999622399988);
    expect(pci.incidencias[0]).toBe(3.10000169920005);
    expect(Math.abs(pci.incidencias.reduce((s, v) => s + v, 0) - 100)).toBeLessThan(1e-9);
  });

  it("lê identificação, contrato, datas, cronograma e curvas", () => {
    const pci = lerPci(MODELO);
    expect(pci.identificacao.proponente).toBe("PROPONENTE DE TESTE");
    expect(pci.identificacao.rteCpf).toBe("000.000.001-91");
    expect(pci.identificacao.cep).toBe("65900-000");
    expect(pci.identificacao.municipio).toBe("IMPERATRIZ");
    expect(pci.dataContratacao).toBe("2026-04-24");
    expect(pci.prazoMeses).toBe(6);
    expect(pci.valorImovel).toBe(220000);
    expect(pci.cronogramaProposto.slice(0, 7)).toEqual([0, 20, 30, 40, 60, 80, 100]);
    expect(pci.curvaLenta[3]).toBe(28);
    expect(pci.curvaNormal[3]).toBe(39);
  });

  it("recusa arquivo que não é planilha da CAIXA", () => {
    expect(() => lerPci(new Uint8Array([1, 2, 3, 4]))).toThrow(/\.xls ou \.xlsb/);
  });

  it("incidências da PCI passam no cálculo de progresso sem erro e completas", () => {
    const pci = lerPci(MODELO);
    const itens = SERVICOS_PROGRESSO.map((s, k) => ({ chave: s.chave, incidencia: String(pci.incidencias[k]), execucao: "100" }));
    const r = calcularProgresso(itens);
    expect(r.erros).toEqual([]);
    expect(r.distribuicaoCompleta).toBe(true);
    expect(r.progresso).toBeCloseTo(100, 9);
  });

  it("Execução do Item continua limitada a 4 casas", () => {
    const itens = SERVICOS_PROGRESSO.map((s) => ({ chave: s.chave, incidencia: "5", execucao: s.chave === "pisos" ? "10.12345" : "0" }));
    expect(calcularProgresso(itens).erros.join(" ")).toContain("casas decimais");
  });
});

describe("datas e etapas no padrão do modelo", () => {
  it("DAYS360, etapa, mês de referência e local e data", () => {
    expect(dias360("2026-05-24", "2026-08-25")).toBe(91);
    expect(etapaDaData("2026-05-24", "2026-08-25")).toBe(3);
    expect(somarMeses("2026-05-24", 6)).toBe("2026-11-24");
    expect(somarMeses("2026-01-31", 1)).toBe("2026-02-28");
    expect(localEData("IMPERATRIZ", "2026-08-24")).toBe("Imperatriz 24 de agosto de 2026");
    expect(localEData("SAO JOSE DE RIBAMAR", "2026-01-05")).toBe("Sao Jose de Ribamar 5 de janeiro de 2026");
  });

  it("calcula a PLS como a planilha (Silmara: 29,35% na etapa 3, término 24/11/2026)", () => {
    const r = calcularPls(entradaPls());
    expect(r.acumulado).toBeCloseTo(29.3499993392, 9); // mesmo valor da planilha (Y105)
    expect(r.anterior).toBe(10.1);
    expect(r.executadoEtapa).toBeCloseTo(19.2499993392, 9);
    expect(r.etapa).toBe(3);
    expect(r.termino).toBe("2026-11-24");
  });
});

describe("gerar .xls da medição", () => {
  it("PLS: preenche só os campos do modelo e mantém o arquivo legível", () => {
    const xls = gerarXlsMedicao(MODELO, entradaPls());
    const p = PastaBiff8.abrir(xls);
    expect(p.abas.map((a) => a.nome)).toContain("PLS");
    expect(p.ler("PLS", "V87")).toBe(0.5);
    expect(p.ler("PLS", "V89")).toBe(null);
    expect(p.ehFormula("PLS", "Y87")).toBe(true);
    expect(p.ler("PLS", "Y105") as number).toBeCloseTo(29.3499993392, 9);
    expect(p.ler("PLS", "Y106")).toBe(10.1);
    expect(p.ler("PLS", "AF96")).toBe(10.1);
    expect(p.ler("PLS", "AF98")).toBe(29.35);
    expect(p.ler("PLS", "AN82")).toBe("não");
    expect(p.ler("PLS", "G113")).toBe("Obra em andamento normal.");
    expect(p.ler("PLS", "H301")).toBe("Imperatriz 25 de agosto de 2026");
    expect(p.ler("PLS", "G212")).toBe("Fundação");
    expect(p.ler("PLS", "AC212")).toBe("Descrever foto");
    // fórmulas e dados da proposta intactos
    expect(p.ler("Proposta_Constr_Individual", "X121")).toBe(6.99999622399988);
    expect(p.ehFormula("PLS", "S85")).toBe(true);
    // todas as abas continuam abrindo depois da mudança de tamanho dos registros
    for (const a of p.abas) expect(() => p.ler(a.nome, "A1")).not.toThrow();
  });

  it("PLS: fotos entram nos quadros do relatório fotográfico", () => {
    const p = PastaBiff8.abrir(gerarXlsMedicao(MODELO, entradaPls()));
    const fotos = imagensDaAba(p, "PLS").filter((i) => i.linha1 >= 196 && i.linha2 - i.linha1 >= 5);
    expect(fotos).toHaveLength(2);
    expect(fotos[0].imagem.tipo).toBe("jpeg");
    expect(Buffer.from(fotos[0].imagem.dados).equals(Buffer.from(JPEG))).toBe(true);
    expect(fotos[0].linha1).toBeGreaterThanOrEqual(197);
    expect(fotos[0].linha2).toBeLessThanOrEqual(210);
  });

  it("Repactuação: datas, prazos, % real e proposto, motivo", () => {
    const e = entradaPls();
    const rep = { ...dadosRepactuacaoPadrao(6), dataRepactuacao: "2026-10-18", prazoProposto: 9, acumuladoProposto: [null, null, null, null, null, 55, 65, 80, 100], motivo: "Chuvas." };
    const p = PastaBiff8.abrir(gerarXlsMedicao(MODELO, { ...e, tipo: "repactuacao", dados: { ...e.dados, repactuacao: rep } }));
    const A = "Repactuação_Prazo";
    expect(p.ler(A, "X57")).toBe(6);
    expect(p.ler(A, "X59")).toBe(9);
    expect(p.ler(A, "O66")).toBe(40);
    expect(p.ler(A, "S66")).toBe(29.35);
    expect(p.ler(A, "AT69")).toBe(65);
    expect(p.ler(A, "G138")).toBe("Chuvas.");
  });

  it("Alteração: custos, BDI, adicionais e incidências calculadas", () => {
    const e = entradaPls();
    const alt = { ...dadosAlteracaoPadrao(), justificativa: "Troca de telha por laje.", custos: Array.from({ length: 19 }, () => 1000), bdi: 18, adicionais: [{ descricao: "Muro", custo: 1000 }] };
    const r = calcularAlteracao(alt);
    expect(r.total).toBe(20000);
    expect(r.incidencias[0]).toBe(5);
    expect(r.acumulados[19]).toBeCloseTo(100, 9);
    expect(r.totalComBdi).toBe(23600);
    const p = PastaBiff8.abrir(gerarXlsMedicao(MODELO, { ...e, tipo: "alteracao", dados: { ...e.dados, alteracao: alt } }));
    const A = "Alteração_Projeto_Especific";
    expect(p.ler(A, "G59")).toBe("Troca de telha por laje.");
    expect(p.ler(A, "AB98")).toBe(1000);
    expect(p.ler(A, "X119")).toBe(18);
    expect(p.ler(A, "I127")).toBe("Muro");
    expect(p.ler(A, "AB120")).toBe(23600);
  });
});

describe("PDF da medição", () => {
  it.each(["pls", "repactuacao", "alteracao"] as const)("gera o PDF (%s)", (tipo) => {
    const e = entradaPls();
    const dados = {
      ...e.dados,
      repactuacao: tipo === "repactuacao" ? { ...dadosRepactuacaoPadrao(6), prazoProposto: 9, motivo: "Chuvas." } : null,
      alteracao: tipo === "alteracao" ? { ...dadosAlteracaoPadrao(), justificativa: "Laje." } : null,
    };
    const pdf = gerarPdfMedicao(MODELO, { ...e, tipo, dados });
    const texto = Buffer.from(pdf).toString("latin1");
    expect(texto.startsWith("%PDF")).toBe(true);
    expect((texto.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});

describe("campos da medição CAIXA", () => {
  it("PLS padrão é válida; repactuação e alteração exigem justificativa", () => {
    const pls = dadosPlsPadrao();
    expect(validarDadosMedicao("pls", { pls, repactuacao: null, alteracao: null })).toEqual([]);
    expect(validarDadosMedicao("repactuacao", { pls, repactuacao: dadosRepactuacaoPadrao(6), alteracao: null }).join(" ")).toMatch(/Prazo proposto|motivo/);
    expect(validarDadosMedicao("alteracao", { pls, repactuacao: null, alteracao: dadosAlteracaoPadrao() }).join(" ")).toMatch(/justificativa/);
  });

  it("normaliza a entrada do formulário e barra opções fora da lista", () => {
    const d = normalizarDadosMedicao("alteracao", { pls: { dataLevantamento: "2026-08-25" }, alteracao: { justificativa: "x", executor: "Hacker", custos: ["1.000,50"] } });
    expect(d.alteracao?.custos).toHaveLength(19);
    expect(validarDadosMedicao("alteracao", d).join(" ")).toMatch(/Executor/);
    const ruim = normalizarDadosMedicao("pls", { pls: { dataLevantamento: "25/08/2026" } });
    expect(validarDadosMedicao("pls", ruim).join(" ")).toMatch(/levantamento/);
  });
});

import { incidenciasCorrespondem } from "../medicao-caixa";
it("não exporta incidências diferentes da PCI nem aceita serviços repetidos", () => {
  const chaves = SERVICOS_PROGRESSO.map(s => s.chave);
  const itens = SERVICOS_PROGRESSO.map(s => ({ chave: s.chave, incidencia: s.incidenciaPadrao }));
  const pesos = itens.map(i => Number(i.incidencia));
  expect(incidenciasCorrespondem([...itens].reverse(), chaves, pesos)).toBe(true);
  expect(incidenciasCorrespondem(itens.map((i,k) => k === 0 ? { ...i, incidencia: "99" } : i), chaves, pesos)).toBe(false);
  expect(incidenciasCorrespondem([...itens.slice(1), itens[1]], chaves, pesos)).toBe(false);
});
