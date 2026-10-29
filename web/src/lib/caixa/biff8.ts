/**
 * Leitura e gravação cirúrgica de planilhas Excel 97-2003 (.xls / BIFF8).
 *
 * Pedido de 18/10: o SIOPI da CAIXA só aceita .xls, e o modelo (PCI/PLS) tem
 * fórmulas, validações e desenhos que nenhuma biblioteca livre regrava sem
 * perdas. Por isso o arquivo NÃO é reconstruído: os registros originais são
 * mantidos byte a byte e só as células de entrada (campos roxos) mudam. Os
 * deslocamentos das abas (BOUNDSHEET) e o índice de strings (EXTSST) são
 * recalculados na gravação.
 */
import * as CFB from "cfb";

export const R = {
  BOF: 0x0809,
  EOF: 0x000a,
  BOUNDSHEET: 0x0085,
  SST: 0x00fc,
  EXTSST: 0x00ff,
  CONTINUE: 0x003c,
  NUMBER: 0x0203,
  RK: 0x027e,
  MULRK: 0x00bd,
  LABELSST: 0x00fd,
  LABEL: 0x0204,
  BLANK: 0x0201,
  MULBLANK: 0x00be,
  BOOLERR: 0x0205,
  FORMULA: 0x0006,
  STRING: 0x0207,
  ROW: 0x0208,
  INDEX: 0x020b,
  DBCELL: 0x00d7,
  FILEPASS: 0x002f,
  MSODRAWINGGROUP: 0x00eb,
  MSODRAWING: 0x00ec,
  OBJ: 0x005d,
  TXO: 0x01b6,
  DVAL: 0x01b2,
  DV: 0x01be,
} as const;

const MAX_REGISTRO = 8224;

export interface Registro {
  tipo: number;
  dados: Uint8Array;
}

export type ValorCelula = number | string | boolean | null;

/**
 * Lote 03, correção 10: validação de dados (registro DV) de uma aba. Só leitura.
 * `opcoes` = itens da lista (literal ou intervalo da própria aba resolvido);
 * `referencia` = fórmula de origem quando não é literal (ex.: "$BB$95:$BB$108").
 */
export interface ValidacaoDados {
  aba: string;
  /** Intervalos (sqref) separados por espaço, ex.: "AI47:AJ47". */
  intervalo: string;
  /** 0 qualquer, 1 inteiro, 2 decimal, 3 lista, 4 data, 5 hora, 6 tamanho do texto, 7 personalizada. */
  tipo: number;
  opcoes: string[] | null;
  referencia: string | null;
  permiteBranco: boolean;
}

/** Índice de coluna (base zero) → letras ("AB"). */
export function colunaParaLetras(c: number): string {
  let s = "";
  let n = c + 1;
  while (n) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function intervaloA1(r1: number, r2: number, c1: number, c2: number, absoluto = false): string {
  const d = absoluto ? "$" : "";
  const a = `${d}${colunaParaLetras(c1)}${d}${r1 + 1}`;
  const b = `${d}${colunaParaLetras(c2)}${d}${r2 + 1}`;
  return a === b ? a : `${a}:${b}`;
}

/** Endereço "AB12" → { linha: 11, coluna: 27 } (base zero). */
export function enderecoParaPosicao(endereco: string): { linha: number; coluna: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(endereco.trim().toUpperCase());
  if (!m) throw new Error(`Endereço de célula inválido: ${endereco}`);
  let coluna = 0;
  for (const letra of m[1]) coluna = coluna * 26 + (letra.charCodeAt(0) - 64);
  return { linha: Number(m[2]) - 1, coluna: coluna - 1 };
}

function u16(d: Uint8Array, o: number) {
  return d[o] | (d[o + 1] << 8);
}
function u32(d: Uint8Array, o: number) {
  return (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16)) + d[o + 3] * 0x1000000;
}
function f64(d: Uint8Array, o: number) {
  return new DataView(d.buffer, d.byteOffset + o, 8).getFloat64(0, true);
}
function escreveU16(d: Uint8Array, o: number, v: number) {
  d[o] = v & 0xff;
  d[o + 1] = (v >> 8) & 0xff;
}
function escreveU32(d: Uint8Array, o: number, v: number) {
  new DataView(d.buffer, d.byteOffset + o, 4).setUint32(0, v >>> 0, true);
}
function escreveF64(d: Uint8Array, o: number, v: number) {
  new DataView(d.buffer, d.byteOffset + o, 8).setFloat64(0, v, true);
}

