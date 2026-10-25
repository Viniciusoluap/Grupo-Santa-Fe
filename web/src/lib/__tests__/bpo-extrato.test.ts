// LOTE C (25/10): categorias do BPO, saldo lido do extrato e DRE/Contabilidade/Relatórios
// a partir dos lançamentos (regras puras). Cenários espelhados na Prospecta.
import { describe, expect, it } from "vitest";
import { CATEGORIAS_BPO, contaNoResultado, ehDespesa, sugerirCategoria, TRANSFERENCIA_INTERNA } from "@/lib/bpo-categorias";
import { dreUltimos12Meses, montarDre, resumoContabil } from "@/lib/financeiro/bpo-resultado";
import { lerCsv, lerOfx, lerTextoPdf } from "@/lib/extrato-import";

describe("categorias padrão", () => {
  it("lista completa na ordem combinada", () => {
    expect(CATEGORIAS_BPO).toEqual([
      "Recebimento de cliente", "Financiamento/CAIXA", "Material", "Mão de obra", "Projetos e taxas", "Impostos",
      "Tarifas bancárias", "Pró-labore", "Administrativo", "Transferência interna", "Outros",
    ]);
  });
  it("sugere por palavras-chave, respeitando entrada/saída", () => {
    expect(sugerirCategoria("PIX RECEBIDO JOAO DA SILVA", "credito")).toBe("Recebimento de cliente");
    expect(sugerirCategoria("TED CAIXA ECONOMICA FEDERAL", "credito")).toBe("Financiamento/CAIXA");
    expect(sugerirCategoria("Crédito FGTS financiamento", "credito")).toBe("Financiamento/CAIXA");
    expect(sugerirCategoria("Pagamento Depósito Materiais de Construção", "debito")).toBe("Material");
    expect(sugerirCategoria("Depósito em dinheiro", "credito")).toBe("Recebimento de cliente");
    expect(sugerirCategoria("PIX enviado diária pedreiro", "debito")).toBe("Mão de obra");
    expect(sugerirCategoria("Taxa alvará prefeitura", "debito")).toBe("Projetos e taxas");
    expect(sugerirCategoria("DARF IRPJ", "debito")).toBe("Impostos");
    expect(sugerirCategoria("Pagamento das notas do mês", "debito")).toBe("Outros");
    expect(sugerirCategoria("Tarifa pacote de serviços", "debito")).toBe("Tarifas bancárias");
    expect(sugerirCategoria("Pró-labore sócio", "debito")).toBe("Pró-labore");
    expect(sugerirCategoria("Conta de energia Equatorial", "debito")).toBe("Administrativo");
    expect(sugerirCategoria("Transferência entre contas mesma titularidade", "debito")).toBe(TRANSFERENCIA_INTERNA);
    expect(sugerirCategoria("Compra diversa", "debito")).toBe("Outros");
  });
  it("despesa inclui as variações despesa_*; transferência interna fica fora do resultado", () => {
    expect(ehDespesa("despesa")).toBe(true);
    expect(ehDespesa("despesa_imposto")).toBe(true);
    expect(ehDespesa("recebimento")).toBe(false);
    expect(contaNoResultado({ categoria: TRANSFERENCIA_INTERNA })).toBe(false);
    expect(contaNoResultado({ categoria: null })).toBe(true);
  });
});

describe("saldo informado no extrato", () => {
  it("OFX: LEDGERBAL/BALAMT e DTASOF", () => {
    const ofx = `<OFX><BANKTRANLIST><STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261005<TRNAMT>100.00<MEMO>Pix</STMTTRN></BANKTRANLIST>
<LEDGERBAL><BALAMT>1234.56<DTASOF>20261031120000[-3:BRT]</LEDGERBAL></OFX>`;
    expect(lerOfx(ofx).saldo).toEqual({ valor: 1234.56, data: "2026-10-31" });
    expect(lerOfx("<OFX><STMTTRN><TRNAMT>1<DTPOSTED>20261005</STMTTRN></OFX>").saldo).toBeNull();
  });
  it("planilha: coluna Saldo da data mais recente (crescente ou decrescente)", () => {
    const cresc = ["Data;Descrição;Valor;Saldo", "01/10/2026;A;100,00;600,00", "02/10/2026;B;-50,00;550,00", "02/10/2026;C;-10,00;540,00"].join("\n");
    expect(lerCsv(cresc).saldo).toEqual({ valor: 540, data: "2026-10-02" });
    const decr = ["Data;Descrição;Valor;Saldo", "02/10/2026;C;-10,00;540,00", "02/10/2026;B;-50,00;550,00", "01/10/2026;A;100,00;600,00"].join("\n");
    expect(lerCsv(decr).saldo).toEqual({ valor: 540, data: "2026-10-02" });
    expect(lerCsv(["Data;Descrição;Valor", "01/10/2026;A;100,00"].join("\n")).saldo).toBeNull();
  });
  it("PDF: último valor das linhas com saldo", () => {
    const r = lerTextoPdf(["01/10/2026 Pix recebido 100,00 600,00", "03/10/2026 Pagamento boleto 50,00 550,00", "03/10/2026 SALDO DO DIA 550,00"]);
    expect(r.linhas).toHaveLength(2);
    expect(r.saldo).toEqual({ valor: 550, data: "2026-10-03" });
  });
});

describe("DRE, Contabilidade e Relatórios", () => {
  const ls = [
    { tipo: "recebimento", valor: 1000, competencia: "2026-09", pago: true, categoria: "Recebimento de cliente" },
    { tipo: "despesa", valor: 300, competencia: "2026-09", pago: true, categoria: "Material" },
    { tipo: "despesa", valor: 120.5, competencia: "2026-10", pago: true, categoria: "Impostos" },
    { tipo: "honorario", valor: 500, competencia: "2026-10", pago: false, categoria: null },
    { tipo: "despesa_pessoal", valor: 200, competencia: "2026-10", pago: true, categoria: null },
    { tipo: "despesa", valor: 5000, competencia: "2026-10", pago: true, categoria: TRANSFERENCIA_INTERNA },
    { tipo: "recebimento", valor: 5000, competencia: "2026-10", pago: true, categoria: TRANSFERENCIA_INTERNA },
  ];
  it("DRE por competência sem transferências internas; despesa_* conta como despesa", () => {
    expect(montarDre(ls)).toEqual([
      { competencia: "2026-10", receitas: 500, despesas: 320.5, resultado: 179.5 },
      { competencia: "2026-09", receitas: 1000, despesas: 300, resultado: 700 },
    ]);
  });
  it("contabilidade: só o realizado (pago) no período", () => {
    const r = resumoContabil(ls, "2026-01", "2026-12");
    expect(r).toMatchObject({ receitaRealizada: 1000, despesasPagas: 620.5, impostosPagos: 120.5, resultado: 379.5 });
    expect(r.porCategoria.find((c) => c.categoria === TRANSFERENCIA_INTERNA)).toBeUndefined();
    expect(resumoContabil(ls, "2026-10", "2026-10").receitaRealizada).toBe(0);
  });
  it("gráfico do DRE: 12 meses contínuos, do mais antigo ao atual", () => {
    const m = dreUltimos12Meses(ls, new Date("2026-10-25T12:00:00Z"));
    expect(m).toHaveLength(12);
    expect(m[0].competencia).toBe("2025-11");
    expect(m[11]).toMatchObject({ competencia: "2026-10", mes: "10/26", receitas: 500, despesas: 320.5 });
    expect(m[10]).toMatchObject({ competencia: "2026-09", receitas: 1000, despesas: 300 });
  });
});
