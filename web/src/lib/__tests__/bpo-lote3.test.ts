// Lote 3 (29/10/2026) — BPO itens 12, 13B, 15, 16 e 17: regras puras (mesmos casos da Prospecta, server/bpo-lote3.test.ts).
import { describe, expect, it } from "vitest";
import { categoriaContabilDaOperacional, categoriaNaEdicao, validarOperacaoBpo } from "@/lib/bpo-operacional";
import { montarCandidatos, normalizarTelefone, similaridadeNome, sugerirClientesParaLancamento } from "@/lib/bpo-vinculo-cliente";
import { confirmacaoExclusaoValida, filtrarLancamentosLote, motivosProtecao, validarCombinacao } from "@/lib/bpo-lote";
import { celulasDre, competenciaNoFiltro, dreFiltrado, montarDre } from "@/lib/financeiro/bpo-resultado";

describe("item 12 — categoria contábil derivada da Categoria Operacional", () => {
  it("mapeia as categorias novas e as de obra/cobrança para o enum existente", () => {
    expect(categoriaContabilDaOperacional("despesa", "impostos")).toBe("Impostos");
    expect(categoriaContabilDaOperacional("despesa", "tarifas_bancarias")).toBe("Tarifas bancárias");
    expect(categoriaContabilDaOperacional("despesa", "pro_labore")).toBe("Pró-labore");
    expect(categoriaContabilDaOperacional("despesa", "administrativo")).toBe("Administrativo");
    expect(categoriaContabilDaOperacional("recebimento", "projetos_taxas")).toBe("Projetos e taxas");
    expect(categoriaContabilDaOperacional("recebimento", "outros")).toBe("Outros");
    expect(categoriaContabilDaOperacional("despesa", "obras", "material")).toBe("Material");
    expect(categoriaContabilDaOperacional("despesa", "obras", "mao_de_obra")).toBe("Mão de obra");
    expect(categoriaContabilDaOperacional("despesa", "obras", "Mão de obra")).toBe("Mão de obra");
    expect(categoriaContabilDaOperacional("despesa", "obras", "empreiteiro")).toBe("Mão de obra");
    expect(categoriaContabilDaOperacional("despesa", "obras", "terreno")).toBe("Outros");
    expect(categoriaContabilDaOperacional("recebimento", "obras")).toBe("Recebimento de cliente");
    expect(categoriaContabilDaOperacional("recebimento", "financiamentos")).toBe("Financiamento/CAIXA");
    expect(categoriaContabilDaOperacional("despesa", "regularizacoes")).toBe("Outros");
  });

  it("novas categorias não exigem (nem aceitam) vínculo; as antigas continuam exigindo", () => {
    for (const c of ["projetos_taxas", "impostos", "tarifas_bancarias", "pro_labore", "administrativo", "outros"]) {
      expect(() => validarOperacaoBpo({ tipo: "despesa", categoriaOperacional: c })).not.toThrow();
      expect(() => validarOperacaoBpo({ tipo: "recebimento", categoriaOperacional: c })).not.toThrow();
      expect(() => validarOperacaoBpo({ tipo: "despesa", categoriaOperacional: c, vinculoOperacionalId: "1" })).toThrow();
    }
    expect(() => validarOperacaoBpo({ tipo: "despesa", categoriaOperacional: "regularizacoes" })).toThrow(/registro operacional/);
    for (const proibida of ["recebimento_cliente", "financiamento_caixa", "material", "mao_de_obra"]) {
      expect(() => validarOperacaoBpo({ tipo: "despesa", categoriaOperacional: proibida })).toThrow(/válida/);
    }
  });

  it("edição preserva a categoria gravada e só recalcula quando a operacional muda", () => {
    const antes = { categoria: "Tarifas bancárias", categoriaOperacional: null, tipoDespesaObra: null };
    expect(categoriaNaEdicao("despesa", antes, { categoriaOperacional: null })).toBe("Tarifas bancárias");
    expect(categoriaNaEdicao("despesa", antes, { categoriaOperacional: "impostos" })).toBe("Impostos");
    const obra = { categoria: "Material", categoriaOperacional: "obras", tipoDespesaObra: "material" };
    expect(categoriaNaEdicao("despesa", obra, { categoriaOperacional: "obras", tipoDespesaObra: "material" })).toBe("Material");
    expect(categoriaNaEdicao("despesa", obra, { categoriaOperacional: "obras", tipoDespesaObra: "mao_de_obra" })).toBe("Mão de obra");
  });
});

