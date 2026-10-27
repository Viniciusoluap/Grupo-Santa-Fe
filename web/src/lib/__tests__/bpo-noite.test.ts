import { describe, expect, it } from "vitest";
import { situacaoCobrancaAsaas } from "@/lib/bancos/cobrancas-asaas";
import { chavesImportacao, extensaoExtratoValida, extrairTitular, lerCsv } from "@/lib/extrato-import";

describe("BPO — lote da noite de 25/10", () => {
  it("aceita OFX no iPad pela extensão e rejeita formato estranho", () => {
    expect(extensaoExtratoValida("extrato.ofx")).toBe(true);
    expect(extensaoExtratoValida("EXTRATO.OFX")).toBe(true);
    expect(extensaoExtratoValida("foto.heic")).toBe(false);
  });

  it("extrai titular da descrição bancária", () => {
    expect(extrairTitular("Transf Pix recebida - Maria de Souza")).toBe("Maria de Souza");
    const csv = ["Data;Descrição;Valor", "25/10/2026;Pix recebido - João Lima;150,00"].join("\n");
    expect(lerCsv(csv).linhas[0]).toMatchObject({ titular: "João Lima", tipo: "credito" });
  });

  it("Cora preserva participante, descrição complementar e NSU sem duplicar", () => {
    const r = lerCsv("Data;Transação;Tipo Transação;Identificação;Descrição;NSU;Valor\n10/01/2026;Transf Pix enviada;Débito;Pedreiro Zé;Diária semana 2;E123;-800,00");
    expect(r.linhas[0]).toMatchObject({ descricao: "Transf Pix enviada", titular: "Pedreiro Zé", detalhe: "Diária semana 2", identificadorBancario: "E123", tipo: "debito" });
    expect(chavesImportacao("conta", r.linhas, (s) => s)[0]).toContain("ref:e123");
  });

  it("mapeia somente situações financeiras válidas do Asaas", () => {
    expect(situacaoCobrancaAsaas("RECEIVED")).toBe("pago");
    expect(situacaoCobrancaAsaas("PENDING")).toBe("aberto");
    expect(situacaoCobrancaAsaas("OVERDUE")).toBe("vencido");
    expect(situacaoCobrancaAsaas("REFUNDED")).toBeNull();
  });
});
