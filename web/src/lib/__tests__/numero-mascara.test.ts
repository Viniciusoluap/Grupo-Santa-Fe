import { describe, it, expect } from "vitest";
import {
  aplicarEdicao,
  finalizarTexto,
  formatarNumero,
  lerNumero,
  mascararTexto,
  maxDigitosInteiros,
  posicionarCursor,
  type EstadoNumero,
  type OpcoesNumero,
} from "@/lib/numero-mascara";

// Simula a digitação tecla a tecla, sempre na posição atual do cursor.
function digitar(teclas: string, opcoes: OpcoesNumero = {}, inicio: EstadoNumero = { texto: "", numero: null, cursor: 0 }): EstadoNumero {
  let estado = inicio;
  for (const tecla of teclas) {
    const novo = estado.texto.slice(0, estado.cursor) + tecla + estado.texto.slice(estado.cursor);
    estado = aplicarEdicao(estado.texto, novo, estado.cursor + 1, opcoes);
  }
  return estado;
}

function backspace(estado: EstadoNumero, opcoes: OpcoesNumero = {}): EstadoNumero {
  const novo = estado.texto.slice(0, estado.cursor - 1) + estado.texto.slice(estado.cursor);
  return aplicarEdicao(estado.texto, novo, estado.cursor - 1, opcoes);
}

describe("formatarNumero", () => {
  it("padrão brasileiro com 2 casas", () => {
    expect(formatarNumero(1000000)).toBe("1.000.000,00");
    expect(formatarNumero(0.52)).toBe("0,52");
    expect(formatarNumero(0)).toBe("0,00");
    expect(formatarNumero(1234.5)).toBe("1.234,50");
    expect(formatarNumero(999)).toBe("999,00");
    expect(formatarNumero(1000)).toBe("1.000,00");
  });
  it("negativos e zero negativo", () => {
    expect(formatarNumero(-1234.56)).toBe("-1.234,56");
    expect(formatarNumero(-0)).toBe("0,00");
    expect(formatarNumero(-0.001)).toBe("0,00");
  });
  it("arredonda meio para cima sem erro de ponto flutuante", () => {
    expect(formatarNumero(1.005)).toBe("1,01");
    expect(formatarNumero(2.675)).toBe("2,68");
    expect(formatarNumero(0.125, { casas: 2 })).toBe("0,13");
  });
  it("valores grandes", () => {
    expect(formatarNumero(123456789012.34)).toBe("123.456.789.012,34");
    expect(formatarNumero(1e15)).toBe("1.000.000.000.000.000,00");
  });
  it("casas configuráveis e casas mínimas", () => {
    expect(formatarNumero(0.0575, { casas: 4 })).toBe("0,0575");
    expect(formatarNumero(6, { casas: 4, casasMinimas: 2 })).toBe("6,00");
    expect(formatarNumero(2.345, { casas: 4, casasMinimas: 2 })).toBe("2,345");
    expect(formatarNumero(1234.7, { casas: 0 })).toBe("1.235");
  });
  it("vazio para null/undefined/NaN/infinito", () => {
    expect(formatarNumero(null)).toBe("");
    expect(formatarNumero(undefined)).toBe("");
    expect(formatarNumero(NaN)).toBe("");
    expect(formatarNumero(Infinity)).toBe("");
  });
  it("finalizarTexto completa as casas ao sair do campo", () => {
    expect(finalizarTexto(1000000)).toBe("1.000.000,00");
    expect(finalizarTexto(null)).toBe("");
  });
});

describe("lerNumero (colagem/importação, sem perder precisão)", () => {
  it("formatos aceitos", () => {
    expect(lerNumero("1.234,56")).toBe(1234.56);
    expect(lerNumero("1234,56")).toBe(1234.56);
    expect(lerNumero("1234.56")).toBe(1234.56);
    expect(lerNumero("R$ 1.234,56")).toBe(1234.56);
    expect(lerNumero("R$ -1.234,56")).toBe(-1234.56);
    expect(lerNumero("-R$ 1.234,56")).toBe(-1234.56);
    expect(lerNumero("1,234.56")).toBe(1234.56);
    expect(lerNumero("1.000")).toBe(1000);
    expect(lerNumero("250.000")).toBe(250000);
    expect(lerNumero("1234.567")).toBe(1234.567);
    expect(lerNumero("1.234.567")).toBe(1234567);
    expect(lerNumero("1,234,567")).toBe(1234567);
    expect(lerNumero("12,5 %")).toBe(12.5);
    expect(lerNumero("350 m²")).toBe(350);
  });
  it("não arredonda: preserva todas as casas", () => {
    expect(lerNumero("0,123456")).toBe(0.123456);
    expect(lerNumero("3.14159")).toBe(3.14159);
  });
  it("pontoDecimal: ponto sozinho é decimal (percentuais)", () => {
    expect(lerNumero("2.345", { pontoDecimal: true })).toBe(2.345);
    expect(lerNumero("2.345")).toBe(2345);
  });
  it("vazio/sem dígitos → null; número passa direto", () => {
    expect(lerNumero("")).toBeNull();
    expect(lerNumero("abc")).toBeNull();
    expect(lerNumero("-")).toBeNull();
    expect(lerNumero(null)).toBeNull();
    expect(lerNumero(12.5)).toBe(12.5);
    expect(lerNumero(NaN)).toBeNull();
  });
  it("negativo bloqueado ignora o sinal; -0 vira 0", () => {
    expect(lerNumero("-5", { negativo: false })).toBe(5);
    expect(Object.is(lerNumero("-0"), 0)).toBe(true);
  });
});

