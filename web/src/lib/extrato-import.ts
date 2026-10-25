// Pedido de 25/10: importar extrato bancário por planilha (CSV/Excel), OFX ou PDF.
// Gêmeo de Prospecta/shared/extrato-import.ts — regras puras (sem banco/rede), mantenha os dois iguais.
// Nada é gravado aqui: o resultado vira uma prévia que a equipe confirma antes de importar.

export type LinhaExtrato = {
  data: string; // AAAA-MM-DD
  descricao: string;
  valor: number; // sempre positivo
  tipo: "credito" | "debito";
};

/** Saldo informado pelo próprio arquivo (LOTE C): valor com sinal e a data a que se refere. */
export type SaldoExtrato = { valor: number; data: string | null };
export type ResultadoLeitura = { linhas: LinhaExtrato[]; ignoradas: number; formato: string; saldo?: SaldoExtrato | null };

type CandidatoSaldo = { valor: number; data: string | null };

/**
 * Saldo final do arquivo: o da data mais recente. Empate na mesma data: o último da ordem do
 * arquivo (extrato crescente) ou o primeiro (extrato decrescente, mais recente no topo).
 */
function saldoFinal(cands: CandidatoSaldo[], linhas: LinhaExtrato[]): SaldoExtrato | null {
  if (!cands.length) return null;
  const decrescente = linhas.length > 1 && linhas[0].data > linhas[linhas.length - 1].data;
  const comData = cands.filter(c => c.data);
  if (!comData.length) return decrescente ? cands[0] : cands[cands.length - 1];
  const max = comData.reduce((m, c) => (c.data! > m ? c.data! : m), comData[0].data!);
  const doDia = comData.filter(c => c.data === max);
  return decrescente ? doDia[0] : doDia[doDia.length - 1];
}

