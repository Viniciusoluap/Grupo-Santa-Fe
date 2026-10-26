// Pedido de 25/10: leitura de extrato (CSV, Excel, OFX, PDF) e data inicial por conta.
// Mesmos cenários de Prospecta/server/extrato-import.test.ts.
import { describe, expect, it } from "vitest";
import { aplicarDataInicial, chavesImportacao, dataIso, lerCsv, lerOfx, lerTabela, lerTextoPdf, valorMonetario } from "@/lib/extrato-import";

describe("valores e datas", () => {
  it("lê valores em formato brasileiro, com sinal, D/C e parênteses", () => {
    expect(valorMonetario("1.234,56")).toBe(1234.56);
    expect(valorMonetario("-1.234,56")).toBe(-1234.56);
    expect(valorMonetario("R$ 50,00")).toBe(50);
    expect(valorMonetario("50,00 D")).toBe(-50);
    expect(valorMonetario("50,00 C")).toBe(50);
    expect(valorMonetario("(80,10)")).toBe(-80.1);
    expect(valorMonetario("1234.5")).toBe(1234.5);
    expect(valorMonetario("1,234.50")).toBe(1234.5);
    expect(valorMonetario("abc")).toBeNull();
    expect(valorMonetario(-12)).toBe(-12);
  });
  it("lê datas dd/mm/aaaa, ISO, OFX e serial do Excel; recusa datas inválidas", () => {
    expect(dataIso("05/10/2026")).toBe("2026-10-05");
    expect(dataIso("05/10/26")).toBe("2026-10-05");
    expect(dataIso("2026-10-05T10:00:00")).toBe("2026-10-05");
    expect(dataIso("20261005120000[-3:BRT]")).toBe("2026-10-05");
    expect(dataIso(46300)).toBe("2026-10-05");
    expect(dataIso("31/02/2026")).toBeNull();
    expect(dataIso("texto")).toBeNull();
  });
});

describe("formatos de arquivo", () => {
  it("CSV com ponto e vírgula e colunas Crédito/Débito (estilo Cora); ignora linha de saldo", () => {
    const csv = [
      "Extrato Conta PJ",
      "Data;Descrição;Crédito;Débito",
      "01/10/2026;Pix recebido Cliente A;1.500,00;",
      "02/10/2026;Boleto fornecedor;;320,40",
      "02/10/2026;Saldo do dia;;",
      ";;;",
    ].join("\n");
    const r = lerCsv(csv);
    expect(r.linhas).toMatchObject([
      { data: "2026-10-01", descricao: "Pix recebido Cliente A", valor: 1500, tipo: "credito" },
      { data: "2026-10-02", descricao: "Boleto fornecedor", valor: 320.4, tipo: "debito" },
    ]);
  });

  it("CSV com vírgula, aspas e coluna única de valor com sinal", () => {
    const r = lerCsv('Data,Histórico,Valor\n2026-10-03,"Tarifa, pacote",-19.90\n2026-10-04,Depósito,200.00');
    expect(r.linhas.map(l => [l.tipo, l.valor, l.descricao])).toEqual([["debito", 19.9, "Tarifa, pacote"], ["credito", 200, "Depósito"]]);
  });

  it("coluna de tipo D/C com valor positivo", () => {
    const r = lerTabela([["Data", "Lançamento", "Valor", "Tipo"], ["10/10/2026", "Compra", "45,00", "D"], ["11/10/2026", "Venda", "90,00", "C"]]);
    expect(r.linhas.map(l => l.tipo)).toEqual(["debito", "credito"]);
  });

  it("planilha do Excel com datas em número serial", () => {
    const r = lerTabela([["Data", "Descrição", "Valor"], [46300, "Pix", 10], [46301, "Tarifa", -2.5]], "Excel");
    expect(r.linhas).toMatchObject([
      { data: "2026-10-05", descricao: "Pix", valor: 10, tipo: "credito" },
      { data: "2026-10-06", descricao: "Tarifa", valor: 2.5, tipo: "debito" },
    ]);
  });

  it("planilha sem cabeçalho reconhecível dá erro claro", () => {
    expect(() => lerTabela([["a", "b"], [1, 2]])).toThrow(/colunas de data e valor/);
  });

  it("OFX (C6/Inter/Cora exportam assim)", () => {
    const ofx = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261001120000[-3:BRT]<TRNAMT>1500.00<FITID>1<MEMO>PIX RECEBIDO</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261002<TRNAMT>-89.90<FITID>2<NAME>TARIFA</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
    expect(lerOfx(ofx).linhas).toMatchObject([
      { data: "2026-10-01", descricao: "PIX RECEBIDO", valor: 1500, tipo: "credito" },
      { data: "2026-10-02", descricao: "TARIFA", valor: 89.9, tipo: "debito" },
    ]);
  });

  it("PDF: usa o valor do lançamento (não o saldo), detecta débito e completa o ano", () => {
    const r = lerTextoPdf([
      "Extrato de 01/10/2026 a 31/10/2026",
      "01/10/2026 PIX RECEBIDO FULANO 1.000,00 5.000,00",
      "02/10/2026 PIX ENVIADO BELTRANO -250,00 4.750,00",
      "03/10 TARIFA MENSAL 30,00",
      "03/10/2026 SALDO DO DIA 4.720,00",
    ], 2026);
    expect(r.linhas).toMatchObject([
      { data: "2026-10-01", descricao: "PIX RECEBIDO FULANO", valor: 1000, tipo: "credito" },
      { data: "2026-10-02", descricao: "PIX ENVIADO BELTRANO", valor: 250, tipo: "debito" },
      { data: "2026-10-03", descricao: "TARIFA MENSAL", valor: 30, tipo: "debito" },
    ]);
  });
});

describe("data inicial e identificação das linhas importadas", () => {
  const linhas = [
    { data: "2026-09-30", descricao: "Antes", valor: 1, tipo: "credito" as const },
    { data: "2026-10-01", descricao: "Pix", valor: 10, tipo: "credito" as const },
    { data: "2026-10-01", descricao: "Pix", valor: 10, tipo: "credito" as const },
  ];
  it("descarta o que é anterior à data inicial da conta", () => {
    expect(aplicarDataInicial(linhas, "2026-10-01")).toEqual({ mantidas: linhas.slice(1), antesDaDataInicial: 1 });
    expect(aplicarDataInicial(linhas, null).mantidas).toHaveLength(3);
  });
  it("mesmas linhas → mesmas chaves (reimportar não duplica); lançamentos idênticos continuam dois", () => {
    const h = (s: string) => s;
    const a = chavesImportacao(5, linhas, h);
    expect(chavesImportacao(5, linhas, h)).toEqual(a);
    expect(a[1]).not.toEqual(a[2]);
    expect(chavesImportacao(6, linhas, h)[1]).not.toEqual(a[1]);
  });
});