describe("mascararTexto", () => {
  it("põe milhar e mantém a vírgula digitada", () => {
    expect(mascararTexto("1000000")).toEqual({ texto: "1.000.000", numero: 1000000, excedeu: false });
    expect(mascararTexto("1000000,5")).toEqual({ texto: "1.000.000,5", numero: 1000000.5, excedeu: false });
    expect(mascararTexto("0,")).toEqual({ texto: "0,", numero: 0, excedeu: false });
    expect(mascararTexto(",5")).toEqual({ texto: "0,5", numero: 0.5, excedeu: false });
  });
  it("zeros à esquerda, letras e vazio", () => {
    expect(mascararTexto("007").texto).toBe("7");
    expect(mascararTexto("R$ 12a").texto).toBe("12");
    expect(mascararTexto("")).toEqual({ texto: "", numero: null, excedeu: false });
    expect(mascararTexto("-")).toEqual({ texto: "-", numero: null, excedeu: false });
  });
  it("sinal alterna e respeita negativo:false", () => {
    expect(mascararTexto("-1234").texto).toBe("-1.234");
    expect(mascararTexto("1234-").numero).toBe(-1234);
    expect(mascararTexto("-1234-").numero).toBe(1234);
    expect(mascararTexto("-1234", { negativo: false }).numero).toBe(1234);
  });
  it("limita casas e dígitos inteiros", () => {
    expect(mascararTexto("1,239")).toEqual({ texto: "1,23", numero: 1.23, excedeu: true });
    expect(maxDigitosInteiros(2)).toBe(13);
    expect(mascararTexto("12345678901234").excedeu).toBe(true);
    expect(mascararTexto("1,5", { casas: 0 }).texto).toBe("1");
  });
});

describe("aplicarEdicao — digitação", () => {
  it("1000000 → 1.000.000 com cursor no fim; blur completa ,00", () => {
    const e = digitar("1000000");
    expect(e).toEqual({ texto: "1.000.000", numero: 1000000, cursor: 9 });
    expect(finalizarTexto(e.numero)).toBe("1.000.000,00");
  });
  it("0,52 funciona tecla a tecla", () => {
    expect(digitar("0")).toEqual({ texto: "0", numero: 0, cursor: 1 });
    expect(digitar("0,")).toEqual({ texto: "0,", numero: 0, cursor: 2 });
    expect(digitar("0,5")).toEqual({ texto: "0,5", numero: 0.5, cursor: 3 });
    expect(digitar("0,52")).toEqual({ texto: "0,52", numero: 0.52, cursor: 4 });
  });
  it(",52 vira 0,52", () => {
    expect(digitar(",52")).toEqual({ texto: "0,52", numero: 0.52, cursor: 4 });
  });
  it("ponto no fim vira vírgula (teclado sem vírgula); ponto no meio é ignorado", () => {
    expect(digitar("1500.25")).toEqual({ texto: "1.500,25", numero: 1500.25, cursor: 8 });
    const meio = aplicarEdicao("1.500", "1.5.00", 4);
    expect(meio).toEqual({ texto: "1.500", numero: 1500, cursor: 3 });
  });
  it("segunda vírgula e decimais além de casas são ignorados sem mover o cursor", () => {
    expect(digitar("1,2,3")).toEqual({ texto: "1,23", numero: 1.23, cursor: 4 });
    expect(digitar("1,234")).toEqual({ texto: "1,23", numero: 1.23, cursor: 4 });
    const meio = aplicarEdicao("1,23", "1,523", 3);
    expect(meio).toEqual({ texto: "1,23", numero: 1.23, cursor: 2 });
  });
  it("casas 4 aceita índice com 4 decimais; casas 0 recusa vírgula", () => {
    expect(digitar("0,0575", { casas: 4 }).numero).toBe(0.0575);
    expect(digitar("12,5", { casas: 0 })).toEqual({ texto: "125", numero: 125, cursor: 3 });
  });
  it("negativo: '-' inicial e alternância", () => {
    expect(digitar("-1234,5")).toEqual({ texto: "-1.234,5", numero: -1234.5, cursor: 8 });
    expect(digitar("1234-")).toEqual({ texto: "-1.234", numero: -1234, cursor: 6 });
    expect(digitar("-")).toEqual({ texto: "-", numero: null, cursor: 1 });
    expect(digitar("-5", { negativo: false })).toEqual({ texto: "5", numero: 5, cursor: 1 });
  });
  it("zero e campo apagado", () => {
    expect(digitar("0")).toEqual({ texto: "0", numero: 0, cursor: 1 });
    expect(backspace(digitar("5"))).toEqual({ texto: "", numero: null, cursor: 0 });
  });
  it("digitar no meio mantém o cursor depois do dígito digitado", () => {
    // "1.000" com cursor depois do "1" → digita "5" → "15.000", cursor depois do 5
    const e = digitar("5", {}, { texto: "1.000", numero: 1000, cursor: 1 });
    expect(e).toEqual({ texto: "15.000", numero: 15000, cursor: 2 });
    // "100.000" com cursor no fim; digita "0" → "1.000.000"
    expect(digitar("0", {}, { texto: "100.000", numero: 100000, cursor: 7 })).toEqual({ texto: "1.000.000", numero: 1000000, cursor: 9 });
  });
  it("backspace remove milhar corretamente e mantém o cursor", () => {
    // "1.000" apaga o último 0 → "100"
    expect(backspace({ texto: "1.000", numero: 1000, cursor: 5 })).toEqual({ texto: "100", numero: 100, cursor: 3 });
    // backspace logo depois do ponto apaga o dígito anterior
    expect(backspace({ texto: "12.345", numero: 12345, cursor: 3 })).toEqual({ texto: "1.345", numero: 1345, cursor: 1 });
    // backspace no meio
    expect(backspace({ texto: "1.234.567", numero: 1234567, cursor: 4 })).toEqual({ texto: "124.567", numero: 124567, cursor: 2 });
  });
  it("valores grandes até o limite de dígitos exatos", () => {
    const e = digitar("1234567890123");
    expect(e.texto).toBe("1.234.567.890.123");
    expect(e.numero).toBe(1234567890123);
    expect(digitar("12345678901234").texto).toBe("1.234.567.890.123");
  });
});