const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** "1.234,56", "-1.234,56", "R$ 1.234,56 D", "(1.234,56)", "1234.56" → número com sinal. */
export function valorMonetario(entrada: unknown): number | null {
  if (typeof entrada === "number") return Number.isFinite(entrada) ? entrada : null;
  if (typeof entrada !== "string") return null;
  let s = entrada.trim();
  if (!s) return null;
  let negativo = false;
  if (/^\(.*\)$/.test(s)) { negativo = true; s = s.slice(1, -1); }
  if (/\s*[dD]$/.test(s) && !/[a-ce-zA-CE-Z]/.test(s.replace(/\s*[dD]$/, ""))) { negativo = true; s = s.replace(/\s*[dD]$/, ""); }
  else if (/\s*[cC]$/.test(s)) s = s.replace(/\s*[cC]$/, "");
  s = s.replace(/R\$\s*/i, "").replace(/\s/g, "");
  if (s.startsWith("-")) { negativo = !negativo; s = s.slice(1); }
  else if (s.startsWith("+")) s = s.slice(1);
  if (s.endsWith("-")) { negativo = !negativo; s = s.slice(0, -1); }
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const ultimaVirgula = s.lastIndexOf(","), ultimoPonto = s.lastIndexOf(".");
  if (ultimaVirgula > ultimoPonto) s = s.replace(/\./g, "").replace(",", ".");
  else if (ultimoPonto > ultimaVirgula && ultimaVirgula >= 0) s = s.replace(/,/g, "");
  else if (ultimaVirgula < 0 && (s.match(/\./g) ?? []).length > 1) s = s.replace(/\./g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negativo ? -n : n;
}

/** "31/10/2026", "31/10/26", "2026-10-31", "20261031", número serial do Excel ou Date → "2026-10-31". */
export function dataIso(entrada: unknown): string | null {
  const valida = (a: number, m: number, d: number) => {
    if (a < 100) a += 2000;
    const dt = new Date(Date.UTC(a, m - 1, d));
    if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d || a < 1990 || a > 2100) return null;
    return dt.toISOString().slice(0, 10);
  };
  if (entrada instanceof Date) return Number.isNaN(entrada.getTime()) ? null : entrada.toISOString().slice(0, 10);
  if (typeof entrada === "number") {
    if (entrada < 30000 || entrada > 80000) return null;
    return new Date(Date.UTC(1899, 11, 30) + Math.round(entrada) * 86400000).toISOString().slice(0, 10);
  }
  if (typeof entrada !== "string") return null;
  const s = entrada.trim();
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  if (m) return valida(Number(m[3]), Number(m[2]), Number(m[1]));
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return valida(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return valida(Number(m[1]), Number(m[2]), Number(m[3]));
  return null;
}

function linha(data: string | null, descricao: string, valor: number | null): LinhaExtrato | null {
  if (!data || valor === null || valor === 0) return null;
  return { data, descricao: descricao.replace(/\s+/g, " ").trim().slice(0, 500) || "Movimentação", valor: Math.abs(valor), tipo: valor < 0 ? "debito" : "credito" };
}

// ── OFX ─────────────────────────────────────────────────────────────────────
export function lerOfx(texto: string): ResultadoLeitura {
  const linhas: LinhaExtrato[] = [];
  let ignoradas = 0;
  const campo = (bloco: string, nome: string) => bloco.match(new RegExp(`<${nome}>([^<\\r\\n]*)`, "i"))?.[1]?.trim() ?? "";
  for (const bloco of texto.split(/<STMTTRN>/i).slice(1)) {
    const valor = valorMonetario(campo(bloco, "TRNAMT").replace(",", "."));
    const tipoOfx = campo(bloco, "TRNTYPE").toUpperCase();
    const assinado = valor !== null && valor > 0 && tipoOfx === "DEBIT" ? -valor : valor;
    const l = linha(dataIso(campo(bloco, "DTPOSTED")), campo(bloco, "MEMO") || campo(bloco, "NAME"), assinado);
    if (l) linhas.push(l); else ignoradas++;
  }
  // LOTE C: saldo do extrato (<LEDGERBAL><BALAMT>…<DTASOF>…).
  const ledger = texto.split(/<LEDGERBAL>/i)[1];
  const balamt = ledger ? valorMonetario(campo(ledger, "BALAMT").replace(",", ".")) : null;
  const saldo = balamt !== null ? { valor: balamt, data: dataIso(campo(ledger!, "DTASOF")) } : null;
  return { linhas, ignoradas, formato: "OFX", saldo };
}

// ── Planilha (CSV ou Excel já convertido em linhas) ─────────────────────────
const COL_DATA = ["data", "data lancamento", "data do lancamento", "dt", "date", "data movimento", "data mov"];
const COL_DESC = ["descricao", "historico", "lancamento", "detalhe", "detalhes", "description", "memo", "titulo", "identificacao", "transacao"];
const COL_VALOR = ["valor", "valor (r$)", "valor r$", "amount", "montante", "quantia"];
const COL_CRED = ["credito", "entrada", "entradas", "creditos", "credito (r$)", "entrada (r$)"];
const COL_DEB = ["debito", "saida", "saidas", "debitos", "debito (r$)", "saida (r$)"];
const COL_TIPO = ["tipo", "natureza", "d/c", "c/d", "tipo transacao", "tipo de transacao"];
const COL_SALDO = ["saldo", "saldo (r$)", "saldo r$", "saldo do dia", "saldo final", "balance"];

function acharColuna(cab: string[], nomes: string[]) {
  const i = cab.findIndex(c => nomes.includes(c));
  return i >= 0 ? i : cab.findIndex(c => nomes.some(n => n.length > 3 && c.startsWith(n)));
}

export function lerTabela(tabela: unknown[][], formato = "Planilha"): ResultadoLeitura {
  let cabIdx = -1, iData = -1, iDesc = -1, iValor = -1, iCred = -1, iDeb = -1, iTipo = -1, iSaldo = -1;
  for (let r = 0; r < Math.min(tabela.length, 40); r++) {
    const cab = (tabela[r] ?? []).map(c => sem(String(c ?? "")));
    const d = acharColuna(cab, COL_DATA);
    const v = acharColuna(cab, COL_VALOR), c = acharColuna(cab, COL_CRED), b = acharColuna(cab, COL_DEB);
    if (d >= 0 && (v >= 0 || c >= 0 || b >= 0)) {
      cabIdx = r; iData = d; iValor = v; iCred = c; iDeb = b;
      iDesc = acharColuna(cab, COL_DESC); iTipo = acharColuna(cab, COL_TIPO); iSaldo = acharColuna(cab, COL_SALDO);
      break;
    }
  }
  if (cabIdx < 0) throw new Error("Não encontrei as colunas de data e valor. A planilha precisa ter um cabeçalho com \"Data\" e \"Valor\" (ou \"Crédito\"/\"Débito\").");
  const linhas: LinhaExtrato[] = [];
  const saldos: CandidatoSaldo[] = [];
  let ignoradas = 0;
  for (const row of tabela.slice(cabIdx + 1)) {
    if (!row || row.every(c => c === null || c === undefined || String(c).trim() === "")) continue;
    // LOTE C: coluna "Saldo" (saldo após cada lançamento ou do dia).
    const saldoLinha = iSaldo >= 0 ? valorMonetario(row[iSaldo]) : null;
    if (saldoLinha !== null) saldos.push({ valor: saldoLinha, data: dataIso(row[iData]) });
    let valor: number | null;
    if (iValor >= 0) {
      valor = valorMonetario(row[iValor]);
      const tipo = iTipo >= 0 ? sem(String(row[iTipo] ?? "")) : "";
      if (valor !== null && valor > 0 && /^(d|debito|saida|db)\b/.test(tipo)) valor = -valor;
    } else {
      const cr = valorMonetario(row[iCred]) ?? 0, db = valorMonetario(row[iDeb]) ?? 0;
      valor = cr ? Math.abs(cr) : db ? -Math.abs(db) : null;
    }
    const descricao = iDesc >= 0 ? String(row[iDesc] ?? "") : "";
    if (/^saldo\b/i.test(sem(descricao))) { ignoradas++; continue; }
    const l = linha(dataIso(row[iData]), descricao, valor);
    if (l) linhas.push(l); else ignoradas++;
  }
  return { linhas, ignoradas, formato, saldo: saldoFinal(saldos, linhas) };
}

export function lerCsv(texto: string): ResultadoLeitura {
  const amostra = texto.split(/\r?\n/).slice(0, 20).join("\n");
  const sep = [";", "\t", ","].sort((a, b) => amostra.split(b).length - amostra.split(a).length)[0];
  const tabela: string[][] = [];
  for (const bruta of texto.split(/\r?\n/)) {
    const cel: string[] = [];
    let atual = "", aspas = false;
    for (let i = 0; i < bruta.length; i++) {
      const ch = bruta[i];
      if (ch === '"') { if (aspas && bruta[i + 1] === '"') { atual += '"'; i++; } else aspas = !aspas; }
      else if (ch === sep && !aspas) { cel.push(atual); atual = ""; }
      else atual += ch;
    }
    cel.push(atual);
    tabela.push(cel.map(c => c.trim()));
  }
  return lerTabela(tabela, "CSV");
}

// ── PDF (texto extraído, uma linha por lançamento) ──────────────────────────
const DINHEIRO = /[-+]?\(?(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}\)?(?:\s*[DC]\b)?-?/g;
const PALAVRAS_DEBITO = /\b(debito|pagamento|pago|enviado|enviada|saida|tarifa|compra|saque|transferencia enviada|pix enviado)\b/;

export function lerTextoPdf(linhasTexto: string[], anoPadrao?: number): ResultadoLeitura {
  const linhas: LinhaExtrato[] = [];
  const saldos: CandidatoSaldo[] = [];
  let ignoradas = 0;
  for (const bruta of linhasTexto) {
    const t = bruta.replace(/\s+/g, " ").trim();
    let m = t.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.*)$/);
    let data = m ? dataIso(m[1]) : null;
    if (!m && anoPadrao) {
      m = t.match(/^(\d{1,2}\/\d{1,2})\s+(.*)$/);
      if (m) data = dataIso(`${m[1]}/${anoPadrao}`);
    }
    if (!m || !data) continue;
    const resto = m[2];
    const valores = Array.from(resto.matchAll(DINHEIRO));
    if (!valores.length) { ignoradas++; continue; }
    // Com dois ou mais valores na linha, o último costuma ser o saldo do dia.
    const alvo = valores.length >= 2 ? valores[valores.length - 2] : valores[0];
    let valor = valorMonetario(alvo[0]);
    const descricao = resto.slice(0, valores[0].index).trim();
    // LOTE C: linha "Saldo…" com valor, ou o último valor de uma linha com dois ou mais.
    const ehSaldo = /^saldo\b/.test(sem(descricao));
    if (ehSaldo || valores.length >= 2) {
      const s = valorMonetario(valores[valores.length - 1][0]);
      if (s !== null) saldos.push({ valor: s, data });
    }
    if (ehSaldo) continue;
    if (valor !== null && valor > 0 && PALAVRAS_DEBITO.test(sem(descricao))) valor = -valor;
    const l = linha(data, descricao, valor);
    if (l) linhas.push(l); else ignoradas++;
  }
  return { linhas, ignoradas, formato: "PDF", saldo: saldoFinal(saldos, linhas) };
}

/** Aplica a data inicial da conta: o que for anterior não pertence a esta empresa. */
export function aplicarDataInicial<T extends { data: string }>(linhas: T[], dataInicial?: string | null) {
  if (!dataInicial) return { mantidas: linhas, antesDaDataInicial: 0 };
  const mantidas = linhas.filter(l => l.data >= dataInicial);
  return { mantidas, antesDaDataInicial: linhas.length - mantidas.length };
}

/**
 * Identificador estável de cada linha importada: reimportar o mesmo arquivo não duplica,
 * e dois lançamentos idênticos no mesmo dia continuam sendo dois (contador de ocorrência).
 */
export function chavesImportacao(contaId: string | number, linhas: LinhaExtrato[], hash: (s: string) => string): string[] {
  const vistos = new Map<string, number>();
  return linhas.map(l => {
    const base = `${l.data}|${l.tipo}|${l.valor.toFixed(2)}|${sem(l.descricao)}`;
    const n = (vistos.get(base) ?? 0) + 1;
    vistos.set(base, n);
    return `imp:${contaId}:${hash(`${base}|${n}`)}`;
  });
}
