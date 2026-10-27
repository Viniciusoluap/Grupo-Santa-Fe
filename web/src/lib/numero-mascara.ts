// Correção 21 (AD-01) — máscara numérica pt-BR única dos dois sistemas.
//
// Lógica pura (sem React, sem DOM) por trás do `NumeroInput`
// (`web/src/components/ui/numero-input.tsx`). Gêmea, com o mesmo texto,
// de `shared/numero-mascara.ts` na Prospecta — qualquer mudança
// aqui deve ser espelhada lá.
//
// Modelo de digitação (decidido em 27/10):
//  - Digitação livre com vírgula decimal: os pontos de milhar aparecem
//    enquanto a pessoa digita ("1000000" -> "1.000.000"); as casas decimais
//    só são completadas ao sair do campo ("1.000.000" -> "1.000.000,00").
//  - "," inicia os decimais. Um "." digitado NO FIM do texto também vira
//    vírgula (teclado numérico do iPhone/Android sem vírgula); "." digitado
//    no meio é ignorado (o milhar é posto pela própria máscara) — exceto com
//    `pontoDecimal` (percentuais), em que ponto digitado é sempre decimal.
//  - Decimais limitados a `casas`: tecla que excederia é ignorada (o texto
//    não muda e o cursor não pula).
//  - "-" em qualquer posição alterna o sinal (quando `negativo` permitido).
//  - Colagem ("1.234,56", "1234.56", "R$ 1.234,56", "1,234.56") é
//    interpretada por `lerNumero` e arredondada para `casas`.
//  - Backspace logo depois de um ponto de milhar apaga o dígito anterior
//    (senão a máscara recolocaria o ponto e a tecla pareceria travada).
//  - Cursor: a nova posição mantém a mesma quantidade de dígitos (e vírgula)
//    à direita — estável mesmo quando a máscara insere/remove pontos
//    (inclusive no Safari do iPhone, que move o cursor para o fim quando o
//    `value` do input muda).
//
// Formatação só na exibição: quem usa guarda o `number` devolvido; nenhum
// arredondamento é aplicado ao valor recebido de fora (só ao texto exibido).

export interface OpcoesNumero {
  /** Máximo de casas decimais aceitas/exibidas (padrão 2). */
  casas?: number;
  /** Casas sempre exibidas ao formatar (padrão = `casas`). Ex.: casas 4, mínimas 2 → "6,00" e "2,345". */
  casasMinimas?: number;
  /** Permite valores negativos (padrão true). */
  negativo?: boolean;
  /**
   * Colagem: um ponto sozinho é sempre decimal ("2.345" = 2,345). Usado nos
   * percentuais (mesma regra de `lerPercentualDigitado`). Sem esta opção, um
   * ponto que forma milhar válido é milhar ("1.000" = 1000; "1234.567" é decimal).
   */
  pontoDecimal?: boolean;
}

export interface EstadoNumero {
  /** Texto a exibir no campo. */
  texto: string;
  /** Valor numérico (null = campo vazio ou só "-"). */
  numero: number | null;
  /** Posição do cursor no texto exibido. */
  cursor: number;
}

const CASAS_PADRAO = 2;

function normalizarCasas(casas: number | undefined): number {
  const n = casas ?? CASAS_PADRAO;
  return Number.isInteger(n) && n >= 0 ? Math.min(n, 10) : CASAS_PADRAO;
}

/** Dígitos inteiros aceitos: mantém o total em até 15 dígitos significativos (exatos em `number`). */
export function maxDigitosInteiros(casas?: number): number {
  return Math.max(1, 15 - normalizarCasas(casas));
}