function rkParaNumero(rk: number): number {
  const centesimos = (rk & 1) !== 0;
  let v: number;
  if (rk & 2) {
    v = rk >> 2; // inteiro com sinal de 30 bits
  } else {
    const b = new Uint8Array(8);
    escreveU32(b, 4, (rk & 0xfffffffc) >>> 0);
    v = f64(b, 0);
  }
  return centesimos ? v / 100 : v;
}

/** Strings do SST, com a posição de cada uma no fluxo (para o EXTSST). */
interface SstLido {
  strings: string[];
}

/** Lê uma XLUnicodeRichExtendedString que pode atravessar registros CONTINUE. */
class LeitorContinuo {
  private partes: Uint8Array[];
  private i = 0;
  private o = 0;
  constructor(partes: Uint8Array[], inicio: number) {
    this.partes = partes;
    this.o = inicio;
  }
  private garante() {
    while (this.i < this.partes.length && this.o >= this.partes[this.i].length) {
      this.i++;
      this.o = 0;
    }
  }
  fim() {
    this.garante();
    return this.i >= this.partes.length;
  }
  byte() {
    this.garante();
    return this.partes[this.i][this.o++];
  }
  u16() {
    return this.byte() | (this.byte() << 8);
  }
  u32() {
    return this.u16() + this.u16() * 0x10000;
  }
  pula(n: number) {
    for (let k = 0; k < n; k++) this.byte();
  }
  /** Caracteres: ao trocar de registro no meio do texto, vem um novo byte de flags. */
  caracteres(qtd: number, largo: boolean): string {
    let s = "";
    let wide = largo;
    for (let k = 0; k < qtd; k++) {
      this.garante();
      if (this.o === 0 && this.i > 0 && k > 0) wide = (this.byte() & 1) === 1;
      s += String.fromCharCode(wide ? this.u16() : this.byte());
    }
    return s;
  }
}

function lerSst(partes: Uint8Array[]): SstLido {
  const unicos = u32(partes[0], 4);
  const leitor = new LeitorContinuo(partes, 8);
  const strings: string[] = [];
  for (let k = 0; k < unicos && !leitor.fim(); k++) {
    const qtd = leitor.u16();
    const flags = leitor.byte();
    const rico = (flags & 0x08) !== 0;
    const ext = (flags & 0x04) !== 0;
    const runs = rico ? leitor.u16() : 0;
    const cbExt = ext ? leitor.u32() : 0;
    strings.push(leitor.caracteres(qtd, (flags & 1) === 1));
    leitor.pula(runs * 4 + cbExt);
  }
  return { strings };
}

/** Codifica uma string curta (≤ 8000 bytes) no formato do SST, sem formatação. */
function codificaStringSst(texto: string): Uint8Array {
  const largo = /[^\x00-\xff]/.test(texto);
  const corpo = largo ? texto.length * 2 : texto.length;
  const b = new Uint8Array(3 + corpo);
  escreveU16(b, 0, texto.length);
  b[2] = largo ? 1 : 0;
  for (let k = 0; k < texto.length; k++) {
    const c = texto.charCodeAt(k);
    if (largo) escreveU16(b, 3 + k * 2, c);
    else b[3 + k] = c;
  }
  return b;
}

