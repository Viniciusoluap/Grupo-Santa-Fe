// Paridade BPO (13/11) com a Prospecta: regras puras do Conta Azul, "A classificar", dividir pagamentos, centros de
// custo e filtros (mesmos cenários de Prospecta/server/bpo-conta-azul.test.ts e bpo-a-classificar.test.ts, com ids
// texto). CSVs sintéticos; nada de banco nem rede.
import { describe, expect, it } from "vitest";
import { BACKUP, CAB_FIN, FINANCEIRO } from "./fixtures/conta-azul-sintetico";
import {
  categoriaDoContaAzul, conciliarComContaAzul, dataContaAzul, lerBackupContaAzul, observacoesDoMovimento, parseCsv,
  receitaEmAbertoDoContaAzul, valorContaAzul,
} from "@/lib/financeiro/conta-azul";
import { chaveAlocacao, resultadoDaBaixa, sentidoCompativel, sugestoesDeBaixa, validarDivisao } from "@/lib/financeiro/bpo-a-classificar";
import { FILTROS_VAZIOS, algumFiltro, filtrarClientes, filtrarMovimentacoes, filtrarPorCentro, filtrosDoLote, numeroDoCampo, resumoDosLancamentos } from "@/lib/financeiro/bpo-filtros";
import { filtrarLancamentosLote } from "@/lib/bpo-lote";
import { centrosDoLancamento, centrosUsados, chaveCentro, lancamentoNoCentro, renomearCentroNoTexto } from "@/lib/financeiro/centros-custo";
import { celulasDre, dreFiltrado } from "@/lib/financeiro/bpo-resultado";

describe("leitura do backup do Conta Azul", () => {
  it("CSV com aspas, vírgula e quebra dentro do campo, BOM e CRLF", () => {
    expect(parseCsv('﻿a,b\r\n"x, y","linha\num ""aspas"""\r\n')).toEqual([["a", "b"], ["x, y", 'linha\num "aspas"']]);
  });
  it("valores e datas no formato do backup (e o brasileiro, por garantia)", () => {
    expect(valorContaAzul("1234.5")).toBe("1234.50");
    expect(valorContaAzul("1.234,56")).toBe("1234.56");
    expect(valorContaAzul("-10")).toBeNull();
    expect(dataContaAzul("2026-02-30")).toBeNull();
    expect(dataContaAzul("05/03/2026")).toBe("2026-03-05");
  });
  it("a categoria do Conta Azul manda; transferência entre empresas fica fora", () => {
    expect(categoriaDoContaAzul("Pró-labore", "", "despesa")).toBe("Pró-labore");
    expect(categoriaDoContaAzul("Mão de obra", "medição caixa", "despesa")).toBe("Mão de obra");
    expect(categoriaDoContaAzul("Receitas de Serviços", "", "receita")).toBe("Recebimento de cliente");
    expect(categoriaDoContaAzul("Aporte de Capital", "", "receita")).toBe("Outros");
    expect(categoriaDoContaAzul("Despesas a identificar", "tarifa pix", "despesa")).toBe("Tarifas bancárias");
    expect(categoriaDoContaAzul("Tarifas de Notificação", "", "despesa")).toBe("Tarifas bancárias");
    expect(categoriaDoContaAzul("Multas de Trânsito", "", "despesa")).toBe("Administrativo");
    expect(categoriaDoContaAzul("(+) Empréstimo entre empresas do grupo", "", "receita")).toBe("Transferência interna");
  });
  it("lê pessoas e financeiro, junta a linha repetida por centro de custo e lista o que fica de fora", () => {
    const b = lerBackupContaAzul(BACKUP);
    expect(b.pessoas.map((p) => [p.papel, p.cpf ?? p.cnpj])).toEqual([["Cliente", "11122233344"], ["Cliente", "11222333000144"], ["Fornecedor", "55666777000188"], ["Vendedor", null]]);
    expect(b.movimentos).toHaveLength(4);
    const contador = b.movimentos.find((m) => m.valor === "709.00")!;
    expect(contador.centrosCusto).toEqual(["Santa Fe Canaa", "Santa Fe Parauapebas"]);
    expect(b.repetidasPorCentro).toBe(1);
    expect(b.transferencias).toEqual({ quantidade: 1, total: "5000.00" });
    expect(b.erros).toEqual([expect.stringMatching(/linha 8: valor "abc" inválido/)]);
    expect(b.outrosArquivos).toEqual([{ arquivo: "produtos.csv", linhas: 1 }]);
    expect(new Set(b.movimentos.map((m) => m.chave)).size).toBe(4);
    expect(observacoesDoMovimento(b.movimentos[0])).toMatch(/Importado do Conta Azul.*Forma de pagamento: Pix/);
    // a chave não depende da ordem das linhas no arquivo
    const invertido = lerBackupContaAzul({ ...BACKUP, "financeiro.csv": [CAB_FIN, ...FINANCEIRO.split("\r\n").slice(1).reverse()].join("\n") });
    expect(invertido.movimentos.map((m) => m.chave).sort()).toEqual(b.movimentos.map((m) => m.chave).sort());
  });
  it("arquivo que não é backup do Conta Azul", () => {
    expect(lerBackupContaAzul({ "outro.csv": "a,b\n1,2" }).erros[0]).toMatch(/não parece um backup/);
    expect(lerBackupContaAzul({ "financeiro.csv": "id,valor\n1,2" }).erros[0]).toMatch(/sem as colunas/);
  });
});

