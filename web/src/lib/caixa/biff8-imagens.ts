/**
 * Fotos dentro do .xls (BIFF8 + Office Drawing/Escher).
 *
 * Pedido de 18/10: o relatório fotográfico da PLS/Repactuação/Alteração é
 * entregue no próprio .xls que vai ao SIOPI. As fotos antigas que estiverem
 * nos quadros são retiradas e as da medição entram no lugar, mantendo os
 * ícones e o restante dos desenhos do modelo da CAIXA.
 */
import { createHash } from "node:crypto";
import { PastaBiff8, R, type Registro } from "./biff8";

const MAX_REGISTRO = 8224;

export interface FotoXls {
  dados: Uint8Array;
  tipo: "jpeg" | "png";
}

/** Quadro de foto no modelo: canto superior esquerdo e inferior direito (base zero, inclusive). */
export interface QuadroFoto {
  coluna1: number;
  linha1: number;
  coluna2: number;
  linha2: number;
}

// Moldes extraídos do modelo oficial (foto "Imagem 36" da PLS).
const MOLDE_FORMA_HEX =
  "0f0004f0a2000000b2040af0080000002f140000000a0000e3000bf0680000007f008000800085000200000087000100000004410b000000800103000000bf0100001000c0013465a400c10100000100c201cb9a5b00d60102000000d70102000000ff01000009003f020000020080c31400000049006d006100670065006d002000330036000000000010f012000000000006000000c50000001b005700d200f700000011f000000000";
const MOLDE_OBJ_HEX = "1500120008002f00116000000000000000000000000000000000";

function hex(s: string) {
  return Uint8Array.from(s.match(/../g)!.map((h) => parseInt(h, 16)));
}
function u16(d: Uint8Array, o: number) {
  return d[o] | (d[o + 1] << 8);
}
function u32(d: Uint8Array, o: number) {
  return (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16)) + d[o + 3] * 0x1000000;
}
function w16(d: Uint8Array, o: number, v: number) {
  d[o] = v & 0xff;
  d[o + 1] = (v >> 8) & 0xff;
}
function w32(d: Uint8Array, o: number, v: number) {
  new DataView(d.buffer, d.byteOffset + o, 4).setUint32(0, v >>> 0, true);
}

interface Cabecalho {
  ver: number;
  inst: number;
  tipo: number;
  tam: number;
}
function cabecalho(d: Uint8Array, o: number): Cabecalho {
  const vi = u16(d, o);
  return { ver: vi & 0xf, inst: vi >> 4, tipo: u16(d, o + 2), tam: u32(d, o + 4) };
}

/** Dimensões em pixels de JPEG/PNG (para manter a proporção da foto). */
export function dimensoesImagem(img: FotoXls): { largura: number; altura: number } {
  const d = img.dados;
  if (img.tipo === "png") return { largura: u32be(d, 16), altura: u32be(d, 20) };
  let o = 2;
  while (o + 9 < d.length) {
    if (d[o] !== 0xff) {
      o++;
      continue;
    }
    const m = d[o + 1];
    const tam = (d[o + 2] << 8) | d[o + 3];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { altura: (d[o + 5] << 8) | d[o + 6], largura: (d[o + 7] << 8) | d[o + 8] };
    }
    o += 2 + tam;
  }
  return { largura: 4, altura: 3 };
}
function u32be(d: Uint8Array, o: number) {
  return d[o] * 0x1000000 + ((d[o + 1] << 16) | (d[o + 2] << 8) | d[o + 3]);
}

