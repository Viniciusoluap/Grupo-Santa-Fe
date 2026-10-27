import { describe, expect, it } from "vitest";
import { validarOperacaoBpo } from "@/lib/bpo-operacional";
import { preservarLancamentoNaLimpeza } from "@/lib/bpo-limpeza";

describe("vínculos operacionais BPO", () => {
  it("exige categoria e registro, distingue etapas e tipo de despesa de obra", () => {
    expect(() => validarOperacaoBpo({ tipo: "recebimento", categoriaOperacional: "obras", vinculoOperacionalId: "obra-1" })).not.toThrow();
    expect(() => validarOperacaoBpo({ tipo: "recebimento", categoriaOperacional: "preliminares", vinculoOperacionalId: "obra-1" })).toThrow();
    expect(() => validarOperacaoBpo({ tipo: "despesa", categoriaOperacional: "obras", vinculoOperacionalId: "obra-1" })).toThrow();
    expect(() => validarOperacaoBpo({ tipo: "despesa", categoriaOperacional: "obras", vinculoOperacionalId: "obra-1", tipoDespesaObra: "Material", etapa: "infraestrutura" })).not.toThrow();
    expect(() => validarOperacaoBpo({ tipo: "despesa", categoriaOperacional: "comissoes", vinculoOperacionalId: "imovel-1", etapa: "infraestrutura" })).toThrow();
    expect(() => validarOperacaoBpo({ tipo: "recebimento" }, false)).not.toThrow();
  });
  it("preserva origens independentes e ambíguas, removendo só extrato sem dependência legítima", () => {
    const base = { origemEfetiva: "extrato", movimentosObra: [], recebimentosRegularizacao: [] };
    expect(preservarLancamentoNaLimpeza(base)).toBe(false);
    expect(preservarLancamentoNaLimpeza({ ...base, origemEfetiva: "manual" })).toBe(true);
    expect(preservarLancamentoNaLimpeza({ ...base, origemEfetiva: "legado" })).toBe(true);
    expect(preservarLancamentoNaLimpeza({ ...base, asaasPaymentId: "pay_1" })).toBe(true);
    expect(preservarLancamentoNaLimpeza({ ...base, vinculoOperacionalId: "projeto-1" })).toBe(true);
    expect(preservarLancamentoNaLimpeza({ ...base, movimentosObra: [{ id: "mov-1" }] })).toBe(true);
  });
});
