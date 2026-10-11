import { describe, expect, it } from "vitest";
import {
  calcularValorComissao,
  encontrarNegocio,
  normalizarTipoComissao,
  rotuloNegocio,
  rotuloTipoComissao,
} from "../comissoes/calculo";

describe("calcularValorComissao", () => {
  it("percentual × valor do negócio vinculado", () => {
    expect(calcularValorComissao(300000, 6)).toBe(18000);
    expect(calcularValorComissao(1500, 10)).toBe(150);
  });

  it("arredonda em centavos", () => {
    expect(calcularValorComissao(1234.56, 6)).toBe(74.07);
    expect(calcularValorComissao(333333.33, 5.5)).toBe(18333.33);
  });

  it("sem base ou percentual inválido não sugere valor", () => {
    expect(calcularValorComissao(null, 6)).toBeNull();
    expect(calcularValorComissao(0, 6)).toBeNull();
    expect(calcularValorComissao(100000, NaN)).toBeNull();
    expect(calcularValorComissao(100000, 0)).toBeNull();
    expect(calcularValorComissao(100000, 120)).toBeNull();
  });
});

describe("tipos de comissão", () => {
  it("normaliza tipos legados", () => {
    expect(normalizarTipoComissao("venda_imovel")).toBe("venda");
    expect(normalizarTipoComissao(undefined)).toBe("venda");
    expect(normalizarTipoComissao("obra")).toBe("obra");
  });

  it("o antigo 'Construção' agora é 'Obra'", () => {
    expect(rotuloTipoComissao("obra")).toBe("Obra");
  });
});

describe("encontrarNegocio", () => {
  const itens = [
    { id: "1", label: "Casa Jardim", valorBase: 300000 },
    { id: "2", label: "Lote Centro", valorBase: 90000 },
  ];

  it("reencontra o negócio a partir do texto gravado", () => {
    const gravado = rotuloNegocio(itens[1], "venda");
    expect(gravado).toBe("Lote Centro [Comissão de Venda]");
    expect(encontrarNegocio(itens, "venda", gravado)?.id).toBe("2");
  });

  it("aceita texto igual ao título e devolve null para texto livre antigo", () => {
    expect(encontrarNegocio(itens, "venda", "Casa Jardim")?.id).toBe("1");
    expect(encontrarNegocio(itens, "venda", "apto do João")).toBeNull();
  });
});
