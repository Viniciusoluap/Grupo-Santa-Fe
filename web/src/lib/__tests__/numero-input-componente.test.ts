import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NumeroInput } from "@/components/ui/numero-input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { PercentInput } from "@/components/ui/percent-input";
import { AreaInput } from "@/components/ui/area-input";
import { NumeroBRField } from "@/components/ui/numero-br-field";

// Correção 21: renderização inicial dos campos (sem DOM; a digitação é coberta
// pela lógica pura em numero-mascara.test.ts). Gêmeo do teste da Prospecta.
const html = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(el);
const noop = () => {};

describe("NumeroInput e wrappers — exibição inicial", () => {
  it("NumeroInput formata pt-BR com prefixo/sufixo e inputMode decimal", () => {
    const h = html(createElement(NumeroInput, { value: 1000000, onChange: noop, prefixo: "R$" }));
    expect(h).toContain('value="1.000.000,00"');
    expect(h).toContain('inputMode="decimal"');
    expect(h).toContain("R$");
    expect(html(createElement(NumeroInput, { value: 0, onChange: noop }))).toContain('value="0,00"');
    expect(html(createElement(NumeroInput, { value: null, onChange: noop }))).toContain('value=""');
    expect(html(createElement(NumeroInput, { value: 0.0575, onChange: noop, casas: 4, sufixo: "%" }))).toContain('value="0,0575"');
  });
  it("input oculto guarda o número cru, sem arredondar", () => {
    const h = html(createElement(NumeroInput, { defaultValue: 1234.5678, name: "valor" }));
    expect(h).toContain('value="1.234,57"');
    expect(h).toContain('name="valor" value="1234.5678"');
  });
  it("CurrencyInput: mesma unidade; vazio envia '' no FormData (como antes)", () => {
    expect(html(createElement(CurrencyInput, { value: 180000, onValueChange: noop }))).toContain('value="180.000,00"');
    const vazio = html(createElement(CurrencyInput, { name: "valor", defaultValue: null }));
    expect(vazio).toContain('name="valor" value=""');
    expect(html(createElement(CurrencyInput, { name: "valor", defaultValue: 99.9 }))).toContain('name="valor" value="99.9"');
  });
  it("PercentInput, AreaInput e NumeroBRField", () => {
    expect(html(createElement(PercentInput, { value: 2.345, onValueChange: noop }))).toContain('value="2,345"');
    expect(html(createElement(PercentInput, { name: "p", defaultValue: null }))).toContain('name="p" value="0"');
    expect(html(createElement(AreaInput, { value: 1250.5, onValueChange: noop }))).toContain('value="1.250,50"');
    expect(html(createElement(NumeroBRField, { value: 1.2345, onValueChange: noop, decimals: 4 }))).toContain('value="1,2345"');
    expect(html(createElement(NumeroBRField, { value: 0, onValueChange: noop }))).toContain('value=""');
  });
});
