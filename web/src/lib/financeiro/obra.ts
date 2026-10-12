// Motor financeiro da Obra (EPIC-020, Lote 2) — FONTE ÚNICA das fórmulas.
// Arquivo idêntico em Prospecta (`shared/financeiro/obra.ts`) e Grupo Santa Fé
// (`web/src/lib/financeiro/obra.ts`). Qualquer alteração precisa ser feita nos
// dois e as fórmulas só mudam com decisão do dono (matriz do HANDOFF, §4).
//
// Política monetária: valores em CENTAVOS inteiros; produtos com percentuais
// em BigInt (percentual em milionésimos de ponto percentual); arredondamento
// HALF_UP (meio centavo para longe do zero) somente no resultado final.
// `null` = não informado (nunca vira zero); negativos legítimos são mantidos.

export type Natureza = "entrada" | "recebimento_cef" | "pagamento";
export type StatusMovimento = "confirmado" | "cancelado";

export type Indicador =
  | { ok: true; centavos: number }
  | { ok: false; motivo: string };

export interface MovimentoCalculo {
  natureza: Natureza;
  valorCentavos: number;
  status: StatusMovimento;
}

export interface ParticipacaoInvestidor {
  id: string | number;
  percentual: number | string;
}

export interface EntradasObra {
  vgv: number | null;
  financiamento: number | null;
  fgts: number | null;
  subsidio: number | null;
  custoTerreno: number | null;
  comissao: number | null;
  orcamentoPrevisto: number | null;
  taxaMensalPct: number | string | null;
  parcelas: number | null;
  dataInicio: string | null;
  dataTerminoPrevista: string | null;
  investidores: ParticipacaoInvestidor[];
  percentualEmpreiteiro: number | string | null;
  movimentos: MovimentoCalculo[];
}

export interface LucroInvestidorCalculado {
  id: string | number;
  percentual: number;
  lucro: Indicador;
}

export interface ResultadoObra {
  entradaTotal: Indicador;
  entradaPaga: Indicador;
  saldoEntrada: Indicador;
  proSoluto: Indicador;
  valorParcela: Indicador;
  recebidoCef: Indicador;
  receberBanco: Indicador;
  basePls: Indicador;
  /** Percentual com 6 casas decimais exatas (arredondar só na exibição). */
  plsReal: { ok: true; percentual: number } | { ok: false; motivo: string };
  totalGasto: Indicador;
  saldoRestante: Indicador;
  custoConstrucao: Indicador;
  gastoObraRealizado: Indicador;
  lucroEstimado: Indicador;
  investidores: LucroInvestidorCalculado[];
  lucroInvestidores: Indicador;
  baseEmpreiteiro: Indicador;
  lucroEmpreiteiro: Indicador;
  lucroEmpresa: Indicador;
  diasObra: { ok: true; dias: number } | { ok: false; motivo: string };
  alertas: string[];
}

const B0 = BigInt(0);
const B2 = BigInt(2);
const B100 = BigInt(100);
const B10000 = BigInt(10000);
const MICRO = BigInt(1_000_000);
const CEM_POR_CENTO = B100 * MICRO;

/** Converte reais (número ou texto decimal "1234.56") em centavos. Inválido → null. */
export function centavosDe(valor: string | number | null | undefined): number | null {
  if (valor === null || valor === undefined) return null;
  const texto = typeof valor === "number" ? (Number.isFinite(valor) ? valor.toFixed(4) : "") : String(valor).trim();
  if (!/^-?\d+(\.\d+)?$/.test(texto)) return null;
  const negativo = texto.startsWith("-");
  const [inteiro, frac = ""] = texto.replace("-", "").split(".");
  const fracPadded = (frac + "0000").slice(0, 4);
  const em10000 = BigInt(inteiro) * B10000 + BigInt(fracPadded);
  const centavos = dividirHalfUp(em10000, B100);
  return Number(negativo ? -centavos : centavos);
}