/** Medidas da grade (pontos) a partir de COLINFO / ROW / DEFROWHEIGHT da aba. */
function medidasDaGrade(pasta: PastaBiff8, nomeAba: string) {
  const larguras = new Map<number, number>();
  const alturas = new Map<number, number>();
  let alturaPadrao = 15;
  let larguraPadrao = 8.43;
  for (const { reg } of pasta.celulasDaAba(pasta.aba(nomeAba))) {
    const d = reg.dados;
    if (reg.tipo === 0x007d) {
      for (let c = u16(d, 0); c <= u16(d, 2); c++) larguras.set(c, u16(d, 4) / 256);
    } else if (reg.tipo === R.ROW) {
      const h = u16(d, 6);
      if (!(h & 0x8000)) alturas.set(u16(d, 0), h / 20);
    } else if (reg.tipo === 0x0225) {
      alturaPadrao = u16(d, 2) / 20;
    } else if (reg.tipo === 0x0055) {
      larguraPadrao = u16(d, 0);
    }
  }
  const largura = (c: number) => ((larguras.get(c) ?? larguraPadrao) * 7 + 5) * 0.75;
  const altura = (r: number) => alturas.get(r) ?? alturaPadrao;
  return { largura, altura };
}

/** Âncora (coluna/linha + frações) para a foto centralizada e proporcional no quadro. */
function ancoraNoQuadro(pasta: PastaBiff8, nomeAba: string, q: QuadroFoto, img: FotoXls) {
  const { largura, altura } = medidasDaGrade(pasta, nomeAba);
  const xs: number[] = [0];
  for (let c = q.coluna1; c <= q.coluna2; c++) xs.push(xs[xs.length - 1] + largura(c));
  const ys: number[] = [0];
  for (let r = q.linha1; r <= q.linha2; r++) ys.push(ys[ys.length - 1] + altura(r));
  const W = xs[xs.length - 1];
  const H = ys[ys.length - 1];
  const { largura: iw, altura: ih } = dimensoesImagem(img);
  const escala = Math.min(W / iw, H / ih);
  const w = iw * escala;
  const h = ih * escala;
  const x0 = (W - w) / 2;
  const y0 = (H - h) / 2;
  const pontoX = (x: number) => {
    let k = 0;
    while (k < xs.length - 2 && xs[k + 1] <= x) k++;
    const frac = (x - xs[k]) / (xs[k + 1] - xs[k]);
    return { celula: q.coluna1 + k, desloc: Math.min(1023, Math.max(0, Math.round(frac * 1024))) };
  };
  const pontoY = (y: number) => {
    let k = 0;
    while (k < ys.length - 2 && ys[k + 1] <= y) k++;
    const frac = (y - ys[k]) / (ys[k + 1] - ys[k]);
    return { celula: q.linha1 + k, desloc: Math.min(255, Math.max(0, Math.round(frac * 256))) };
  };
  return { a: pontoX(x0), b: pontoY(y0), c: pontoX(x0 + w - 0.01), d: pontoY(y0 + h - 0.01) };
}

/** Grupo de desenhos (MSODRAWINGGROUP + CONTINUE) como um só bloco de bytes. */
function lerGrupo(registros: Registro[]) {
  const i = registros.findIndex((r) => r.tipo === R.MSODRAWINGGROUP);
  if (i < 0) return null;
  let fim = i + 1;
  while (registros[fim]?.tipo === R.CONTINUE) fim++;
  const total = registros.slice(i, fim).reduce((s, r) => s + r.dados.length, 0);
  const bytes = new Uint8Array(total);
  let o = 0;
  for (const r of registros.slice(i, fim)) {
    bytes.set(r.dados, o);
    o += r.dados.length;
  }
  return { inicio: i, fim, bytes };
}

function filhos(d: Uint8Array, inicio: number, fim: number) {
  const lista: { o: number; h: Cabecalho }[] = [];
  let o = inicio;
  while (o + 8 <= fim) {
    const h = cabecalho(d, o);
    lista.push({ o, h });
    o += 8 + h.tam;
  }
  return lista;
}