export interface Aba {
  nome: string;
  /** Índice do registro BOF desta aba na lista de registros. */
  bof: Registro;
}

/**
 * Pasta de trabalho BIFF8 aberta para edição. Os registros ficam numa lista
 * plana; abas são localizadas pelo BOF referenciado no BOUNDSHEET.
 */
export class PastaBiff8 {
  private container: CFB.CFB$Container;
  registros: Registro[] = [];
  abas: Aba[] = [];
  private boundsheets: { registro: Registro; aba: Aba }[] = [];
  private sst: string[] = [];
  private novasStrings: string[] = [];

  private constructor(container: CFB.CFB$Container) {
    this.container = container;
  }

  static abrir(arquivo: Uint8Array): PastaBiff8 {
    let container: CFB.CFB$Container;
    try {
      container = CFB.read(arquivo, { type: "buffer" });
    } catch {
      throw new Error("O arquivo não é uma planilha .xls válida.");
    }
    const fluxo = CFB.find(container, "Workbook") ?? CFB.find(container, "Book");
    if (!fluxo || !fluxo.content) throw new Error("O arquivo não é uma planilha .xls (Excel 97-2003).");
    const pasta = new PastaBiff8(container);
    pasta.carregar(Uint8Array.from(fluxo.content as ArrayLike<number>));
    return pasta;
  }

  private carregar(wb: Uint8Array) {
    const porPosicao = new Map<number, Registro>();
    let pos = 0;
    while (pos + 4 <= wb.length) {
      const tipo = u16(wb, pos);
      const tam = u16(wb, pos + 2);
      if (pos + 4 + tam > wb.length) break;
      const reg: Registro = { tipo, dados: wb.slice(pos + 4, pos + 4 + tam) };
      porPosicao.set(pos, reg);
      this.registros.push(reg);
      pos += 4 + tam;
    }
    if (this.registros.some((r) => r.tipo === R.FILEPASS)) {
      throw new Error("A planilha está protegida por senha de abertura. Salve uma cópia sem senha e envie de novo.");
    }
    for (const reg of this.registros) {
      if (reg.tipo === R.EOF) break;
      if (reg.tipo === R.BOUNDSHEET) {
        const offset = u32(reg.dados, 0);
        const n = reg.dados[6];
        const largo = (reg.dados[7] & 1) === 1;
        let nome = "";
        for (let k = 0; k < n; k++) {
          nome += String.fromCharCode(largo ? u16(reg.dados, 8 + k * 2) : reg.dados[8 + k]);
        }
        const bof = porPosicao.get(offset);
        if (!bof) throw new Error(`Aba "${nome}" com posição inválida no arquivo.`);
        const aba = { nome, bof };
        this.abas.push(aba);
        this.boundsheets.push({ registro: reg, aba });
      }
    }
    const iSst = this.registros.findIndex((r) => r.tipo === R.SST);
    if (iSst >= 0) {
      const partes = [this.registros[iSst].dados];
      for (let k = iSst + 1; this.registros[k]?.tipo === R.CONTINUE; k++) partes.push(this.registros[k].dados);
      this.sst = lerSst(partes).strings;
    }
  }

  aba(nome: string): Aba {
    const a = this.abas.find((x) => x.nome === nome);
    if (!a) throw new Error(`A planilha não tem a aba "${nome}".`);
    return a;
  }

  /** Intervalo [início, fim) dos registros da aba, respeitando gráficos embutidos. */
  intervaloDaAba(aba: Aba): [number, number] {
    const inicio = this.registros.indexOf(aba.bof);
    let nivel = 0;
    for (let k = inicio; k < this.registros.length; k++) {
      const t = this.registros[k].tipo;
      if (t === R.BOF) nivel++;
      else if (t === R.EOF) {
        nivel--;
        if (nivel === 0) return [inicio, k + 1];
      }
    }
    return [inicio, this.registros.length];
  }

