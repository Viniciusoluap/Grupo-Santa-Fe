// Regras da Regularização (EPIC-020, Lote 6, itens 30 e 31).
// Mesmo conteúdo em Prospecta/server/financeiro-regularizacao.test.ts.
import { describe, expect, it } from "vitest";
import {
  ITENS_FINANCEIROS_PADRAO,
  STATUS_PROCESSO,
  calcularFinanceiroRegularizacao,
  mensagemErroRegularizacao,
  progressoDasEtapas,
  reordenarEtapas,
  statusProcessoDeLegado,
  validarEtapa,
} from "@/lib/financeiro/regularizacao";

const itensPadrao = () =>
  ITENS_FINANCEIROS_PADRAO.map((i) => ({ id: i.ordem, nome: i.nome, grupo: i.grupo, ordem: i.ordem, previsto: "0" }));

describe("Status do Processo (item 30)", () => {
  it("tem exatamente Em análise, Em andamento e Concluído", () => {
    expect(STATUS_PROCESSO).toEqual(["em_analise", "em_andamento", "concluido"]);
  });

  it("converte os status antigos dos dois sistemas", () => {
    expect(statusProcessoDeLegado("analysis")).toBe("em_analise");
    expect(statusProcessoDeLegado("analise_inicial")).toBe("em_analise");
    expect(statusProcessoDeLegado("analise")).toBe("em_analise");
    for (const s of ["documentation", "protocol", "registry", "documentacao", "protocolo", "em_analise_orgao", "pendencias", "aprovado", "registrado"])
      expect(statusProcessoDeLegado(s)).toBe("em_andamento");
    expect(statusProcessoDeLegado("completed")).toBe("concluido");
    expect(statusProcessoDeLegado("cancelled")).toBe("cancelado");
    expect(statusProcessoDeLegado("aguardando_configuracao")).toBe("aguardando_configuracao");
  });
});

describe("Etapas do Processo (item 30)", () => {
  it("valida nome e progresso", () => {
    expect(validarEtapa({ nome: "Protocolo na prefeitura", progresso: 50 })).toEqual([]);
    expect(validarEtapa({ nome: " ", progresso: 50 })).toContain("Informe o nome da etapa.");
    expect(validarEtapa({ nome: "Etapa", progresso: 101 }).length).toBe(1);
    expect(validarEtapa({ nome: "Etapa", progresso: 12.5 }).length).toBe(1);
  });

  it("progresso das etapas é a média, independente do status", () => {
    expect(progressoDasEtapas([])).toBeNull();
    expect(progressoDasEtapas([{ progresso: 100 }, { progresso: 50 }, { progresso: 0 }])).toBe(50);
    expect(progressoDasEtapas([{ progresso: 100 }, { progresso: 0 }, { progresso: 0 }])).toBe(33.33);
    expect(progressoDasEtapas([{ progresso: 100 }, { progresso: 100 }, { progresso: 0 }])).toBe(66.67);
  });

  it("reordena sem sair dos limites", () => {
    const etapas = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(reordenarEtapas(etapas, 2, -1).map((e) => e.id)).toEqual([2, 1, 3]);
    expect(reordenarEtapas(etapas, 3, 1).map((e) => e.id)).toEqual([1, 2, 3]);
    expect(reordenarEtapas(etapas, 1, -1).map((e) => e.id)).toEqual([1, 2, 3]);
  });
});

describe("Tabela financeira (item 31)", () => {
  it("tem os 17 itens iniciais na ordem e nos grupos da especificação", () => {
    expect(ITENS_FINANCEIROS_PADRAO).toHaveLength(17);
    expect(ITENS_FINANCEIROS_PADRAO.map((i) => i.nome)).toEqual([
      "Projetos", "PCI", "Impressões", "Água", "Despachante", "Cert. Inteiro Teor", "ART", "Alvará",
      "Vistoria CEF", "Tx Ass CEF", "Seguro CEF", "ITBI", "Registro Cartório", "Encargos de Obra",
      "Habite-se", "CND e CNO", "Averbação",
    ]);
    expect(ITENS_FINANCEIROS_PADRAO.filter((i) => i.grupo === "durante_obra").map((i) => i.ordem)).toEqual(
      Array.from({ length: 14 }, (_, k) => k + 1),
    );
    expect(ITENS_FINANCEIROS_PADRAO.filter((i) => i.grupo === "casa_pronta").map((i) => i.ordem)).toEqual([15, 16, 17]);
  });

  it("Saldo = Previsto − Recebido, com recebimentos parciais, manuais e do BPO", () => {
    const itens = itensPadrao();
    itens[0].previsto = "1500.00"; // Projetos
    itens[11].previsto = "3200.50"; // ITBI
    itens[14].previsto = "800.00"; // Habite-se
    const r = calcularFinanceiroRegularizacao(itens, [
      { itemId: 1, valor: "500.00", status: "confirmado" },
      { itemId: 1, valor: "250.25", status: "confirmado" },
      { itemId: 1, valor: "999.00", status: "cancelado" },
      { itemId: 12, valor: "3200.50", status: "confirmado" },
      { itemId: 15, valor: "900.00", status: "confirmado" },
    ]);
    const projetos = r.linhas.find((l) => l.nome === "Projetos")!;
    expect(projetos).toMatchObject({ previsto: 150000, recebido: 75025, saldo: 74975, recebidoAMaior: false });
    expect(r.linhas.find((l) => l.nome === "ITBI")).toMatchObject({ saldo: 0 });
    expect(r.linhas.find((l) => l.nome === "Habite-se")).toMatchObject({ saldo: -10000, recebidoAMaior: true });
    expect(r.grupos.durante_obra).toEqual({ previsto: 470050, recebido: 395075, saldo: 74975 });
    expect(r.grupos.casa_pronta).toEqual({ previsto: 80000, recebido: 90000, saldo: -10000 });
    expect(r.geral).toEqual({ previsto: 550050, recebido: 485075, saldo: 64975 });
  });

  it("itens novos entram no grupo e na ordem escolhidos", () => {
    const itens = [...itensPadrao(), { id: 99, nome: "Taxa extra", grupo: "casa_pronta", ordem: 18, previsto: "100" }];
    const r = calcularFinanceiroRegularizacao(itens, []);
    expect(r.linhas.at(-1)).toMatchObject({ nome: "Taxa extra", grupo: "casa_pronta", previsto: 10000 });
    expect(r.grupos.casa_pronta.previsto).toBe(10000);
  });

  it("recebimento de item inexistente nunca é somado em silêncio", () => {
    expect(() => calcularFinanceiroRegularizacao(itensPadrao(), [{ itemId: 500, valor: "1", status: "confirmado" }])).toThrow();
  });

  it("traduz as garantias do banco", () => {
    expect(mensagemErroRegularizacao(new Error("BPO_ALOCACAO_EXCEDIDA: disponível R$ 1120.00"))).toContain("Disponível: R$ 1.120,00");
    expect(mensagemErroRegularizacao(new Error("ITEM_COM_RECEBIMENTOS"))).toMatch(/Exclua os recebimentos dele/);
    expect(mensagemErroRegularizacao(new Error("outro"))).toBeNull();
  });
});