/** Registro FBSE + BLIP (foto embutida no armazenamento do arquivo). */
function montarBlip(img: FotoXls): Uint8Array {
  const png = img.tipo === "png";
  const uid = createHash("md5").update(img.dados).digest();
  const blipTam = 17 + img.dados.length;
  const blip = new Uint8Array(8 + blipTam);
  w16(blip, 0, ((png ? 0x6e0 : 0x46a) << 4) | 0);
  w16(blip, 2, png ? 0xf01e : 0xf01d);
  w32(blip, 4, blipTam);
  blip.set(uid, 8);
  blip[24] = 0xff;
  blip.set(img.dados, 25);
  const fbse = new Uint8Array(8 + 36 + blip.length);
  w16(fbse, 0, ((png ? 6 : 5) << 4) | 2);
  w16(fbse, 2, 0xf007);
  w32(fbse, 4, 36 + blip.length);
  fbse[8] = png ? 6 : 5; // btWin32
  fbse[9] = png ? 6 : 5; // btMacOS
  fbse.set(uid, 10);
  w16(fbse, 26, 0x00ff);
  w32(fbse, 28, blip.length);
  w32(fbse, 32, 1); // cRef
  w32(fbse, 36, 0);
  fbse.set(blip, 44);
  return fbse;
}

/**
 * Troca as fotos dos quadros de uma aba. `quadros` define onde cada foto vai;
 * fotos excedentes são ignoradas e quadros sem foto ficam vazios.
 */