describe("conciliação com o extrato (regra)", () => {
  // Santa Fé: o lançamento da receita é "recebimento" (também vale "honorario"/"reembolso"); despesa = "despesa"/"despesa_*".
  const ca = [
    { id: "l10", tipo: "despesa", valor: 709, pago: true, pagoEm: "2026-04-15", vencimento: "2026-04-15" },
    { id: "l11", tipo: "despesa", valor: 709, pago: true, pagoEm: "2026-04-17", vencimento: "2026-04-17" },
    { id: "l12", tipo: "despesa", valor: 320.5, pago: false, pagoEm: null, vencimento: "2026-04-10" },
    { id: "l13", tipo: "recebimento", valor: 320.5, pago: true, pagoEm: "2026-04-10", vencimento: "2026-04-10" },
  ];
  it("mesmo tipo e valor, data próxima; o mais próximo vence e cada lado é usado uma vez", () => {
    const pares = conciliarComContaAzul([
      { id: "m1", tipo: "despesa", valor: 709, data: "2026-04-16" }, // 1 dia de l10 e de l11 → empate: menor id
      { id: "m2", tipo: "despesa", valor: "709.00", data: "2026-04-17" }, // 0 dia de l11
      { id: "m3", tipo: "despesa", valor: 320.5, data: "2026-04-19" }, // em aberto: não concilia (vira sugestão em A classificar)
      { id: "m4", tipo: "despesa", valor: 709, data: "2026-04-25" }, // fora da janela de 3 dias
      { id: "m5", tipo: "despesa", valor: 999, data: "2026-04-15" }, // valor sem par
    ], ca);
    expect(Object.fromEntries(pares)).toEqual({ m1: "l10", m2: "l11" });
  });
  it("tipo diferente não concilia; em aberto não concilia nem no dia do vencimento; receita casa com recebimento", () => {
    expect(conciliarComContaAzul([{ id: "m1", tipo: "receita", valor: 709, data: "2026-04-15" }], ca).size).toBe(0);
    expect(conciliarComContaAzul([{ id: "m1", tipo: "despesa", valor: 320.5, data: "2026-04-10" }], ca).size).toBe(0);
    expect(Object.fromEntries(conciliarComContaAzul([{ id: "m1", tipo: "receita", valor: 320.5, data: "2026-04-12" }], ca))).toEqual({ m1: "l13" });
  });
  it("Asaas em aberto ↔ Conta Azul em aberto só com o mesmo cliente, mesmo valor, vencimento a até 3 dias e candidato único", () => {
    const c = (id: string, extra = {}) => ({ id, tipo: "recebimento", valor: 500, pago: false, pagoEm: null, vencimento: "2026-12-10", clienteId: "c3", ...extra });
    expect(receitaEmAbertoDoContaAzul({ clienteId: "c3", valor: 500, vencimento: new Date("2026-12-12T12:00:00Z") }, [c("1")])).toBe("1");
    expect(receitaEmAbertoDoContaAzul({ clienteId: null, valor: 500, vencimento: "2026-12-10" }, [c("1")])).toBeNull();
    expect(receitaEmAbertoDoContaAzul({ clienteId: "c4", valor: 500, vencimento: "2026-12-10" }, [c("1")])).toBeNull();
    expect(receitaEmAbertoDoContaAzul({ clienteId: "c3", valor: 500, vencimento: "2026-12-20" }, [c("1")])).toBeNull();
    expect(receitaEmAbertoDoContaAzul({ clienteId: "c3", valor: 500, vencimento: "2026-12-10" }, [c("1"), c("2")])).toBeNull(); // ambíguo
    expect(receitaEmAbertoDoContaAzul({ clienteId: "c3", valor: 500, vencimento: "2026-12-10" }, [c("1", { pago: true })])).toBeNull();
    expect(receitaEmAbertoDoContaAzul({ clienteId: "c3", valor: 500, vencimento: "2026-12-10" }, [c("1", { tipo: "despesa" })])).toBeNull();
  });
});

