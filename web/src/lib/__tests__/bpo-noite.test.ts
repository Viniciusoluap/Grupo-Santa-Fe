import { describe, expect, it } from "vitest";
import { situacaoCobrancaAsaas } from "@/lib/bancos/cobrancas-asaas";
import { extensaoExtratoValida, extrairTitular, lerCsv } from "@/lib/extrato-import";

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

  it("mapeia somente situações financeiras válidas do Asaas", () => {
    expect(situacaoCobrancaAsaas("RECEIVED")).toBe("pago");
    expect(situacaoCobrancaAsaas("PENDING")).toBe("aberto");
    expect(situacaoCobrancaAsaas("OVERDUE")).toBe("vencido");
    expect(situacaoCobrancaAsaas("REFUNDED")).toBeNull();
  });
});
