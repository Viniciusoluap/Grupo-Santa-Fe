// EPIC-020 Lote 4 (item 27) — progresso físico da obra por incidência.
// Mesmo arquivo em Grupo-Santa-Fe/web/src/lib/financeiro/progresso.ts.
//
// Cada um dos 20 serviços tem uma Incidência (peso na obra, %) e uma Execução
// do Item (0–100%). Execução na Obra = Incidência × Execução / 100.
// Progresso Geral = Mensurado Acumulado Total = soma das execuções na obra.
// Aritmética exata em BigInt (15 casas decimais) e HALF_UP só no resultado —
// Teste E: 28,196% → exibido 28,20%.
//
// Pedido de 18/10: a incidência vinculada da PCI da CAIXA é guardada com
// todas as casas da planilha (ex.: 6,99999622399988) para o total fechar 100%
// exatamente como no arquivo. A Execução do Item continua com até 4 casas.

import { dividirHalfUp } from "./obra";

export interface ServicoProgresso {
  chave: string;
  nome: string;
  /** Incidência inicial sugerida (%), editável por obra. */
  incidenciaPadrao: string;
}

export const SERVICOS_PROGRESSO: readonly ServicoProgresso[] = [
  { chave: "preliminares", nome: "Serviços Preliminares e Gerais", incidenciaPadrao: "3.10" },
  { chave: "infraestrutura", nome: "Infraestrutura", incidenciaPadrao: "7.00" },
  { chave: "supraestrutura", nome: "Supra estrutura", incidenciaPadrao: "12.50" },
  { chave: "paredes", nome: "Paredes e Painéis", incidenciaPadrao: "8.00" },
  { chave: "esquadrias", nome: "Esquadrias", incidenciaPadrao: "4.50" },
  { chave: "vidros", nome: "Vidros e Plásticos", incidenciaPadrao: "0.00" },
  { chave: "coberturas", nome: "Coberturas", incidenciaPadrao: "5.00" },
  { chave: "impermeabilizacoes", nome: "Impermeabilizações", incidenciaPadrao: "9.00" },
  { chave: "revestimentos_internos", nome: "Revestimentos Internos", incidenciaPadrao: "6.90" },
  { chave: "forros", nome: "Forros", incidenciaPadrao: "1.00" },
  { chave: "revestimentos_externos", nome: "Revestimentos Externos", incidenciaPadrao: "4.00" },
  { chave: "pintura", nome: "Pintura", incidenciaPadrao: "3.70" },
  { chave: "pisos", nome: "Pisos", incidenciaPadrao: "8.50" },
  { chave: "acabamentos", nome: "Acabamentos", incidenciaPadrao: "1.11" },
  { chave: "eletricas", nome: "Inst. Elétricas e Telefônicas", incidenciaPadrao: "3.80" },
  { chave: "hidraulicas", nome: "Instalações Hidráulicas", incidenciaPadrao: "3.70" },
  { chave: "esgoto", nome: "Inst. Esgoto e Águas Pluviais", incidenciaPadrao: "3.70" },
  { chave: "loucas_metais", nome: "Louças e Metais", incidenciaPadrao: "4.20" },
  { chave: "complementos", nome: "Complementos", incidenciaPadrao: "0.30" },
  { chave: "outros", nome: "Outros Serviços", incidenciaPadrao: "9.99" },
];

const CHAVES = new Set(SERVICOS_PROGRESSO.map((s) => s.chave));
const B0 = BigInt(0);
/** Casas decimais da aritmética interna (precisão da planilha da CAIXA). */
const CASAS = 15;
const potencia10 = (n: number) => BigInt("1" + "0".repeat(n));
const ESCALA = potencia10(CASAS);
const CEM = BigInt(100) * ESCALA;
/** inc × exec / 100% → mesma escala: divide por 100 × 10¹⁵. */
const DIVISOR_PRODUTO = BigInt(100) * ESCALA;
/** Arredondamentos de ponto flutuante da planilha (ex.: 100,00000000000001%). */
const TOLERANCIA_SOMA = potencia10(CASAS - 9);
const MAX_CASAS_EXECUCAO = 4;
const MAX_CASAS_INCIDENCIA = CASAS;

export interface ItemProgressoEntrada {
  chave: string;
  incidencia: string | number | null;
  execucao: string | number | null;
}

export interface ItemProgressoCalculado {
  chave: string;
  nome: string;
  incidencia: number;
  execucao: number;
  /** Execução na Obra (%), sem arredondamento de exibição. */
  execucaoObra: number;
}

export interface ResultadoProgresso {
  itens: ItemProgressoCalculado[];
  somaIncidencia: number;
  /** Mensurado Acumulado Total = Progresso Geral (%). */
  progresso: number;
  distribuicaoCompleta: boolean;
  erros: string[];
  avisos: string[];
}

const paraNumero = (v: bigint) => {
  const negativo = v < B0;
  const a = negativo ? -v : v;
  const n = Number(`${a / ESCALA}.${(a % ESCALA).toString().padStart(CASAS, "0")}`);
  return negativo ? -n : n;
};