export function substituirFotos(pasta: PastaBiff8, nomeAba: string, quadros: QuadroFoto[], fotos: FotoXls[]) {
  const regs = pasta.registros;
  const grupo = lerGrupo(regs);
  if (!grupo) throw new Error("O modelo não tem área de desenhos; não é possível incluir fotos.");
  const g = grupo.bytes;
  const raiz = cabecalho(g, 0);
  if (raiz.tipo !== 0xf000) throw new Error("Estrutura de desenhos do modelo não reconhecida.");
  const filhosRaiz = filhos(g, 8, 8 + raiz.tam);
  const fdgg = filhosRaiz.find((f) => f.h.tipo === 0xf006);
  let bstore = filhosRaiz.find((f) => f.h.tipo === 0xf001);
  if (!fdgg) throw new Error("Estrutura de desenhos do modelo incompleta.");

  // --- desenhos da aba (somente nível principal, fora de gráficos embutidos)
  const [ini, fim] = pasta.intervaloDaAba(pasta.aba(nomeAba));
  let nivel = 0;
  const desenhos: number[] = [];
  for (let k = ini; k < fim; k++) {
    if (regs[k].tipo === R.BOF) nivel++;
    if (regs[k].tipo === R.EOF) nivel--;
    if (nivel === 1 && regs[k].tipo === R.MSODRAWING) desenhos.push(k);
  }
  if (!desenhos.length) throw new Error(`A aba "${nomeAba}" não tem desenhos do modelo.`);
  const primeiro = regs[desenhos[0]];
  const dg = cabecalho(primeiro.dados, 0);
  const fdg = cabecalho(primeiro.dados, 8);
  const spgr = cabecalho(primeiro.dados, 24);
  if (dg.tipo !== 0xf002 || fdg.tipo !== 0xf008 || spgr.tipo !== 0xf003) {
    throw new Error("Estrutura de desenhos da aba não reconhecida.");
  }
  const dgid = fdg.inst;

  // --- formas existentes: fotos dentro dos quadros saem
  const dentro = (c: number, r: number, q: QuadroFoto) => c >= q.coluna1 && c <= q.coluna2 && r >= q.linha1 && r <= q.linha2;
  const removerIndices: number[] = [];
  let molde: { forma: Uint8Array; obj: Uint8Array } | null = null;
  let delta = 0;
  let formasRemovidas = 0;
  const blipsLiberados: number[] = [];
  for (const k of desenhos.slice(1)) {
    const d = regs[k].dados;
    if (cabecalho(d, 0).tipo !== 0xf004) continue;
    const partes = filhos(d, 8, d.length);
    const opt = partes.find((p) => p.h.tipo === 0xf00b);
    const anc = partes.find((p) => p.h.tipo === 0xf010);
    if (!opt || !anc) continue;
    let pib = 0;
    for (let j = 0; j < opt.h.inst; j++) {
      const pid = u16(d, opt.o + 8 + j * 6);
      if ((pid & 0x3fff) === 0x0104) pib = u32(d, opt.o + 8 + j * 6 + 2);
    }
    const c1 = u16(d, anc.o + 10);
    const r1 = u16(d, anc.o + 14);
    const c2 = u16(d, anc.o + 18);
    const r2 = u16(d, anc.o + 22);
    // foto do quadro: o centro dela cai dentro do quadro
    const quadro = quadros.find((q) => dentro(Math.floor((c1 + c2) / 2), Math.floor((r1 + r2) / 2), q));
    if (!pib || !quadro || r2 - r1 < 5) continue; // ícones do modelo ficam
    if (regs[k + 1]?.tipo !== R.OBJ) continue;
    if (!molde) molde = { forma: d.slice(), obj: regs[k + 1].dados.slice() };
    removerIndices.push(k, k + 1);
    delta -= d.length;
    formasRemovidas++;
    blipsLiberados.push(pib);
  }

  // --- liberar referências das fotos antigas no armazenamento
  if (bstore) {
    const fbses = filhos(g, bstore.o + 8, bstore.o + 8 + bstore.h.tam);
    for (const pib of blipsLiberados) {
      const f = fbses[pib - 1];
      if (f && f.h.tipo === 0xf007) {
        const ref = u32(g, f.o + 8 + 24);
        if (ref > 0) w32(g, f.o + 8 + 24, ref - 1);
      }
    }
  }

  // --- novas fotos no armazenamento (BStore)
  const usar = fotos.slice(0, quadros.length);
  const blips = usar.map(montarBlip);
  const acrescimo = blips.reduce((s, b) => s + b.length, 0);
  let grupoNovo: Uint8Array;
  let primeiroPib: number;
  if (bstore) {
    // o campo "inst" do BStore nem sempre traz a contagem real: conta os FBSE
    const existentes = filhos(g, bstore.o + 8, bstore.o + 8 + bstore.h.tam).length;
    primeiroPib = existentes + 1;
    const fimBstore = bstore.o + 8 + bstore.h.tam;
    grupoNovo = new Uint8Array(g.length + acrescimo);
    grupoNovo.set(g.subarray(0, fimBstore), 0);
    let o = fimBstore;
    for (const b of blips) {
      grupoNovo.set(b, o);
      o += b.length;
    }
    grupoNovo.set(g.subarray(fimBstore), o);
    w16(grupoNovo, bstore.o, ((existentes + blips.length) << 4) | 0xf);
    w32(grupoNovo, bstore.o + 4, bstore.h.tam + acrescimo);
  } else {
    primeiroPib = 1;
    const cab = new Uint8Array(8);
    w16(cab, 0, (blips.length << 4) | 0xf);
    w16(cab, 2, 0xf001);
    w32(cab, 4, acrescimo);
    const fimFdgg = fdgg.o + 8 + fdgg.h.tam;
    grupoNovo = new Uint8Array(g.length + 8 + acrescimo);
    grupoNovo.set(g.subarray(0, fimFdgg), 0);
    grupoNovo.set(cab, fimFdgg);
    let o = fimFdgg + 8;
    for (const b of blips) {
      grupoNovo.set(b, o);
      o += b.length;
    }
    grupoNovo.set(g.subarray(fimFdgg), o);
    bstore = { o: fimFdgg, h: { ver: 0xf, inst: blips.length, tipo: 0xf001, tam: acrescimo } };
  }
  w32(grupoNovo, 4, cabecalho(grupoNovo, 0).tam + (grupoNovo.length - g.length));

  // --- novas formas na aba
  const fdgDados = 16;
  let spidAtual = u32(primeiro.dados, fdgDados + 4);
  const csp = u32(primeiro.dados, fdgDados);
  const base = molde ?? { forma: hex(MOLDE_FORMA_HEX), obj: hex(MOLDE_OBJ_HEX) };
  const novos: Registro[] = [];
  usar.forEach((img, n) => {
    const forma = base.forma.slice();
    const obj = base.obj.slice();
    spidAtual++;
    if ((spidAtual & 0x3ff) === 0) throw new Error("Limite de desenhos da aba atingido.");
    const partes = filhos(forma, 8, forma.length);
    const fsp = partes.find((p) => p.h.tipo === 0xf00a)!;
    w32(forma, fsp.o + 8, spidAtual);
    const opt = partes.find((p) => p.h.tipo === 0xf00b)!;
    for (let j = 0; j < opt.h.inst; j++) {
      const pid = u16(forma, opt.o + 8 + j * 6);
      if ((pid & 0x3fff) === 0x0104) w32(forma, opt.o + 8 + j * 6 + 2, primeiroPib + n);
    }
    const anc = partes.find((p) => p.h.tipo === 0xf010)!;
    const { a, b, c, d } = ancoraNoQuadro(pasta, nomeAba, quadros[n], img);
    w16(forma, anc.o + 8, 0x0000); // move e redimensiona com as células, como no modelo
    w16(forma, anc.o + 10, a.celula);
    w16(forma, anc.o + 12, a.desloc);
    w16(forma, anc.o + 14, b.celula);
    w16(forma, anc.o + 16, b.desloc);
    w16(forma, anc.o + 18, c.celula);
    w16(forma, anc.o + 20, c.desloc);
    w16(forma, anc.o + 22, d.celula);
    w16(forma, anc.o + 24, d.desloc);
    w16(obj, 6, spidAtual & 0xffff); // id do objeto (ftCmo)
    delta += forma.length;
    novos.push({ tipo: R.MSODRAWING, dados: forma }, { tipo: R.OBJ, dados: obj });
  });

  // posição de inserção: logo após a última forma (antes do SolverContainer)
  const restantes = desenhos.filter((k) => !removerIndices.includes(k));
  let ultimaForma = restantes[0];
  for (const k of restantes.slice(1)) if (cabecalho(regs[k].dados, 0).tipo === 0xf004) ultimaForma = k;
  let insercao = ultimaForma + 1;
  while ([R.OBJ, R.TXO, R.CONTINUE].includes(regs[insercao]?.tipo as never) && !removerIndices.includes(insercao)) insercao++;

  // --- cabeçalhos da aba: tamanhos, quantidade de formas e último id
  w32(primeiro.dados, 4, dg.tam + delta);
  w32(primeiro.dados, 28, spgr.tam + delta);
  w32(primeiro.dados, fdgDados, csp - formasRemovidas + usar.length);
  w32(primeiro.dados, fdgDados + 4, spidAtual);

  // --- FDGG: maior id, total de formas e grupo (cluster) desta aba
  const fo = fdgg.o + 8;
  const spidMax = u32(grupoNovo, fo);
  const clusters = u32(grupoNovo, fo + 4);
  w32(grupoNovo, fo + 8, u32(grupoNovo, fo + 8) - formasRemovidas + usar.length);
  const indiceCluster = (spidAtual >> 10) - 1;
  if (indiceCluster >= 0 && indiceCluster < clusters - 1) {
    const oc = fo + 16 + indiceCluster * 8;
    if (u32(grupoNovo, oc) === dgid) w32(grupoNovo, oc + 4, Math.max(u32(grupoNovo, oc + 4), (spidAtual & 0x3ff) + 1));
  }
  if (spidAtual >= spidMax) w32(grupoNovo, fo, ((spidAtual >> 10) + 1) * 1024);

  // --- aplica nos registros: primeiro a aba (índices maiores), depois o grupo
  for (const k of [...removerIndices].sort((x, y) => y - x)) regs.splice(k, 1);
  insercao -= removerIndices.filter((k) => k < insercao).length;
  regs.splice(insercao, 0, ...novos);
  const pedacos: Registro[] = [];
  for (let o = 0; o < grupoNovo.length; o += MAX_REGISTRO) {
    pedacos.push({ tipo: pedacos.length ? R.CONTINUE : R.MSODRAWINGGROUP, dados: grupoNovo.slice(o, o + MAX_REGISTRO) });
  }
  regs.splice(grupo.inicio, grupo.fim - grupo.inicio, ...pedacos);
}