function agruparMilhar(inteiro: string): string {
  return inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Valor absoluto arredondado (meio para cima) como texto "1234.50". */
function arredondarAbs(valor: number, casas: number): string {
  const abs = Math.abs(valor);
  const s = String(abs);
  let fixo: string;
  if (s.includes("e") || abs >= 1e15) {
    fixo = abs.toFixed(casas);
  } else {
    // Arredonda pela representação decimal ("1.005e2" = 100,5 exato), evitando
    // o erro clássico de `toFixed` (1.005.toFixed(2) === "1.00").
    fixo = Number(`${Math.round(Number(`${s}e${casas}`))}e-${casas}`).toFixed(casas);
  }
  if (fixo.includes("e")) {
    fixo = abs.toLocaleString("en-US", { useGrouping: false, minimumFractionDigits: casas, maximumFractionDigits: casas });
  }
  return fixo;
}

/**
 * Formata no padrão brasileiro: "1.000.000,00", "0,52", "0,00", "-1.234,56".
 * `null`/`undefined`/`NaN`/infinito → "".
 */
export function formatarNumero(valor: number | null | undefined, opcoes: OpcoesNumero = {}): string {
  if (valor == null || !Number.isFinite(valor)) return "";
  const casas = normalizarCasas(opcoes.casas);
  const minimas = Math.min(normalizarCasas(opcoes.casasMinimas ?? casas), casas);
  const [inteiro, decimaisFixos = ""] = arredondarAbs(valor, casas).split(".");
  let decimais = decimaisFixos;
  while (decimais.length > minimas && decimais.endsWith("0")) decimais = decimais.slice(0, -1);
  const ehZero = /^0*$/.test(inteiro + decimais);
  const sinal = valor < 0 && !ehZero && opcoes.negativo !== false ? "-" : "";
  return `${sinal}${agruparMilhar(inteiro)}${decimais ? `,${decimais}` : ""}`;
}

interface Partes {
  negativo: boolean;
  inteiro: string;
  decimais: string;
}

/** Separa um texto livre (colado, importado, digitado) em sinal, inteiro e decimais. */
function decompor(texto: string, pontoDecimal: boolean): Partes | null {
  const limpo = texto.replace(/[^\d,.-]/g, "");
  if (!/\d/.test(limpo)) return null;
  const negativo = limpo.includes("-");
  const s = limpo.replace(/-/g, "");
  const ultimaVirgula = s.lastIndexOf(",");
  const ultimoPonto = s.lastIndexOf(".");
  const virgulas = (s.match(/,/g) ?? []).length;
  const pontos = (s.match(/\./g) ?? []).length;

  let separador = -1;
  if (virgulas > 0 && pontos > 0) {
    // "1.234,56" (BR) ou "1,234.56" (EUA): o último separador é o decimal.
    separador = Math.max(ultimaVirgula, ultimoPonto);
  } else if (virgulas > 0) {
    // Só vírgula: uma = decimal (BR); várias = milhar ("1,234,567").
    separador = virgulas === 1 ? ultimaVirgula : -1;
  } else if (pontos === 1) {
    // Só um ponto: decimal, salvo milhar BR válido ("1.000", "250.000":
    // 1–3 dígitos antes e exatamente 3 depois). "1234.567" é decimal.
    const depois = s.length - ultimoPonto - 1;
    const milharValido = depois === 3 && ultimoPonto >= 1 && ultimoPonto <= 3;
    separador = pontoDecimal || !milharValido ? ultimoPonto : -1;
  }

  const inteiro = (separador >= 0 ? s.slice(0, separador) : s).replace(/\D/g, "");
  const decimais = separador >= 0 ? s.slice(separador + 1).replace(/\D/g, "") : "";
  return { negativo, inteiro, decimais };
}

/**
 * Lê um número escrito em texto livre sem perder precisão (não arredonda):
 * "1.234,56", "1234,56", "1234.56", "R$ 1.234,56", "-1.234,56", "1,234.56",
 * "2.345" (com `pontoDecimal`) … Vazio/sem dígitos → null.
 */
export function lerNumero(texto: string | number | null | undefined, opcoes: OpcoesNumero = {}): number | null {
  if (texto == null) return null;
  if (typeof texto === "number") return Number.isFinite(texto) ? texto : null;
  const partes = decompor(texto, opcoes.pontoDecimal === true);
  if (!partes) return null;
  const n = Number(`${partes.inteiro || "0"}.${partes.decimais || "0"}`);
  if (!Number.isFinite(n)) return null;
  const v = partes.negativo && opcoes.negativo !== false ? -n : n;
  return v === 0 ? 0 : v;
}

/**
 * Aplica a máscara a um texto em edição (ponto = milhar já posto pela
 * máscara, vírgula = decimal). `excedeu` indica que decimais/dígitos foram
 * descartados por passarem do limite.
 */
export function mascararTexto(
  bruto: string,
  opcoes: OpcoesNumero = {}
): { texto: string; numero: number | null; excedeu: boolean } {
  const casas = normalizarCasas(opcoes.casas);
  const sinais = (bruto.match(/-/g) ?? []).length;
  const negativo = opcoes.negativo !== false && sinais % 2 === 1;
  const s = bruto.replace(/[^\d,]/g, "");
  const virgula = s.indexOf(",");
  const temVirgula = virgula >= 0 && casas > 0;
  let inteiro = (virgula >= 0 ? s.slice(0, virgula) : s).replace(/^0+(?=\d)/, "");
  let decimais = virgula >= 0 && casas > 0 ? s.slice(virgula + 1).replace(/,/g, "") : "";
  let excedeu = false;
  if (decimais.length > casas) {
    decimais = decimais.slice(0, casas);
    excedeu = true;
  }
  const limite = maxDigitosInteiros(casas);
  if (inteiro.length > limite) {
    inteiro = inteiro.slice(0, limite);
    excedeu = true;
  }
  if (!inteiro && !temVirgula) return { texto: negativo ? "-" : "", numero: null, excedeu };
  const int = inteiro || "0";
  const texto = `${negativo ? "-" : ""}${agruparMilhar(int)}${temVirgula ? `,${decimais}` : ""}`;
  const absoluto = Number(`${int}.${decimais || "0"}`);
  const numero = negativo && absoluto !== 0 ? -absoluto : absoluto;
  return { texto, numero, excedeu };
}

const contarSignificativos = (t: string) => (t.match(/[\d,]/g) ?? []).length;

/**
 * Nova posição do cursor no texto mascarado: a mesma quantidade de dígitos
 * (e vírgula) que estava à direita do cursor no texto digitado.
 */
export function posicionarCursor(textoDigitado: string, cursorDigitado: number, textoMascarado: string): number {
  const direita = contarSignificativos(textoDigitado.slice(Math.max(0, cursorDigitado)));
  const inicio = textoMascarado.startsWith("-") ? 1 : 0;
  let restante = contarSignificativos(textoMascarado);
  if (direita >= restante) return inicio;
  for (let p = 0; p < textoMascarado.length; p++) {
    if (restante === direita) return Math.max(p, inicio);
    if (/[\d,]/.test(textoMascarado[p])) restante--;
  }
  return textoMascarado.length;
}

/** Trecho colado → texto canônico de edição (arredondado para `casas`). */
function canonizarColagem(trecho: string, opcoes: OpcoesNumero): string {
  const casas = normalizarCasas(opcoes.casas);
  const partes = decompor(trecho, opcoes.pontoDecimal === true);
  const numero = lerNumero(trecho, opcoes);
  if (!partes || numero == null) return "";
  return formatarNumero(numero, { casas, casasMinimas: Math.min(partes.decimais.length, casas), negativo: opcoes.negativo });
}

/**
 * Uma edição do campo: recebe o texto anterior (já mascarado), o texto que o
 * navegador produziu e a posição do cursor depois da edição; devolve o texto
 * mascarado, o número e a nova posição do cursor.
 */
export function aplicarEdicao(
  anterior: string,
  novo: string,
  cursor: number | null | undefined,
  opcoes: OpcoesNumero = {}
): EstadoNumero {
  const casas = normalizarCasas(opcoes.casas);
  let texto = novo;
  let pos = cursor == null ? novo.length : Math.max(0, Math.min(cursor, novo.length));
  const delta = novo.length - anterior.length;

  const rejeitar = (): EstadoNumero => ({
    texto: anterior,
    numero: mascararTexto(anterior, opcoes).numero,
    cursor: Math.max(0, Math.min(pos - Math.max(delta, 0), anterior.length)),
  });

  // Inserção simples na posição do cursor (tecla ou colagem sem seleção)?
  const insercaoNoCursor =
    delta > 0 && pos >= delta && novo.slice(0, pos - delta) + novo.slice(pos) === anterior;

  if (insercaoNoCursor && delta === 1) {
    const tecla = novo[pos - 1];
    const posTecla = pos - 1;
    if (tecla === "," || tecla === ".") {
      const noFim = posTecla === anterior.length;
      // Ponto no meio é milhar digitado (a máscara já põe) — salvo em
      // percentuais (`pontoDecimal`), onde ponto é sempre decimal.
      if (tecla === "." && !noFim && !opcoes.pontoDecimal) return rejeitar();
      if (casas === 0 || anterior.includes(",")) return rejeitar();
      texto = `${novo.slice(0, posTecla)},${novo.slice(pos)}`;
    } else if (/\d/.test(tecla) && mascararTexto(novo, opcoes).excedeu) {
      return rejeitar();
    }
  } else if (
    delta === -1 &&
    pos > 0 &&
    anterior[pos] === "." &&
    novo === anterior.slice(0, pos) + anterior.slice(pos + 1)
  ) {
    // Backspace sobre o ponto de milhar: apaga o dígito anterior.
    texto = novo.slice(0, pos - 1) + novo.slice(pos);
    pos -= 1;
  } else {
    // Colagem/substituição: o trecho novo é lido como número livre.
    let prefixo = 0;
    const limite = Math.min(anterior.length, novo.length);
    while (prefixo < limite && anterior[prefixo] === novo[prefixo]) prefixo++;
    let sufixo = 0;
    while (
      sufixo < limite - prefixo &&
      anterior[anterior.length - 1 - sufixo] === novo[novo.length - 1 - sufixo]
    ) sufixo++;
    const trecho = novo.slice(prefixo, novo.length - sufixo);
    if (trecho.length > 1 && /\d/.test(trecho)) {
      const canonico = canonizarColagem(trecho, opcoes);
      const antes = novo.slice(0, prefixo);
      const depois = novo.slice(novo.length - sufixo);
      const juntos = antes + canonico + depois;
      const substituiuTudo = !/\d/.test(antes + depois);
      if (substituiuTudo || (juntos.match(/,/g) ?? []).length > 1 || (/-/.test(antes + depois) && canonico.startsWith("-"))) {
        texto = canonico;
        pos = canonico.length;
      } else {
        texto = juntos;
        pos = prefixo + canonico.length;
      }
    }
  }

  const m = mascararTexto(texto, opcoes);
  return { texto: m.texto, numero: m.numero, cursor: posicionarCursor(texto, pos, m.texto) };
}

/** Texto exibido ao sair do campo (casas completadas): 1000000 → "1.000.000,00". */
export function finalizarTexto(numero: number | null | undefined, opcoes: OpcoesNumero = {}): string {
  return formatarNumero(numero, opcoes);
}