describe("A classificar e dividir pagamentos (regras)", () => {
  it("sentido: crédito baixa cobrança (recebimento/honorário/reembolso), débito baixa despesa (inclusive despesa_*)", () => {
    expect(sentidoCompativel("credito", "recebimento")).toBe(true);
    expect(sentidoCompativel("credito", "honorario")).toBe(true);
    expect(sentidoCompativel("credito", "despesa")).toBe(false);
    expect(sentidoCompativel("debito", "despesa")).toBe(true);
    expect(sentidoCompativel("debito", "despesa_obra")).toBe(true);
    expect(sentidoCompativel("debito", "reembolso")).toBe(false);
  });

  it("sugestões: mesmo valor (data mais próxima) primeiro, depois mesmo cliente/titular; no máximo 5", () => {
    const base = { tipo: "recebimento", pago: false, valorRecebido: 0, clienteNome: null as string | null };
    const abertos = [
      { ...base, id: "1", valor: 100, vencimento: "2026-03-20", clienteId: null },
      { ...base, id: "2", valor: 100, vencimento: "2026-03-06", clienteId: null },
      { ...base, id: "3", valor: 250, vencimento: "2026-01-01", clienteId: "c7" },
      { ...base, id: "4", valor: 300, vencimento: "2026-01-01", clienteId: null, clienteNome: "Maria Teste" },
      { ...base, id: "5", valor: 100, vencimento: "2026-03-05", clienteId: null, tipo: "despesa" }, // outro sentido
      { ...base, id: "6", valor: 100, vencimento: "2026-03-05", clienteId: null, pago: true }, // já pago
      { ...base, id: "7", valor: 180, valorRecebido: 80, vencimento: "2026-02-01", clienteId: null }, // saldo 100
      { ...base, id: "8", valor: 999, vencimento: "2026-03-05", clienteId: null },
    ];
    const r = sugestoesDeBaixa({ id: "m", tipo: "credito", valor: 100, data: "2026-03-05", bpoClienteId: "c7", titular: "MARIA TESTE" }, abertos);
    expect(r.map((l) => l.id)).toEqual(["2", "1", "7", "3", "4"]);
    expect(sugestoesDeBaixa({ id: "m", tipo: "credito", valor: 100, data: "2026-03-05" }, abertos, 2).map((l) => l.id)).toEqual(["2", "1"]);
  });

  it("divisão: soma exata em centavos, nunca acima do saldo, mesmo sentido; recusa pago/combinado/arquivado/Asaas/1:1/repetido", () => {
    const l = (id: string, extra = {}) => ({ id, tipo: "recebimento", valor: 300, valorRecebido: 0, pago: false, ...extra });
    const ls = [l("a"), l("b", { valor: 200.1 }), l("pago", { pago: true }), l("comb", { combinadaEmId: "x" }), l("arq", { exclusaoLoteBackupId: "bk" }),
      l("asaas", { asaasPaymentId: "pay" }), l("ligado", { transacaoId: "t9" }), l("desp", { tipo: "despesa" }), l("parcial", { valor: 500, valorRecebido: 450 })];
    const m = { tipo: "credito", valor: 500.1 };
    expect(validarDivisao(m, [{ lancamentoId: "a", valor: 300 }, { lancamentoId: "b", valor: 200.1 }], ls)).toEqual([]);
    expect(validarDivisao(m, [{ lancamentoId: "a", valor: 300 }, { lancamentoId: "b", valor: 200 }], ls)[0]).toMatch(/exatamente o valor da movimentação \(500\.10\)/);
    expect(validarDivisao(m, [], ls)).toEqual(["Escolha ao menos um lançamento."]);
    expect(validarDivisao(m, [{ lancamentoId: "a", valor: 0.001 }], ls)[0]).toMatch(/Valor inválido/);
    expect(validarDivisao(m, [{ lancamentoId: "a", valor: 250 }, { lancamentoId: "a", valor: 250.1 }], ls)[0]).toMatch(/mais de uma vez/);
    expect(validarDivisao({ tipo: "credito", valor: 60 }, [{ lancamentoId: "parcial", valor: 60 }], ls)[0]).toMatch(/passa do saldo/);
    for (const [id, msg] of [["pago", /já está pago/], ["comb", /combinado/], ["arq", /arquivado/], ["asaas", /Asaas/], ["ligado", /ligado a outra movimentação/], ["desp", /outro sentido/], ["zz", /não encontrado/]] as const) {
      expect(validarDivisao({ tipo: "credito", valor: 10 }, [{ lancamentoId: id, valor: 10 }], ls).join(" ")).toMatch(msg);
    }
    expect(resultadoDaBaixa({ valor: 500, valorRecebido: 450 }, 50)).toEqual({ valorRecebido: "500.00", pago: true, saldo: 0 });
    expect(resultadoDaBaixa({ valor: 0.3, valorRecebido: 0.1 }, 0.1)).toEqual({ valorRecebido: "0.20", pago: false, saldo: 0.1 });
    expect(chaveAlocacao("t1", "l1")).toBe("bt:t1:l1");
  });
});