/**
 * Imagens (JPEG/PNG) desenhadas numa aba, com a posição de cada uma. Usado
 * para levar o logotipo do próprio modelo enviado para o PDF.
 */
export function imagensDaAba(pasta: PastaBiff8, nomeAba: string): { coluna1: number; linha1: number; coluna2: number; linha2: number; imagem: FotoXls }[] {
  const regs = pasta.registros;
  const grupo = lerGrupo(regs);
  if (!grupo) return [];
  const g = grupo.bytes;
  const raiz = cabecalho(g, 0);
  const bstore = filhos(g, 8, 8 + raiz.tam).find((f) => f.h.tipo === 0xf001);
  if (!bstore) return [];
  const fbses = filhos(g, bstore.o + 8, bstore.o + 8 + bstore.h.tam);
  const [ini, fim] = pasta.intervaloDaAba(pasta.aba(nomeAba));
  const saida: { coluna1: number; linha1: number; coluna2: number; linha2: number; imagem: FotoXls }[] = [];
  let nivel = 0;
  for (let k = ini; k < fim; k++) {
    const reg = regs[k];
    if (reg.tipo === R.BOF) nivel++;
    if (reg.tipo === R.EOF) nivel--;
    if (nivel !== 1 || reg.tipo !== R.MSODRAWING) continue;
    const d = reg.dados;
    // a forma pode estar no 1º registro (depois dos cabeçalhos) ou sozinha
    const inicio = cabecalho(d, 0).tipo === 0xf002 ? 24 : 0;
    const procurar = (o: number, f: number): void => {
      for (const p of filhos(d, o, Math.min(f, d.length))) {
        if (p.h.tipo === 0xf003) procurar(p.o + 8, p.o + 8 + p.h.tam);
        if (p.h.tipo !== 0xf004) continue;
        const partes = filhos(d, p.o + 8, Math.min(p.o + 8 + p.h.tam, d.length));
        const opt = partes.find((x) => x.h.tipo === 0xf00b);
        const anc = partes.find((x) => x.h.tipo === 0xf010);
        if (!opt || !anc) continue;
        let pib = 0;
        for (let j = 0; j < opt.h.inst; j++) {
          if ((u16(d, opt.o + 8 + j * 6) & 0x3fff) === 0x0104) pib = u32(d, opt.o + 8 + j * 6 + 2);
        }
        const f = fbses[pib - 1];
        if (!pib || !f || f.h.tipo !== 0xf007) continue;
        const btWin = g[f.o + 8];
        if (btWin !== 5 && btWin !== 6) continue;
        const blip = f.o + 8 + 36;
        if (blip + 8 > g.length) continue;
        const hb = cabecalho(g, blip);
        // JPEG: 17 bytes de cabeçalho (ou 33 com 2º UID); PNG idem.
        const temUid2 = btWin === 6 ? hb.inst === 0x6e1 : hb.inst === 0x46b || hb.inst === 0x6e3;
        const ini2 = blip + 8 + (temUid2 ? 33 : 17);
        saida.push({
          coluna1: u16(d, anc.o + 10),
          linha1: u16(d, anc.o + 14),
          coluna2: u16(d, anc.o + 18),
          linha2: u16(d, anc.o + 22),
          imagem: { dados: g.slice(ini2, blip + 8 + hb.tam), tipo: btWin === 6 ? "png" : "jpeg" },
        });
      }
    };
    procurar(inicio, d.length);
  }
  return saida;
}