  /** Percorre os registros de célula do nível principal da aba. */
  celulasDaAba(aba: Aba): { indice: number; reg: Registro }[] {
    const [ini, fim] = this.intervaloDaAba(aba);
    const lista: { indice: number; reg: Registro }[] = [];
    let nivel = 0;
    for (let k = ini; k < fim; k++) {
      const reg = this.registros[k];
      if (reg.tipo === R.BOF) nivel++;
      if (reg.tipo === R.EOF) nivel--;
      if (nivel === 1) lista.push({ indice: k, reg });
    }
    return lista;
  }

  private valorDoRegistro(reg: Registro, coluna: number, indice: number): ValorCelula | undefined {
    const d = reg.dados;
    switch (reg.tipo) {
      case R.NUMBER:
        return f64(d, 6);
      case R.RK:
        return rkParaNumero(u32(d, 6));
      case R.LABELSST:
        return this.sst[u32(d, 6)] ?? "";
      case R.BLANK:
        return null;
      case R.BOOLERR:
        return d[7] === 0 ? d[6] === 1 : null;
      case R.MULRK: {
        const primeira = u16(d, 2);
        return rkParaNumero(u32(d, 4 + (coluna - primeira) * 6 + 2));
      }
      case R.MULBLANK:
        return null;
      case R.FORMULA: {
        if (u16(d, 12) !== 0xffff) return f64(d, 6);
        if (d[6] === 0) {
          const prox = this.registros[indice + 1];
          if (prox?.tipo === R.STRING) {
            const qtd = u16(prox.dados, 0);
            const largo = (prox.dados[2] & 1) === 1;
            let s = "";
            for (let k = 0; k < qtd; k++) s += String.fromCharCode(largo ? u16(prox.dados, 3 + k * 2) : prox.dados[3 + k]);
            return s;
          }
          return "";
        }
        if (d[6] === 1) return d[8] === 1;
        if (d[6] === 3) return "";
        return null; // erro (#N/D etc.)
      }
    }
    return undefined;
  }

  private abrange(reg: Registro, linha: number, coluna: number): boolean {
    const d = reg.dados;
    if (u16(d, 0) !== linha) return false;
    if (reg.tipo === R.MULRK || reg.tipo === R.MULBLANK) {
      const primeira = u16(d, 2);
      const ultima = u16(d, d.length - 2);
      return coluna >= primeira && coluna <= ultima;
    }
    return [R.NUMBER, R.RK, R.LABELSST, R.BLANK, R.BOOLERR, R.FORMULA, R.LABEL].includes(reg.tipo as never) && u16(d, 2) === coluna;
  }

  /** Valor (ou valor em cache, se for fórmula) de uma célula. */
  ler(nomeAba: string, endereco: string): ValorCelula {
    const { linha, coluna } = enderecoParaPosicao(endereco);
    for (const { indice, reg } of this.celulasDaAba(this.aba(nomeAba))) {
      if (this.abrange(reg, linha, coluna)) return this.valorDoRegistro(reg, coluna, indice) ?? null;
    }
    return null;
  }

  /** A célula existe no modelo (tem registro, mesmo em branco com formatação)? */
  temCelula(nomeAba: string, endereco: string): boolean {
    const { linha, coluna } = enderecoParaPosicao(endereco);
    return this.celulasDaAba(this.aba(nomeAba)).some(({ reg }) => this.abrange(reg, linha, coluna));
  }

  /** Lote 03, correção 10: lê as validações de dados (DV 0x01BE) de uma aba. */
  validacoesDeDados(nomeAba: string): ValidacaoDados[] {
    const aba = this.aba(nomeAba);
    const out: ValidacaoDados[] = [];
    for (const { reg } of this.celulasDaAba(aba)) {
      if (reg.tipo !== R.DV) continue;
      try {
        out.push(this.lerDv(nomeAba, reg.dados));
      } catch {
        // registro DV ilegível: ignora (só leitura)
      }
    }
    return out;
  }