describe("centros de custo (regras)", () => {
  it("combinado \"A / B\" vale para os dois; comparação sem maiúsculas/acentos; renomear só a parte certa", () => {
    expect(centrosDoLancamento("Santa Fe Canaa / Santa Fe Parauapebas")).toEqual(["Santa Fe Canaa", "Santa Fe Parauapebas"]);
    expect(chaveCentro("  Santa  Fé ")).toBe("santa fe");
    expect(lancamentoNoCentro("Obra A / Canaã", "CANAA")).toBe(true);
    expect(lancamentoNoCentro("Obra A", "Canaã")).toBe(false);
    expect(renomearCentroNoTexto("Obra A / Canaã", "canaa", "Filial Canaã")).toBe("Obra A / Filial Canaã");
    expect(renomearCentroNoTexto("Obra X", "Obra Y", "Z")).toBeNull();
    expect(renomearCentroNoTexto("A / B", "B", "A")).toBe("A"); // juntar não duplica
    expect(() => renomearCentroNoTexto("A / B", "B", "x".repeat(99))).toThrow(/100 caracteres/);
    expect(centrosUsados([{ centroCustos: "B / a" }, { centroCustos: "A" }, { centroCustos: null }])).toEqual(["a", "B"]);
  });
});

describe("filtros (regras)", () => {
  const base = { tipo: "recebimento", clienteId: "c1", clienteNome: "Maria Teste", competencia: "2026-10", vencimento: "2026-10-10", pago: false, valorRecebido: 0 };
  const lancs = [
    { ...base, id: "1", descricao: "Honorários", valor: 300, centroCustos: "Canaa / Parauapebas" },
    { ...base, id: "2", descricao: "Projeto", valor: 1500, centroCustos: "Parauapebas", pago: true, valorRecebido: 1500 },
    { ...base, id: "3", descricao: "Taxa", valor: 80.5, centroCustos: null, competencia: "2025-10", clienteNome: null, titular: "JOAO PIX" },
    { ...base, id: "4", descricao: "Parcela", valor: 500, centroCustos: "Obra", valorRecebido: 200, vencimento: "2099-01-01" },
  ];
  const ids = (f: Partial<typeof FILTROS_VAZIOS>) => filtrarLancamentosLote(lancs, filtrosDoLote({ ...FILTROS_VAZIOS, ...f }), new Date("2026-11-12T12:00:00Z")).map((l) => l.id);

  it("mês/ano, busca (cliente, titular, descrição), valor mínimo/máximo/exato, status e centro de custo", () => {
    expect(numeroDoCampo("1.234,56")).toBe(1234.56);
    expect(numeroDoCampo("R$ 80.5")).toBe(80.5);
    expect(numeroDoCampo("abc")).toBeNull();
    expect(ids({})).toEqual(["1", "2", "3", "4"]);
    expect(ids({ mes: "10", ano: "2026" })).toEqual(["1", "2", "4"]);
    expect(ids({ busca: "joao" })).toEqual(["3"]);
    expect(ids({ busca: "maria" })).toEqual(["1", "2", "4"]);
    expect(ids({ valorMin: "300" })).toEqual(["1", "2", "4"]);
    expect(ids({ valorMax: "300,00" })).toEqual(["1", "3"]);
    expect(ids({ valorMin: "80,50", valorMax: "80,50" })).toEqual(["3"]); // valor exato
    expect(ids({ status: "pagas" })).toEqual(["2"]);
    expect(ids({ status: "vencidas" })).toEqual(["1", "3"]);
    expect(ids({ status: "pendentes" })).toEqual(["4"]);
    expect(ids({ status: "parciais" })).toEqual(["4"]);
    expect(ids({ centroCusto: "parauapebas" })).toEqual(["1", "2"]); // o combinado entra nos dois
    expect(ids({ centroCusto: "Canaã" })).toEqual(["1"]);
    expect(algumFiltro(FILTROS_VAZIOS)).toBe(false);
    expect(algumFiltro({ ...FILTROS_VAZIOS, valorMin: "1" })).toBe(true);
  });

  it("painel de valores soma só o visível (centavos); movimentações e clientes", () => {
    expect(resumoDosLancamentos(lancs.filter((l) => ["1", "4"].includes(l.id)))).toEqual({ quantidade: 2, total: 800, recebido: 200, emAberto: 600 });
    expect(resumoDosLancamentos([{ valor: 0.1, pago: false, valorRecebido: 0 }, { valor: 0.2, pago: true, valorRecebido: 0 }])).toEqual({ quantidade: 2, total: 0.3, recebido: 0.2, emAberto: 0.1 });
    const movs = [
      { id: "1", data: "2026-10-01T12:00:00Z", descricao: "Pix recebido", titular: "Maria", valor: 10 },
      { id: "2", data: new Date("2026-09-05T12:00:00Z"), descricao: "Tarifa", titular: null, valor: 2.5 },
    ];
    expect(filtrarMovimentacoes(movs, { mes: "10", ano: "2026" }).map((m) => m.id)).toEqual(["1"]);
    expect(filtrarMovimentacoes(movs, { busca: "tarifa", valorMax: 3 }).map((m) => m.id)).toEqual(["2"]);
    const clientes = [
      { id: "1", razaoSocial: "Construtora Exemplo", cnpj: "11.222.333/0001-44", cpf: null, nomeLead: null, status: "ativo" },
      { id: "2", razaoSocial: "Ana", cnpj: null, cpf: "123.456.789-00", nomeLead: "Ana Lima", status: "encerrado" },
    ];
    expect(filtrarClientes(clientes, { busca: "lima" }).map((c) => c.id)).toEqual(["2"]);
    expect(filtrarClientes(clientes, { busca: "11222333" }).map((c) => c.id)).toEqual(["1"]);
    expect(filtrarClientes(clientes, { busca: "456.789" }).map((c) => c.id)).toEqual(["2"]);
    expect(filtrarClientes(clientes, { status: "ativo" }).map((c) => c.id)).toEqual(["1"]);
    expect(filtrarPorCentro(lancs, "obra").map((l) => l.id)).toEqual(["4"]);
  });

  it("DRE por centro de custo: as células guardam o centro e o filtro inclui os combinados", () => {
    const lanc = (valor: number, centroCustos: string | null, tipo = "recebimento") => ({ tipo, valor, competencia: "2026-10", pago: true, categoria: "Recebimento de cliente", centroCustos });
    const celulas = celulasDre([lanc(100, "Canaa / Parauapebas"), lanc(50, "Canaa"), lanc(30, null), lanc(20, "Parauapebas", "despesa")]);
    expect(dreFiltrado(celulas).porCompetencia[0]).toMatchObject({ receitas: 180, despesas: 20 });
    expect(dreFiltrado(celulas, { centroCusto: "canaã" }).porCompetencia[0]).toMatchObject({ receitas: 150, despesas: 0 });
    expect(dreFiltrado(celulas, { centroCusto: "Parauapebas" }).porCompetencia[0]).toMatchObject({ receitas: 100, despesas: 20 });
    expect(dreFiltrado(celulas, { centroCusto: "Outro" }).porCompetencia).toEqual([]);
  });
});