describe("item 17 — sugestão de vínculo (regra pura)", () => {
  const candidatos = montarCandidatos(
    [{ id: 1, razaoSocial: "Maria Souza", cpf: "123.456.789-00", telefone: "(91) 98888-7777", leadId: 10 }, { id: 2, razaoSocial: "Fornecedor X", cnpj: "11.222.333/0001-44", telefone: "" }],
    [{ id: 10, nome: "Maria Souza", cpf: "12345678900", telefone: "91988887777" }, { id: 11, nome: "João Lima", telefone: "+55 91 3222-1111" }, { id: 12, nome: "Joao Lima", telefone: "91 3222-1111" }],
  );

  it("normaliza telefone e similaridade de nome", () => {
    expect(normalizarTelefone("+55 (91) 98888-7777")).toBe("91988887777");
    expect(normalizarTelefone("123")).toBe("");
    expect(similaridadeNome("José da Silva", "Jose Silva")).toBe(1);
    expect(similaridadeNome("Maria Souza", "Mario Sousa")).toBeLessThan(0.9);
  });

  it("vínculo automático só com exatamente um candidato forte (CPF único)", () => {
    const r = sugerirClientesParaLancamento({ nome: "Maria S.", textos: ["Pix Maria 123.456.789-00"] }, candidatos);
    expect(r.automatico?.candidato).toMatchObject({ chave: "l:10", clienteId: "1" });
    expect(r.automatico?.motivos).toContain("documento");
  });

  it("ID interno (lead do registro operacional) tem prioridade máxima", () => {
    const r = sugerirClientesParaLancamento({ leadIds: ["11"], nome: "Maria Souza" }, candidatos);
    expect(r.sugestoes[0]).toMatchObject({ prioridade: 1, grau: "forte" });
    expect(r.automatico?.candidato.leadId).toBe("11");
  });

  it("telefone em dois leads é ambíguo: nada automático", () => {
    const r = sugerirClientesParaLancamento({ nome: "Cliente", textos: ["(91) 3222-1111"] }, candidatos);
    expect(r.sugestoes.filter(s => s.grau === "forte")).toHaveLength(2);
    expect(r.automatico).toBeNull();
    expect(r.ambiguo).toBe(true);
  });

  it("nome parecido sozinho nunca vincula automaticamente", () => {
    const r = sugerirClientesParaLancamento({ nome: "MARIA SOUZA" }, candidatos);
    expect(r.sugestoes[0]).toMatchObject({ grau: "media", motivos: ["nome"] });
    expect(r.automatico).toBeNull();
  });
});