/** Texto/número → BigInt na escala interna (15 casas), sem perder dígitos. */
function percentualEscala(p: string | number): bigint | null {
  const texto = typeof p === "number" ? (Number.isFinite(p) ? numeroParaTexto(p) : "") : String(p).trim();
  if (!/^-?\d+(\.\d+)?$/.test(texto)) return null;
  const negativo = texto.startsWith("-");
  const [inteiro, frac = ""] = texto.replace("-", "").split(".");
  const v = BigInt(inteiro) * ESCALA + BigInt((frac + "0".repeat(CASAS)).slice(0, CASAS));
  return negativo ? -v : v;
}

/** Número em texto decimal, sem notação científica (até 15 casas). */
function numeroParaTexto(n: number): string {
  if (Number.isInteger(n)) return String(n);
  const t = String(n);
  if (!/e/i.test(t)) return t;
  return n.toFixed(CASAS).replace(/0+$/, "").replace(/\.$/, "");
}

function casasDecimais(v: string | number): number {
  const t = typeof v === "number" ? String(v) : v.trim();
  const i = t.indexOf(".");
  return i < 0 ? 0 : t.length - i - 1;
}

function lerPercentual(v: string | number | null, rotulo: string, erros: string[], maxCasas: number): bigint | null {
  if (v === null || v === undefined || String(v).trim() === "") {
    erros.push(`${rotulo}: não informado`);
    return null;
  }
  const m = percentualEscala(v);
  if (m === null) {
    erros.push(`${rotulo}: valor inválido`);
    return null;
  }
  if (casasDecimais(v) > maxCasas) erros.push(`${rotulo}: no máximo ${maxCasas} casas decimais`);
  if (m < B0) erros.push(`${rotulo}: não pode ser negativo`);
  else if (m > CEM) erros.push(`${rotulo}: não pode passar de 100%`);
  return m;
}

/** Os 20 serviços com as incidências iniciais e execução 0%. */
export function itensProgressoIniciais(): ItemProgressoEntrada[] {
  return SERVICOS_PROGRESSO.map((s) => ({ chave: s.chave, incidencia: s.incidenciaPadrao, execucao: "0" }));
}

/** Completa o que está salvo com os serviços que faltarem (incidência padrão, execução 0). */
export function mesclarComPadrao(salvos: ItemProgressoEntrada[]): ItemProgressoEntrada[] {
  const porChave = new Map(salvos.map((i) => [i.chave, i]));
  return SERVICOS_PROGRESSO.map(
    (s) => porChave.get(s.chave) ?? { chave: s.chave, incidencia: s.incidenciaPadrao, execucao: "0" }
  );
}

export function calcularProgresso(entrada: ItemProgressoEntrada[]): ResultadoProgresso {
  const erros: string[] = [];
  const avisos: string[] = [];
  const vistos = new Set<string>();
  for (const i of entrada) {
    if (!CHAVES.has(i.chave)) erros.push(`Serviço desconhecido: ${i.chave}`);
    else if (vistos.has(i.chave)) erros.push(`Serviço repetido: ${i.chave}`);
    vistos.add(i.chave);
  }
  const porChave = new Map(entrada.map((i) => [i.chave, i]));
  let soma = B0;
  let acumulado = B0;
  const itens: ItemProgressoCalculado[] = [];
  for (const s of SERVICOS_PROGRESSO) {
    const e = porChave.get(s.chave);
    if (!e) {
      erros.push(`${s.nome}: serviço ausente`);
      continue;
    }
    const inc = lerPercentual(e.incidencia, `${s.nome} — Incidência`, erros, MAX_CASAS_INCIDENCIA) ?? B0;
    const exe = lerPercentual(e.execucao, `${s.nome} — Execução do Item`, erros, MAX_CASAS_EXECUCAO) ?? B0;
    const produto = inc * exe;
    soma += inc;
    acumulado += produto;
    itens.push({
      chave: s.chave,
      nome: s.nome,
      incidencia: paraNumero(inc),
      execucao: paraNumero(exe),
      execucaoObra: paraNumero(dividirHalfUp(produto, DIVISOR_PRODUTO)),
    });
  }
  if (soma > CEM + TOLERANCIA_SOMA) erros.push(`A soma das incidências (${formatarPercentual(paraNumero(soma))}) passa de 100%.`);
  const distribuicaoCompleta = soma >= CEM - TOLERANCIA_SOMA && soma <= CEM + TOLERANCIA_SOMA;
  if (soma < CEM - TOLERANCIA_SOMA)
    avisos.push(
      `Distribuição incompleta: a soma das incidências é ${formatarPercentual(paraNumero(soma))} (faltam ${formatarPercentual(paraNumero(CEM - soma))}).`
    );
  return {
    itens,
    somaIncidencia: paraNumero(soma),
    progresso: paraNumero(dividirHalfUp(acumulado, DIVISOR_PRODUTO)),
    distribuicaoCompleta,
    erros,
    avisos,
  };
}

/** Percentual no padrão brasileiro com HALF_UP: 28.196 → "28,20%". */
export function formatarPercentual(valor: number, casas = 2): string {
  const microV = BigInt(Math.round(valor * 1_000_000));
  const arred = Number(dividirHalfUp(microV, BigInt(10 ** (6 - casas)))) / 10 ** casas;
  return `${arred.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

/** Progresso exibido nas telas: o medido por incidência ou, sem medição, o valor antigo digitado. */
export function progressoDaObra(medido: string | number | null | undefined, legado: number | null | undefined): number {
  const m = medido === null || medido === undefined || medido === "" ? NaN : Number(medido);
  return Number.isFinite(m) ? m : Number(legado ?? 0);
}