describe("aplicarEdicao — colagem", () => {
  const colar = (texto: string, anterior = "", opcoes: OpcoesNumero = {}) => aplicarEdicao(anterior, texto, texto.length, opcoes);
  it("aceita os formatos comuns", () => {
    expect(colar("1.234,56")).toEqual({ texto: "1.234,56", numero: 1234.56, cursor: 8 });
    expect(colar("1234.56")).toEqual({ texto: "1.234,56", numero: 1234.56, cursor: 8 });
    expect(colar("R$ 1.234,56")).toEqual({ texto: "1.234,56", numero: 1234.56, cursor: 8 });
    expect(colar("-1.234,56")).toEqual({ texto: "-1.234,56", numero: -1234.56, cursor: 9 });
    expect(colar("1,234.56")).toEqual({ texto: "1.234,56", numero: 1234.56, cursor: 8 });
    expect(colar("1000000")).toEqual({ texto: "1.000.000", numero: 1000000, cursor: 9 });
  });
  it("arredonda para casas ao colar", () => {
    expect(colar("1234.567").numero).toBe(1234.57);
    expect(colar("0,12345", "", { casas: 4 }).numero).toBe(0.1235);
  });
  it("percentual: ponto colado é decimal", () => {
    expect(colar("2.345", "", { casas: 4, pontoDecimal: true }).numero).toBe(2.345);
  });
  it("substitui todo o texto selecionado", () => {
    expect(aplicarEdicao("9.999,99", "1.234,56", 8)).toEqual({ texto: "1.234,56", numero: 1234.56, cursor: 8 });
  });
  it("colagem sem dígitos não quebra", () => {
    expect(colar("abc")).toEqual({ texto: "", numero: null, cursor: 0 });
  });
});

describe("posicionarCursor", () => {
  it("mantém os dígitos à direita", () => {
    expect(posicionarCursor("1000", 4, "1.000")).toBe(5);
    expect(posicionarCursor("1000", 1, "1.000")).toBe(1);
    expect(posicionarCursor("10000", 2, "10.000")).toBe(2);
    expect(posicionarCursor(",5", 1, "0,5")).toBe(2);
    expect(posicionarCursor("-1234", 1, "-1.234")).toBe(1);
    expect(posicionarCursor("", 0, "")).toBe(0);
  });
});

describe("aplicarEdicao — percentual (pontoDecimal)", () => {
  it("ponto digitado no meio vira decimal", () => {
    const e = aplicarEdicao("2345", "2.345", 2, { casas: 4, pontoDecimal: true });
    expect(e).toEqual({ texto: "2,345", numero: 2.345, cursor: 2 });
  });
  it("digitação tecla a tecla com ponto", () => {
    expect(digitar("2.345", { casas: 4, pontoDecimal: true }).numero).toBe(2.345);
  });
});