describe("itens 13B e 16 — confirmação, proteção, filtros e combinação (regras puras)", () => {
  it("EXCLUIR é case-sensitive e sem acento", () => {
    expect(confirmacaoExclusaoValida("EXCLUIR")).toBe(true);
    expect(confirmacaoExclusaoValida(" EXCLUIR ")).toBe(true);
    for (const x of ["excluir", "Excluir", "EXCLUÍR", "", null]) expect(confirmacaoExclusaoValida(x)).toBe(false);
  });

  it("protegidos: Asaas, extrato, baixa, obra, regularização e combinação", () => {
    expect(motivosProtecao({})).toEqual([]);
    expect(motivosProtecao({ asaasPaymentId: "pay", transacaoBancaria: 3, valorRecebido: "10", movimentosObra: 1, recebimentosRegularizacao: 1, combinadaEmId: 9 }))
      .toEqual(["asaas", "extrato", "baixa", "obra", "regularizacao", "combinada"]);
    expect(motivosProtecao({ pago: true })).toEqual(["baixa"]);
  });

  it("filtros da aba aplicados no servidor (mês, ano, status, busca)", () => {
    const agora = new Date("2026-10-15T12:00:00Z");
    const base = { tipo: "honorario", clienteId: 1, clienteNome: "Ana", descricao: "Honorário", pago: false, valorRecebido: 0 };
    const itens = [
      { ...base, id: 1, competencia: "2026-09", vencimento: "2026-09-10" },
      { ...base, id: 2, competencia: "2026-10", vencimento: "2026-10-30" },
      { ...base, id: 3, competencia: "2026-10", vencimento: "2026-10-01", pago: true },
    ];
    expect(filtrarLancamentosLote(itens, { mes: "10", ano: "2026" }, agora).map(i => i.id)).toEqual([2, 3]);
    expect(filtrarLancamentosLote(itens, { status: "vencidas" }, agora).map(i => i.id)).toEqual([1]);
    expect(filtrarLancamentosLote(itens, { status: "pendentes" }, agora).map(i => i.id)).toEqual([2]);
    expect(filtrarLancamentosLote(itens, { busca: "bia" }, agora)).toEqual([]);
  });

  it("combinação válida soma em centavos, vence no mais próximo e lista as originais", () => {
    const base = { tipo: "receita", clienteId: 5, pago: false, competencia: "2026-10", categoria: "Recebimento de cliente" };
    const r = validarCombinacao([
      { ...base, id: 1, descricao: "Parcela A", valor: "100.10", vencimento: "2026-11-10" },
      { ...base, id: 2, descricao: "Parcela B", valor: "200.20", vencimento: "2026-10-20", competencia: "2026-09" },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.total).toBe(300.3);
    expect(r.vencimento.toISOString().slice(0, 10)).toBe("2026-10-20");
    expect(r.competencia).toBe("2026-09");
    expect(r.descricao).toMatch(/#2 Parcela B.*#1 Parcela A/);
    expect(r.categoria).toBe("Recebimento de cliente");
  });

  it("combinação bloqueada: clientes diferentes, Asaas, extrato ou já paga", () => {
    const base = { tipo: "receita", clienteId: 5, pago: false, competencia: "2026-10", descricao: "x", valor: 1, vencimento: "2026-10-10" };
    const r = validarCombinacao([{ ...base, id: 1 }, { ...base, id: 2, clienteId: 6, asaasPaymentId: "pay_1" }, { ...base, id: 3, transacaoBancaria: 9 }, { ...base, id: 4, pago: true }]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erros).toContain("As cobranças precisam ser do mesmo cliente.");
    expect(r.bloqueados.map(b => b.id)).toEqual([2, 3, 4]);
    expect(validarCombinacao([{ ...base, id: 1 }]).ok).toBe(false);
  });
});

describe("item 15 — filtro Mês/Ano do DRE", () => {
  const lancs = [
    { competencia: "2026-09", tipo: "recebimento", valor: 100, pago: false, categoria: "Recebimento de cliente" },
    { competencia: "2026-10", tipo: "recebimento", valor: 50.25, pago: false, categoria: "Recebimento de cliente" },
    { competencia: "2026-10", tipo: "despesa", valor: 20, pago: false, categoria: "Impostos" },
    { competencia: "2025-10", tipo: "despesa", valor: 7, pago: false, categoria: "Outros" },
    { competencia: "2026-10", tipo: "despesa", valor: 999, pago: false, categoria: "Transferência interna" },
  ];
  it("filtra por competência nas duas visões; vazio = todos", () => {
    expect(competenciaNoFiltro("2026-10", { mes: "10" })).toBe(true);
    expect(competenciaNoFiltro("2026-10", { ano: "2025" })).toBe(false);
    expect(montarDre(lancs)).toHaveLength(3);
    expect(montarDre(lancs, { mes: "10", ano: "2026" })).toEqual([{ competencia: "2026-10", receitas: 50.25, despesas: 20, resultado: 30.25 }]);
    const celulas = celulasDre(lancs);
    expect(dreFiltrado(celulas, {}).porCompetencia).toEqual(montarDre(lancs));
    expect(dreFiltrado(celulas, { mes: "10" }).porCompetencia.map((l) => l.competencia)).toEqual(["2026-10", "2025-10"]);
    expect(dreFiltrado(celulas, { ano: "2026" }).porCategoria.map((c) => [c.categoria, c.resultado])).toEqual([["Recebimento de cliente", 150.25], ["Impostos", -20]]);
  });
});
