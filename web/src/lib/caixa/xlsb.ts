/**
 * Leitura de valores de planilhas .xlsb (Excel binário, BIFF12).
 *
 * Pedido de 18/10: a PCI do cliente pode chegar em .xls ou .xlsb. Aqui só se
 * leem valores (inclusive o resultado em cache das fórmulas) para buscar as
 * incidências e a identificação; o .xlsb nunca é regravado.
 */
import { unzipSync, strFromU8 } from "fflate";
import type { ValorCelula } from "./biff8";
import { enderecoParaPosicao } from "./biff8";

class Leitor {
  o = 0;
  constructor(public d: Uint8Array) {}
  fim() {
    return this.o >= this.d.length;
  }
  varint(max: number) {
    let v = 0;
    for (let k = 0; k < max; k++) {
      const b = this.d[this.o++];
      v += (b & 0x7f) * 2 ** (7 * k);
      if (!(b & 0x80)) break;
    }
    return v;
  }
}

function u32(d: Uint8Array, o: number) {
  return (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16)) + d[o + 3] * 0x1000000;
}
function f64(d: Uint8Array, o: number) {
  return new DataView(d.buffer, d.byteOffset + o, 8).getFloat64(0, true);
}
function wide(d: Uint8Array, o: number): { s: string; fim: number } {
  const n = u32(d, o);
  if (n === 0xffffffff) return { s: "", fim: o + 4 };
  let s = "";
  for (let k = 0; k < n; k++) s += String.fromCharCode(d[o + 4 + k * 2] | (d[o + 5 + k * 2] << 8));
  return { s, fim: o + 4 + n * 2 };
}
function rk(v: number) {
  const centesimos = (v & 1) !== 0;
  let n: number;
  if (v & 2) n = (v | 0) >> 2;
  else {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setUint32(4, (v & 0xfffffffc) >>> 0, true);
    n = f64(b, 0);
  }
  return centesimos ? n / 100 : n;
}

function registros(d: Uint8Array): { tipo: number; dados: Uint8Array }[] {
  const l = new Leitor(d);
  const lista: { tipo: number; dados: Uint8Array }[] = [];
  while (!l.fim()) {
    const tipo = l.varint(2);
    const tam = l.varint(4);
    const ini = l.o;
    l.o += tam;
    lista.push({ tipo, dados: d.subarray(ini, ini + tam) });
  }
  return lista;
}

export class PastaXlsb {
  private arquivos: Record<string, Uint8Array>;
  private strings: string[] = [];
  private caminhoAba = new Map<string, string>();
  private cache = new Map<string, Map<string, ValorCelula>>();
  readonly abas: string[] = [];

  constructor(arquivo: Uint8Array) {
    try {
      this.arquivos = unzipSync(arquivo);
    } catch {
      throw new Error("O arquivo não é uma planilha .xlsb válida.");
    }
    const wb = this.arquivos["xl/workbook.bin"];
    const rels = this.arquivos["xl/_rels/workbook.bin.rels"];
    if (!wb || !rels) throw new Error("O arquivo não é uma planilha .xlsb válida.");
    const alvos = new Map<string, string>();
    const xml = strFromU8(rels);
    const re = /<Relationship\b[^>]*>/g;
    for (let m = re.exec(xml); m; m = re.exec(xml)) {
      const id = /Id="([^"]+)"/.exec(m[0])?.[1];
      const alvo = /Target="([^"]+)"/.exec(m[0])?.[1];
      if (id && alvo) alvos.set(id, alvo.replace(/^\/?xl\//, "").replace(/^\//, ""));
    }
    for (const r of registros(wb)) {
      if (r.tipo !== 156) continue; // BrtBundleSh
      const rel = wide(r.dados, 8);
      const nome = wide(r.dados, rel.fim).s;
      this.abas.push(nome);
      const alvo = alvos.get(rel.s);
      if (alvo) this.caminhoAba.set(nome, "xl/" + alvo);
    }
    const sst = this.arquivos["xl/sharedStrings.bin"];
    if (sst) {
      for (const r of registros(sst)) if (r.tipo === 19) this.strings.push(wide(r.dados, 1).s);
    }
  }

  private carregarAba(nome: string): Map<string, ValorCelula> {
    const pronto = this.cache.get(nome);
    if (pronto) return pronto;
    const caminho = this.caminhoAba.get(nome);
    const dados = caminho ? this.arquivos[caminho] : undefined;
    if (!dados) throw new Error(`A planilha não tem a aba "${nome}".`);
    const celulas = new Map<string, ValorCelula>();
    let linha = 0;
    for (const r of registros(dados)) {
      const d = r.dados;
      if (r.tipo === 0) {
        linha = u32(d, 0);
        continue;
      }
      if (r.tipo < 1 || r.tipo > 11) continue;
      const chave = `${linha},${u32(d, 0)}`;
      switch (r.tipo) {
        case 2:
          celulas.set(chave, rk(u32(d, 8)));
          break;
        case 4:
        case 10:
          celulas.set(chave, d[8] === 1);
          break;
        case 5:
        case 9:
          celulas.set(chave, f64(d, 8));
          break;
        case 6:
        case 8:
          celulas.set(chave, wide(d, 8).s);
          break;
        case 7:
          celulas.set(chave, this.strings[u32(d, 8)] ?? "");
          break;
        default:
          celulas.set(chave, null);
      }
    }
    this.cache.set(nome, celulas);
    return celulas;
  }

  ler(aba: string, endereco: string): ValorCelula {
    const { linha, coluna } = enderecoParaPosicao(endereco);
    return this.carregarAba(aba).get(`${linha},${coluna}`) ?? null;
  }
}
