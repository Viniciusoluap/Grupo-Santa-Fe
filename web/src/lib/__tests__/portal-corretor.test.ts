import { describe, expect, it } from "vitest";
import { etapaParaCorretor, ETAPAS_ACOMPANHAMENTO, tiposDoCadastro } from "@/lib/portal-corretor";
import { dinheiroParaCampo, mascararDinheiro } from "@/lib/utils";

// Pedido de 15/10 — acesso do corretor. Mesmos cenários de
// server/broker-portal.test.ts e server/numero-input.test.ts da Prospecta.
describe("acesso do corretor", () => {
  it("tipos: corretor só marca as 5 opções; equipe vê todas", () => {
    expect(tiposDoCadastro("corretor").map((t) => t.label)).toEqual(["Casa", "Apartamento", "Lote", "Sala comercial", "Galpão"]);
    expect(tiposDoCadastro("admin").map((t) => t.value)).toContain("chacara");
  });

  it("etapa do lead na régua das 7 etapas do CRM", () => {
    expect(ETAPAS_ACOMPANHAMENTO.map((e) => e.nome)).toEqual([
      "Lead Novo", "Em Atendimento", "Aprovado e Follow up", "Projetos e Vistorias", "Contratos e Cartório", "Medições", "Finalizado",
    ]);
    expect(etapaParaCorretor({ etapaOperacional: "contratos_cartorio", status: "novo" })).toEqual({ nome: "Contratos e Cartório", indice: 4 });
    expect(etapaParaCorretor({ etapaOperacional: null, status: "novo" })).toEqual({ nome: "Lead Novo", indice: 0 });
    expect(etapaParaCorretor({ etapaOperacional: null, status: "proposta" })).toEqual({ nome: "Em classificação", indice: -1 });
  });
});

describe("dinheiro no padrão 1.000.000,00", () => {
  it("põe os pontos de milhar enquanto digita", () => {
    expect(mascararDinheiro("180000")).toEqual({ texto: "180.000", numero: 180000 });
    expect(mascararDinheiro("1.000.0005")).toEqual({ texto: "10.000.005", numero: 10000005 });
    expect(mascararDinheiro("1000000,999")).toEqual({ texto: "1.000.000,99", numero: 1000000.99 });
    expect(mascararDinheiro("1.500.")).toEqual({ texto: "1.500,", numero: 1500 });
    expect(mascararDinheiro("")).toEqual({ texto: "", numero: 0 });
  });
  it("ao sair do campo: duas casas", () => {
    expect(dinheiroParaCampo(1000000)).toBe("1.000.000,00");
    expect(dinheiroParaCampo(0)).toBe("");
  });
});
