import { describe, expect, it } from "vitest";
import {
  dadosClienteDoLead,
  gerarNumeroAvaliacao,
  incluirServico,
  moduloDoServico,
  normalizarTipoFinanciamento,
  parseFalhasServicos,
  parseServicosLead,
  rotaDetalheLead,
  servicoDoModulo,
  SERVICOS_LEAD,
} from "../crm/servicos-lead";

describe("moduloDoServico", () => {
  it("mapeia cada serviço operacional para o módulo real", () => {
    expect(moduloDoServico("Obra e reforma")?.modulo).toBe("obra");
    expect(moduloDoServico("Projeto de engenharia")?.modulo).toBe("projeto");
    expect(moduloDoServico("Regularização imobiliária")?.modulo).toBe("regularizacao");
    expect(moduloDoServico("Avaliação de imóvel")?.modulo).toBe("avaliacao");
    expect(moduloDoServico("Financiamento MCMV")).toMatchObject({ modulo: "financiamento", tipoFinanciamento: "mcmv" });
    expect(moduloDoServico("Financiamento Convencional")).toMatchObject({ modulo: "financiamento", tipoFinanciamento: "sbpe" });
  });

  it("serviços só de CRM não geram registro operacional", () => {
    for (const s of ["Compra de imóvel", "Venda de imóvel", "Locação", "Compra de lote", "Outro"]) {
      expect(moduloDoServico(s)).toBeNull();
    }
  });

  it("todo serviço operacional volta para um serviço da lista do lead", () => {
    for (const s of SERVICOS_LEAD) {
      const op = moduloDoServico(s);
      if (op) expect(servicoDoModulo(op.modulo, op.tipoFinanciamento)).toBe(s);
    }
  });
});

describe("parseServicosLead", () => {
  it("lê JSON, string legada e valores vazios", () => {
    expect(parseServicosLead('["A","B"]')).toEqual(["A", "B"]);
    expect(parseServicosLead("Locação")).toEqual(["Locação"]);
    expect(parseServicosLead("")).toEqual([]);
    expect(parseServicosLead(null)).toEqual([]);
    expect(parseServicosLead('["", 3, "X"]')).toEqual(["X"]);
  });
});

describe("normalizarTipoFinanciamento", () => {
  it("normaliza tipos gravados pelo cadastro antigo", () => {
    expect(normalizarTipoFinanciamento("MCMV")).toBe("mcmv");
    expect(normalizarTipoFinanciamento("Convencional")).toBe("sbpe");
    expect(normalizarTipoFinanciamento("pro_cotista")).toBe("pro_cotista");
    expect(servicoDoModulo("financiamento", "pro_cotista")).toBe("Financiamento (pro_cotista)");
  });
});

describe("dadosClienteDoLead", () => {
  it("copia nome, telefone e e-mail do lead (sem recadastro)", () => {
    expect(dadosClienteDoLead({ nome: " Ana ", telefone: "94999990000", email: "" })).toEqual({
      clienteNome: "Ana",
      clienteTel: "94999990000",
      clienteEmail: null,
    });
    expect(dadosClienteDoLead({ nome: "Ana", telefone: "1", email: "a@b.com" }).clienteEmail).toBe("a@b.com");
  });
});

describe("incluirServico", () => {
  it("inclui sem duplicar", () => {
    expect(incluirServico(["Locação"], "Obra e reforma")).toEqual(["Locação", "Obra e reforma"]);
    expect(incluirServico(["Obra e reforma"], "Obra e reforma")).toBeNull();
  });
});

describe("gerarNumeroAvaliacao", () => {
  it("segue o formato AVL-AAAAMM-NNNN", () => {
    expect(gerarNumeroAvaliacao(new Date(2026, 9, 11), 0)).toBe("AVL-202610-1000");
    expect(gerarNumeroAvaliacao(new Date(2026, 0, 1), 0.9999)).toMatch(/^AVL-202601-\d{4}$/);
  });
});

describe("aviso de falha na sincronização (Achado 2 — Codex, PR #156)", () => {
  it("monta a rota do lead com os módulos que falharam", () => {
    expect(rotaDetalheLead("L1")).toBe("/admin/leads/L1");
    expect(rotaDetalheLead("L1", [])).toBe("/admin/leads/L1");
    expect(rotaDetalheLead("L1", ["avaliacao"])).toBe("/admin/leads/L1?falhaServicos=avaliacao");
  });

  it("ida e volta: o que a action grava a página lê", () => {
    const url = new URL(rotaDetalheLead("L1", ["avaliacao", "financiamento"]), "http://x");
    expect(parseFalhasServicos(url.searchParams.get("falhaServicos"))).toEqual(["avaliacao", "financiamento"]);
  });

  it("ignora valores desconhecidos, vazios e duplicados", () => {
    expect(parseFalhasServicos(undefined)).toEqual([]);
    expect(parseFalhasServicos("")).toEqual([]);
    expect(parseFalhasServicos("obra,toString,obra,<script>")).toEqual(["obra"]);
    expect(parseFalhasServicos(["projeto", "regularizacao"])).toEqual(["projeto", "regularizacao"]);
  });
});