  private lerDv(nomeAba: string, d: Uint8Array): ValidacaoDados {
    const flags = u32(d, 0);
    let o = 4;
    for (let k = 0; k < 4; k++) {
      // PromptTitle, ErrorTitle, Prompt, Error (XLUnicodeString)
      const cch = u16(d, o);
      const largo = (d[o + 2] & 1) === 1;
      o += 3 + cch * (largo ? 2 : 1);
    }
    const cce1 = u16(d, o);
    const rgce1 = d.subarray(o + 4, o + 4 + cce1);
    o += 4 + cce1;
    const cce2 = u16(d, o);
    o += 4 + cce2;
    const cref = u16(d, o);
    o += 2;
    const partes: string[] = [];
    for (let k = 0; k < cref; k++, o += 8) partes.push(intervaloA1(u16(d, o), u16(d, o + 2), u16(d, o + 4) & 0x3fff, u16(d, o + 6) & 0x3fff));
    const tipo = flags & 0x0f;
    let opcoes: string[] | null = null;
    let referencia: string | null = null;
    const ptg = rgce1[0];
    if (ptg === 0x17) {
      const cch = rgce1[1];
      const largo = (rgce1[2] & 1) === 1;
      let t = "";
      for (let k = 0; k < cch; k++) t += String.fromCharCode(largo ? u16(rgce1, 3 + k * 2) : rgce1[3 + k]);
      // O separador do BIFF8 é \0; alguns arquivos (como o oficial da CAIXA) gravam a vírgula do Excel.
      opcoes = t.includes("\0") ? t.split("\0") : t.split(",");
    } else if (ptg === 0x25 || ptg === 0x45 || ptg === 0x65) {
      const r1 = u16(rgce1, 1), r2 = u16(rgce1, 3), c1 = u16(rgce1, 5) & 0x3fff, c2 = u16(rgce1, 7) & 0x3fff;
      referencia = intervaloA1(r1, r2, c1, c2, true);
      opcoes = [];
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          const v = this.ler(nomeAba, `${colunaParaLetras(c)}${r + 1}`);
          if (v !== null && v !== "") opcoes.push(typeof v === "number" ? String(v) : String(v));
        }
      }
    } else if (ptg === 0x24 || ptg === 0x44 || ptg === 0x64) {
      referencia = intervaloA1(u16(rgce1, 1), u16(rgce1, 1), u16(rgce1, 3) & 0x3fff, u16(rgce1, 3) & 0x3fff, true);
    } else if (ptg !== undefined) {
      referencia = `fórmula (ptg 0x${ptg.toString(16)})`;
    }
    return { aba: nomeAba, intervalo: partes.join(" "), tipo, opcoes, referencia, permiteBranco: ((flags >> 8) & 1) === 1 };
  }

  ehFormula(nomeAba: string, endereco: string): boolean {
    const { linha, coluna } = enderecoParaPosicao(endereco);
    for (const { reg } of this.celulasDaAba(this.aba(nomeAba))) {
      if (this.abrange(reg, linha, coluna)) return reg.tipo === R.FORMULA;
    }
    return false;
  }

  private indiceSst(texto: string): number {
    const existente = this.sst.indexOf(texto);
    if (existente >= 0) return existente;
    const nova = this.novasStrings.indexOf(texto);
    if (nova >= 0) return this.sst.length + nova;
    this.novasStrings.push(texto);
    return this.sst.length + this.novasStrings.length - 1;
  }

  /**
   * Grava um valor numa célula de entrada, mantendo a formatação (XF). Não
   * aceita sobrescrever fórmulas: só campos de digitação do modelo.
   * `null` deixa a célula em branco.
   */
  escrever(nomeAba: string, endereco: string, valor: ValorCelula, opcoes: { sobreFormula?: boolean } = {}) {
    const { linha, coluna } = enderecoParaPosicao(endereco);
    const aba = this.aba(nomeAba);
    for (const { indice, reg } of this.celulasDaAba(aba)) {
      if (!this.abrange(reg, linha, coluna)) continue;
      if (reg.tipo === R.FORMULA) {
        // Só fórmulas simples de campos editáveis (ex.: "% proposto" que repete
        // o real); nunca a primeira célula de fórmula compartilhada/matricial.
        const prox = this.registros[indice + 1]?.tipo;
        if (!opcoes.sobreFormula || prox === 0x04bc || prox === 0x0221 || prox === 0x0236) {
          throw new Error(`${nomeAba}!${endereco} é fórmula do modelo e não pode ser sobrescrita.`);
        }
        this.registros.splice(indice, prox === R.STRING ? 2 : 1, this.registroDeValor(linha, coluna, u16(reg.dados, 4), valor));
        return;
      }
      const xf = reg.tipo === R.MULRK
        ? u16(reg.dados, 4 + (coluna - u16(reg.dados, 2)) * 6)
        : reg.tipo === R.MULBLANK
          ? u16(reg.dados, 4 + (coluna - u16(reg.dados, 2)) * 2)
          : u16(reg.dados, 4);
      const novo = this.registroDeValor(linha, coluna, xf, valor);
      if (reg.tipo === R.MULRK || reg.tipo === R.MULBLANK) {
        this.registros.splice(indice, 1, ...this.dividirMultiplo(reg, coluna, novo));
      } else {
        this.registros[indice] = novo;
      }
      return;
    }
    throw new Error(`${nomeAba}!${endereco} não existe no modelo (célula sem formatação).`);
  }

  private registroDeValor(linha: number, coluna: number, xf: number, valor: ValorCelula): Registro {
    if (valor === null || valor === "") {
      const d = new Uint8Array(6);
      escreveU16(d, 0, linha);
      escreveU16(d, 2, coluna);
      escreveU16(d, 4, xf);
      return { tipo: R.BLANK, dados: d };
    }
    if (typeof valor === "boolean") {
      const d = new Uint8Array(8);
      escreveU16(d, 0, linha);
      escreveU16(d, 2, coluna);
      escreveU16(d, 4, xf);
      d[6] = valor ? 1 : 0;
      return { tipo: R.BOOLERR, dados: d };
    }
    if (typeof valor === "number") {
      if (!Number.isFinite(valor)) throw new Error("Valor numérico inválido.");
      const d = new Uint8Array(14);
      escreveU16(d, 0, linha);
      escreveU16(d, 2, coluna);
      escreveU16(d, 4, xf);
      escreveF64(d, 6, valor);
      return { tipo: R.NUMBER, dados: d };
    }
    const d = new Uint8Array(10);
    escreveU16(d, 0, linha);
    escreveU16(d, 2, coluna);
    escreveU16(d, 4, xf);
    escreveU32(d, 6, this.indiceSst(valor.slice(0, 8000)));
    return { tipo: R.LABELSST, dados: d };
  }

  /** Separa um MULRK/MULBLANK em partes, trocando a coluna alvo pelo novo registro. */
  private dividirMultiplo(reg: Registro, coluna: number, novo: Registro): Registro[] {
    const d = reg.dados;
    const linha = u16(d, 0);
    const primeira = u16(d, 2);
    const passo = reg.tipo === R.MULRK ? 6 : 2;
    const qtd = (d.length - 6) / passo;
    const montar = (de: number, ate: number): Registro[] => {
      if (ate < de) return [];
      const n = ate - de + 1;
      if (n === 1) {
        const o = 4 + (de - primeira) * passo;
        if (reg.tipo === R.MULRK) {
          const x = new Uint8Array(10);
          escreveU16(x, 0, linha);
          escreveU16(x, 2, de);
          x.set(d.subarray(o, o + 6), 4);
          return [{ tipo: R.RK, dados: x }];
        }
        const x = new Uint8Array(6);
        escreveU16(x, 0, linha);
        escreveU16(x, 2, de);
        x.set(d.subarray(o, o + 2), 4);
        return [{ tipo: R.BLANK, dados: x }];
      }
      const x = new Uint8Array(6 + n * passo);
      escreveU16(x, 0, linha);
      escreveU16(x, 2, de);
      x.set(d.subarray(4 + (de - primeira) * passo, 4 + (ate - primeira + 1) * passo), 4);
      escreveU16(x, x.length - 2, ate);
      return [{ tipo: reg.tipo, dados: x }];
    };
    const ultima = primeira + qtd - 1;
    return [...montar(primeira, coluna - 1), novo, ...montar(coluna + 1, ultima)];
  }

  /**
   * Atualiza o valor em cache de uma fórmula (o que leitores como o SIOPI
   * enxergam sem recalcular). A fórmula em si não muda.
   */
  gravarResultado(nomeAba: string, endereco: string, valor: number | string | null) {
    const { linha, coluna } = enderecoParaPosicao(endereco);
    for (const { indice, reg } of this.celulasDaAba(this.aba(nomeAba))) {
      if (!this.abrange(reg, linha, coluna)) continue;
      if (reg.tipo !== R.FORMULA) throw new Error(`${nomeAba}!${endereco} não é fórmula.`);
      const d = reg.dados;
      const temString = this.registros[indice + 1]?.tipo === R.STRING;
      if (typeof valor === "number") {
        escreveF64(d, 6, valor);
        if (temString) this.registros.splice(indice + 1, 1);
      } else if (valor === null) {
        d.set([2, 0, 0x2a, 0, 0, 0, 0xff, 0xff], 6); // #N/D
        if (temString) this.registros.splice(indice + 1, 1);
      } else {
        d.set([0, 0, 0, 0, 0, 0, 0xff, 0xff], 6);
        const s = codificaStringSst(valor.slice(0, 255));
        const reg2: Registro = { tipo: R.STRING, dados: s };
        if (temString) this.registros[indice + 1] = reg2;
        else this.registros.splice(indice + 1, 0, reg2);
      }
      return;
    }
    throw new Error(`${nomeAba}!${endereco} não existe no modelo.`);
  }

  /** Monta o SST (original + novas strings) e o EXTSST coerentes. */
  private reconstruirSst() {
    if (!this.novasStrings.length) return;
    const iSst = this.registros.findIndex((r) => r.tipo === R.SST);
    if (iSst < 0) throw new Error("Planilha sem tabela de textos (SST).");
    let fim = iSst + 1;
    while (this.registros[fim]?.tipo === R.CONTINUE) fim++;
    const sstReg = this.registros[iSst];
    const total = u32(sstReg.dados, 0);
    const unicos = u32(sstReg.dados, 4);
    escreveU32(sstReg.dados, 0, total + this.novasStrings.length);
    escreveU32(sstReg.dados, 4, unicos + this.novasStrings.length);
    // Novas strings em CONTINUE próprios (cada string inteira num registro).
    const novos: Registro[] = [];
    let atual: number[] = [];
    for (const s of this.novasStrings) {
      const b = codificaStringSst(s);
      if (atual.length + b.length > MAX_REGISTRO) {
        novos.push({ tipo: R.CONTINUE, dados: Uint8Array.from(atual) });
        atual = [];
      }
      for (let k = 0; k < b.length; k++) atual.push(b[k]);
    }
    if (atual.length) novos.push({ tipo: R.CONTINUE, dados: Uint8Array.from(atual) });
    this.registros.splice(fim, 0, ...novos);
    this.sst.push(...this.novasStrings);
    this.novasStrings = [];
  }

  /** Recalcula o EXTSST a partir das posições reais das strings no fluxo. */
  private reconstruirExtsst(posicoes: Map<Registro, number>) {
    const iSst = this.registros.findIndex((r) => r.tipo === R.SST);
    const iExt = this.registros.findIndex((r) => r.tipo === R.EXTSST);
    if (iSst < 0 || iExt < 0) return;
    const partes: { reg: Registro; dados: Uint8Array }[] = [{ reg: this.registros[iSst], dados: this.registros[iSst].dados }];
    for (let k = iSst + 1; this.registros[k]?.tipo === R.CONTINUE; k++) partes.push({ reg: this.registros[k], dados: this.registros[k].dados });
    const unicos = u32(partes[0].dados, 4);
    const porBalde = Math.max(8, Math.ceil(unicos / 128));
    const baldes: { ib: number; cb: number }[] = [];
    // Percorre as strings anotando onde começa cada uma.
    let p = 0;
    let o = 8;
    const ajusta = () => {
      while (p < partes.length && o >= partes[p].dados.length) {
        p++;
        o = 0;
      }
    };
    const byte = () => {
      ajusta();
      return partes[p].dados[o++];
    };
    for (let k = 0; k < unicos; k++) {
      ajusta();
      if (p >= partes.length) break;
      if (k % porBalde === 0) baldes.push({ ib: (posicoes.get(partes[p].reg) ?? 0) + 4 + o, cb: 4 + o });
      const qtd = byte() | (byte() << 8);
      const flags = byte();
      const runs = flags & 0x08 ? byte() | (byte() << 8) : 0;
      const cbExt = flags & 0x04 ? (byte() | (byte() << 8)) + (byte() | (byte() << 8)) * 0x10000 : 0;
      let largo = (flags & 1) === 1;
      for (let c = 0; c < qtd; c++) {
        ajusta();
        if (o === 0 && c > 0) largo = (byte() & 1) === 1;
        byte();
        if (largo) byte();
      }
      for (let c = 0; c < runs * 4 + cbExt; c++) byte();
    }
    const ext = new Uint8Array(2 + baldes.length * 8);
    escreveU16(ext, 0, porBalde);
    baldes.forEach((b, k) => {
      escreveU32(ext, 2 + k * 8, b.ib);
      escreveU16(ext, 6 + k * 8, b.cb);
    });
    this.registros[iExt] = { tipo: R.EXTSST, dados: ext };
  }

  private serializarFluxo(): Uint8Array {
    const posicoes = new Map<Registro, number>();
    const calcular = () => {
      let pos = 0;
      for (const r of this.registros) {
        posicoes.set(r, pos);
        pos += 4 + r.dados.length;
      }
      return pos;
    };
    calcular();
    // O EXTSST pode mudar de tamanho; recalcula as posições depois dele.
    this.reconstruirExtsst(posicoes);
    const total = calcular();
    for (const { registro, aba } of this.boundsheets) {
      escreveU32(registro.dados, 0, posicoes.get(aba.bof) ?? 0);
    }
    const saida = new Uint8Array(total);
    let pos = 0;
    for (const r of this.registros) {
      if (r.dados.length > MAX_REGISTRO) throw new Error("Registro maior que o permitido no formato .xls.");
      escreveU16(saida, pos, r.tipo);
      escreveU16(saida, pos + 2, r.dados.length);
      saida.set(r.dados, pos + 4);
      pos += 4 + r.dados.length;
    }
    return saida;
  }

  /** Arquivo .xls final (mesmo contêiner OLE, só o fluxo Workbook trocado). */
  salvar(): Uint8Array {
    this.reconstruirSst();
    const fluxo = this.serializarFluxo();
    const entrada = CFB.find(this.container, "Workbook") ?? CFB.find(this.container, "Book");
    if (!entrada) throw new Error("Fluxo Workbook não encontrado.");
    entrada.content = fluxo;
    entrada.size = fluxo.length;
    const out = CFB.write(this.container, { type: "buffer", fileType: "cfb" }) as Uint8Array;
    return Uint8Array.from(out);
  }
}