/** Centavos → reais em texto decimal com 2 casas (para gravar em DECIMAL). */
export function reaisDeCentavos(centavos: number): string {
  const negativo = centavos < 0;
  const abs = Math.abs(centavos);
  const texto = `${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  return negativo ? `-${texto}` : texto;
}

/** Percentual ("1,5" não — use ponto) → milionésimos de ponto percentual. */
export function percentualMicro(p: number | string | null | undefined): bigint | null {
  if (p === null || p === undefined || p === "") return null;
  const texto = typeof p === "number" ? (Number.isFinite(p) ? p.toFixed(6) : "") : String(p).trim();
  if (!/^-?\d+(\.\d+)?$/.test(texto)) return null;
  const negativo = texto.startsWith("-");
  const [inteiro, frac = ""] = texto.replace("-", "").split(".");
  const v = BigInt(inteiro) * MICRO + BigInt((frac + "000000").slice(0, 6));
  return negativo ? -v : v;
}

/** Divisão inteira com arredondamento HALF_UP (meio para longe do zero). */
export function dividirHalfUp(numerador: bigint, denominador: bigint): bigint {
  if (denominador === B0) throw new Error("Divisão por zero");
  const negativo = (numerador < B0) !== (denominador < B0);
  const n = numerador < B0 ? -numerador : numerador;
  const d = denominador < B0 ? -denominador : denominador;
  const q = (B2 * n + d) / (B2 * d);
  return negativo ? -q : q;
}

/** valor × percentual / 100, em centavos, HALF_UP. */
export function aplicarPercentual(centavos: number, percentual: bigint): number {
  return Number(dividirHalfUp(BigInt(centavos) * percentual, CEM_POR_CENTO));
}

const ok = (centavos: number): { ok: true; centavos: number } => ({ ok: true, centavos });
const falta = (motivo: string): Indicador => ({ ok: false, motivo });

function primeiraFalha(...indicadores: Indicador[]): Indicador {
  const falha = indicadores.find((i): i is { ok: false; motivo: string } => !i.ok);
  return falta(falha?.motivo ?? "Cálculo indisponível");
}

function exigir(campos: Record<string, number | null>): string | null {
  const ausentes = Object.entries(campos).filter(([, v]) => v === null).map(([k]) => k);
  return ausentes.length ? `Informe: ${ausentes.join(", ")}` : null;
}

function somar(movimentos: MovimentoCalculo[], natureza: Natureza): number {
  return movimentos
    .filter((m) => m.natureza === natureza && m.status === "confirmado")
    .reduce((acc, m) => acc + m.valorCentavos, 0);
}

/**
 * Parcela pelo sistema Price, equivalente à HP 12C em modo END:
 * PMT = PV × i / [1 − (1+i)^(−n)]. Taxa em % ao mês (1,50% → 1.5).
 */
export function parcelaPrice(pvCentavos: number | null, taxaPct: number | string | null, parcelas: number | null): Indicador {
  if (pvCentavos === null) return falta("Cálculo indisponível: saldo da entrada não calculado");
  if (pvCentavos < 0) return falta("Pagamento a maior: não há saldo a parcelar");
  if (pvCentavos === 0) return falta("Sem saldo a parcelar");
  const taxa = percentualMicro(taxaPct);
  if (taxa === null || parcelas === null) return falta("Cálculo indisponível: informe taxa mensal e quantidade de parcelas");
  if (!Number.isInteger(parcelas) || parcelas < 0) return falta("Quantidade de parcelas inválida");
  if (parcelas === 0) return falta("Quantidade de parcelas igual a zero: cálculo não realizado");
  if (taxa < B0) return falta("Taxa mensal negativa não é aceita");
  if (taxa === B0) return ok(Number(dividirHalfUp(BigInt(pvCentavos), BigInt(parcelas))));
  const i = Number(taxa) / 1e8;
  const pmt = (pvCentavos * i) / (1 - Math.pow(1 + i, -parcelas));
  return ok(arredondarHalfUp(pmt));
}

/** Arredonda um valor em centavos (com fração) para centavo inteiro, HALF_UP. */
export function arredondarHalfUp(valor: number): number {
  const sinal = valor < 0 ? -1 : 1;
  const abs = Math.abs(valor);
  // Tolerância para representações binárias como 69894.99999999999.
  return sinal * Math.floor(abs + 0.5 + 1e-9);
}

/** Dias corridos entre duas datas "AAAA-MM-DD" (sem fuso horário). */
export function diasEntre(inicio: string | null, termino: string | null): { ok: true; dias: number } | { ok: false; motivo: string } {
  if (!inicio || !termino) return { ok: false, motivo: "Informe data de início e término previsto" };
  const parse = (d: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
    return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : NaN;
  };
  const a = parse(inicio);
  const b = parse(termino);
  if (Number.isNaN(a) || Number.isNaN(b)) return { ok: false, motivo: "Data inválida" };
  const dias = Math.round((b - a) / 86_400_000);
  if (dias < 0) return { ok: false, motivo: "Término previsto anterior ao início" };
  return { ok: true, dias };
}

export function calcularObra(e: EntradasObra): ResultadoObra {
  const alertas: string[] = [];

  const faltaEntrada = exigir({ VGV: e.vgv, "Financiamento CEF": e.financiamento, FGTS: e.fgts, "Subsídio": e.subsidio });
  const entradaTotal = faltaEntrada ? falta(faltaEntrada) : ok(e.vgv! - e.financiamento! - e.fgts! - e.subsidio!);
  const entradaPaga = ok(somar(e.movimentos, "entrada"));
  const saldoEntrada = entradaTotal.ok && entradaPaga.ok ? ok(entradaTotal.centavos - entradaPaga.centavos) : primeiraFalha(entradaTotal, entradaPaga);
  if (saldoEntrada.ok && saldoEntrada.centavos < 0) alertas.push("Entrada paga acima da entrada total (pagamento a maior).");
  if (entradaTotal.ok && entradaTotal.centavos < 0) alertas.push("Entrada total negativa: financiamento + FGTS + subsídio superam o VGV.");
  const proSoluto = saldoEntrada;
  const valorParcela = parcelaPrice(proSoluto.ok ? proSoluto.centavos : null, e.taxaMensalPct, e.parcelas);

  const recebidoCef = ok(somar(e.movimentos, "recebimento_cef"));
  const faltaBanco = exigir({ "Financiamento CEF": e.financiamento, "Subsídio": e.subsidio, FGTS: e.fgts, "Custo do Terreno": e.custoTerreno });
  const basePls = faltaBanco ? falta(faltaBanco) : ok(e.financiamento! + e.subsidio! + e.fgts! - e.custoTerreno!);
  const receberBanco = basePls.ok ? ok(basePls.centavos - recebidoCef.centavos) : basePls;
  if (receberBanco.ok && receberBanco.centavos < 0) alertas.push("Recebido da CEF acima da base contratual.");
  let plsReal: ResultadoObra["plsReal"];
  if (!basePls.ok) plsReal = { ok: false, motivo: basePls.motivo };
  else if (basePls.centavos <= 0) plsReal = { ok: false, motivo: "Base do PLS igual ou menor que zero: cálculo inválido" };
  else {
    const micro = dividirHalfUp(BigInt(recebidoCef.centavos) * CEM_POR_CENTO, BigInt(basePls.centavos));
    plsReal = { ok: true, percentual: Number(micro) / 1e6 };
  }

  const totalGasto = ok(somar(e.movimentos, "pagamento"));
  const saldoRestante = e.vgv === null ? falta("Informe: VGV") : ok(e.vgv - totalGasto.centavos);
  const custoConstrucao = e.orcamentoPrevisto === null ? falta("Informe: Orçamento Previsto") : ok(e.orcamentoPrevisto);
  const gastoObraRealizado = totalGasto;

  const faltaLucro = exigir({ VGV: e.vgv, "Custo do Terreno": e.custoTerreno, "Comissão": e.comissao, "Orçamento Previsto": e.orcamentoPrevisto });
  const lucroEstimado = faltaLucro ? falta(faltaLucro) : ok(e.vgv! - e.custoTerreno! - e.comissao! - e.orcamentoPrevisto!);
  if (lucroEstimado.ok && lucroEstimado.centavos < 0) alertas.push("Lucro estimado negativo (prejuízo estimado).");

  const percentuaisInvestidores = e.investidores.map((inv) => ({ inv, micro: percentualMicro(inv.percentual) }));
  const invalidoInvestidor = percentuaisInvestidores.find((p) => p.micro === null || p.micro < B0 || p.micro > CEM_POR_CENTO);
  const somaInvestidores = percentuaisInvestidores.reduce((acc, p) => acc + (p.micro ?? B0), B0);
  let erroInvestidores: string | null = null;
  if (invalidoInvestidor) erroInvestidores = "Percentual de investidor inválido (use de 0% a 100%)";
  else if (somaInvestidores > CEM_POR_CENTO) erroInvestidores = "A soma das participações dos investidores ultrapassa 100%";
  if (erroInvestidores) alertas.push(erroInvestidores);

  const investidores: LucroInvestidorCalculado[] = percentuaisInvestidores.map(({ inv, micro }) => ({
    id: inv.id,
    percentual: micro === null ? NaN : Number(micro) / 1e6,
    lucro: erroInvestidores ? falta(erroInvestidores) : lucroEstimado.ok ? ok(aplicarPercentual(lucroEstimado.centavos, micro!)) : falta(lucroEstimado.motivo),
  }));
  const lucroInvestidores = erroInvestidores
    ? falta(erroInvestidores)
    : lucroEstimado.ok
      ? ok(investidores.reduce((acc, i) => acc + (i.lucro.ok ? i.lucro.centavos : 0), 0))
      : falta(lucroEstimado.motivo);

  const baseEmpreiteiro = lucroEstimado.ok && lucroInvestidores.ok
    ? ok(lucroEstimado.centavos - lucroInvestidores.centavos)
    : primeiraFalha(lucroEstimado, lucroInvestidores);
  const pEmp = percentualMicro(e.percentualEmpreiteiro);
  let lucroEmpreiteiro: Indicador;
  if (pEmp === null) lucroEmpreiteiro = ok(0);
  else if (pEmp < B0 || pEmp > CEM_POR_CENTO) {
    lucroEmpreiteiro = falta("Percentual do empreiteiro inválido (use de 0% a 100%)");
    alertas.push("Percentual do empreiteiro inválido (use de 0% a 100%)");
  } else lucroEmpreiteiro = baseEmpreiteiro.ok ? ok(aplicarPercentual(baseEmpreiteiro.centavos, pEmp)) : baseEmpreiteiro;

  const lucroEmpresa = lucroEstimado.ok && lucroInvestidores.ok && lucroEmpreiteiro.ok
    ? ok(lucroEstimado.centavos - lucroInvestidores.centavos - lucroEmpreiteiro.centavos)
    : primeiraFalha(lucroEstimado, lucroInvestidores, lucroEmpreiteiro);

  return {
    entradaTotal,
    entradaPaga,
    saldoEntrada,
    proSoluto,
    valorParcela,
    recebidoCef,
    receberBanco,
    basePls,
    plsReal,
    totalGasto,
    saldoRestante,
    custoConstrucao,
    gastoObraRealizado,
    lucroEstimado,
    investidores,
    lucroInvestidores,
    baseEmpreiteiro,
    lucroEmpreiteiro,
    lucroEmpresa,
    diasObra: diasEntre(e.dataInicio, e.dataTerminoPrevista),
    alertas,
  };
}

/**
 * Percentual/taxa digitado na tela (mais de 2 casas): vírgula é decimal
 * ("2,345"); sem vírgula, o ponto é decimal ("2.345" = 2,345%, nunca milhar).
 * Vazio ou inválido → null. Mesmo comportamento nos dois sistemas.
 */
export function lerPercentualDigitado(texto: string): number | null {
  const t = texto.trim().replace(/[\s%]/g, "");
  if (!t) return null;
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(n) ? n : null;
}
