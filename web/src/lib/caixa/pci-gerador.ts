/**
 * Lote 02, correção 03 (AD-06) — preenche o MODELO oficial da PCI (CAIXA) com
 * os dados do Gerador e monta o PDF com os mesmos dados.
 *
 * - .xls: `PastaBiff8` (registros originais mantidos; só as células de digitação
 *   mudam; resultados das fórmulas principais gravados em cache).
 * - .xlsm: edição das partes XML do zip (fflate); macros (vbaProject.bin),
 *   desenhos, validações e fórmulas ficam intactos; o Excel recalcula ao abrir.
 * - .xlsb: só leitura — gerar exige a versão .xls/.xlsm do modelo.
 *
 * As células são as mesmas lidas por `lerPci` (./pci.ts).
 * Gêmeo em Prospecta/server/caixa/pci-gerador.ts.
 */
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ABA_PROPOSTA_PCI,
  CAMPOS_PCI,
  COLUNA_CUSTO_PCI,
  LINHA_ADICIONAL_PCI,
  LINHA_CRONOGRAMA_PCI,
  LINHA_CUSTO_PCI,
  MAX_ETAPAS_PCI,
  MENSAGEM_XLSB_SO_LEITURA,
  QUADRO_LOCALIZACAO_PCI,
  SECOES_PCI,
  SERVICOS_CUSTO_PCI,
  SERVICO_OUTROS_PCI,
  TOTAL_ADICIONAIS_PCI,
  calcularTotaisPci,
  coordenadaPciParaCelula,
  formatarCep,
  formularioPciVazio,
  normalizarFormularioPci,
  numeroPci,
  type CampoPci,
  type FormatoModeloPci,
  type FormularioPci,
  type ValorCampoPci,
} from "@/lib/pci-gerador";
import { PastaBiff8, type ValorCelula } from "./biff8";
import { substituirFotos } from "./biff8-imagens";
import { formatarCoordenada, isoParaSerial, serialParaIso } from "./pci";
import { PastaXlsb } from "./xlsb";

export interface ResultadoGeracaoPci {
  bytes: Uint8Array;
  formato: "xls" | "xlsm";
  /** Campos que o modelo não aceitou (célula inexistente ou fórmula). */
  avisos: string[];
}

// ─── conversão campo ↔ célula ────────────────────────────────────────────────

/** Valor do formulário → valor gravado na célula (e o do hemisfério, se houver). */
export function valorParaCelula(campo: CampoPci, v: ValorCampoPci): { valor: ValorCelula; hemisferio?: ValorCelula } {
  if (v === null || v === "") return campo.tipo === "coordenada" ? { valor: null, hemisferio: null } : { valor: null };
  switch (campo.tipo) {
    case "numero":
    case "inteiro":
      return { valor: numeroPci(v) };
    case "data": {
      const iso = String(v);
      return { valor: /^\d{4}-\d{2}-\d{2}$/.test(iso) ? isoParaSerial(iso) : null };
    }
    case "cep": {
      const d = String(v).replace(/\D/g, "");
      return { valor: d.length === 8 ? Number(d) : String(v) };
    }
    case "telefone":
    case "registro": {
      const t = String(v).trim();
      return { valor: /^\d{1,15}$/.test(t) && !/^0/.test(t) ? Number(t) : t };
    }
    case "coordenada": {
      const r = coordenadaPciParaCelula(String(v), campo.id === "latitude" ? "lat" : "lng");
      return r ? { valor: r.numero, hemisferio: r.hemisferio } : { valor: String(v), hemisferio: null };
    }
    default:
      return { valor: String(v) };
  }
}

/** Valor lido da célula → valor do formulário (inverso de `valorParaCelula`). */
export function valorDaCelula(campo: CampoPci, v: ValorCelula, hemisferio?: ValorCelula): ValorCampoPci {
  if (v === null || v === undefined || v === "") return null;
  switch (campo.tipo) {
    case "numero":
      return numeroPci(v);
    case "inteiro": {
      const n = numeroPci(v);
      return n === null ? null : Math.round(n);
    }
    case "data":
      return typeof v === "number" ? serialParaIso(v) : null;
    case "cep":
      return formatarCep(v) || null;
    case "coordenada":
      return formatarCoordenada(v, String(hemisferio ?? "")) || null;
    case "documento":
      if (typeof v === "number") {
        const d = String(Math.round(v));
        return d.length <= 11
          ? d.padStart(11, "0").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
          : d.padStart(14, "0").replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
      }
      return String(v).trim() || null;
    default:
      if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
      if (typeof v === "boolean") return v ? "Sim" : "Não";
      return String(v).trim() || null;
  }
}

/** Todas as células (endereço → valor) que o formulário grava na aba da proposta. */
export function celulasDoFormulario(form: FormularioPci): { celula: string; valor: ValorCelula; rotulo: string }[] {
  const out: { celula: string; valor: ValorCelula; rotulo: string }[] = [];
  for (const campo of CAMPOS_PCI) {
    if (!campo.celula) continue;
    const { valor, hemisferio } = valorParaCelula(campo, form.campos[campo.id] ?? null);
    out.push({ celula: campo.celula, valor, rotulo: campo.rotulo });
    if (campo.celulaHemisferio) out.push({ celula: campo.celulaHemisferio, valor: hemisferio ?? null, rotulo: `${campo.rotulo} (hemisfério)` });
  }
  SERVICOS_CUSTO_PCI.forEach((nome, i) => out.push({ celula: `${COLUNA_CUSTO_PCI}${LINHA_CUSTO_PCI + i}`, valor: form.custos[i] ?? null, rotulo: `Custo: ${nome}` }));
  for (let i = 0; i < TOTAL_ADICIONAIS_PCI; i++) {
    const a = form.adicionais[i];
    out.push({ celula: `I${LINHA_ADICIONAL_PCI + i}`, valor: a?.descricao || null, rotulo: `Serviço adicional ${i + 1}` });
    out.push({ celula: `Z${LINHA_ADICIONAL_PCI + i}`, valor: a?.valor ?? null, rotulo: `Custo do serviço adicional ${i + 1}` });
  }
  const prazo = Math.min(numeroPci(form.campos.prazoMeses) ?? form.cronograma.length, MAX_ETAPAS_PCI);
  for (let k = 0; k < MAX_ETAPAS_PCI; k++) {
    out.push({ celula: `AI${LINHA_CRONOGRAMA_PCI + k}`, valor: k < prazo ? form.cronograma[k] ?? null : null, rotulo: `Cronograma etapa ${k + 1}` });
  }
  return out;
}

/** Resultados das fórmulas principais, gravados em cache (quem lê sem recalcular, como o SIOPI). */
export function resultadosEmCache(form: FormularioPci): { celula: string; valor: number }[] {
  const t = calcularTotaisPci(form);
  const r: { celula: string; valor: number }[] = [];
  t.incidencias.forEach((v, i) => r.push({ celula: `X${LINHA_CUSTO_PCI + i}`, valor: v }));
  t.acumulado.forEach((v, i) => r.push({ celula: `AI${LINHA_CUSTO_PCI + i}`, valor: v }));
  r.push({ celula: `${COLUNA_CUSTO_PCI}${LINHA_CUSTO_PCI + 19}`, valor: t.outros });
  r.push({ celula: "AB140", valor: t.totalServicos }, { celula: "AB141", valor: t.valorBdi }, { celula: "AB142", valor: t.totalComBdi });
  r.push({ celula: "Z159", valor: t.outros });
  if (t.areaConstruida !== null) r.push({ celula: "AC73", valor: t.areaConstruida });
  return r;
}

// ─── leitura ─────────────────────────────────────────────────────────────────

type Leitor = (endereco: string) => ValorCelula;

function formularioDeLeitor(ler: Leitor): FormularioPci {
  const form = formularioPciVazio();
  for (const campo of CAMPOS_PCI) {
    if (!campo.celula) continue;
    form.campos[campo.id] = valorDaCelula(campo, ler(campo.celula), campo.celulaHemisferio ? ler(campo.celulaHemisferio) : undefined);
  }
  form.custos = SERVICOS_CUSTO_PCI.map((_, i) => numeroPci(ler(`${COLUNA_CUSTO_PCI}${LINHA_CUSTO_PCI + i}`)));
  form.adicionais = form.adicionais.map((_, i) => {
    const d = ler(`I${LINHA_ADICIONAL_PCI + i}`);
    return { descricao: d === null ? "" : String(d).trim(), valor: numeroPci(ler(`Z${LINHA_ADICIONAL_PCI + i}`)) };
  });
  const prazo = Math.min(Math.round(numeroPci(ler("T161")) ?? 0), MAX_ETAPAS_PCI);
  form.cronograma = Array.from({ length: prazo }, (_, k) => numeroPci(ler(`AI${LINHA_CRONOGRAMA_PCI + k}`)));
  return normalizarFormularioPci(form);
}

/** Lê os campos do Gerador de uma PCI/modelo .xls, .xlsm ou .xlsb (mesmo mapa de células). */
export function lerFormularioPci(arquivo: Uint8Array): FormularioPci {
  if (arquivo[0] === 0xd0 && arquivo[1] === 0xcf) {
    const p = PastaBiff8.abrir(arquivo);
    if (!p.abas.some((a) => a.nome === ABA_PROPOSTA_PCI)) throw new Error(`A planilha não tem a aba "${ABA_PROPOSTA_PCI}".`);
    return formularioDeLeitor((e) => p.ler(ABA_PROPOSTA_PCI, e));
  }
  if (arquivo[0] === 0x50 && arquivo[1] === 0x4b) {
    const zip = unzipSync(arquivo);
    if (zip["xl/workbook.bin"]) {
      // .xlsb: só leitura (mapeamento), com o mesmo leitor do lerPci.
      const xlsb = new PastaXlsb(arquivo);
      if (!xlsb.abas.includes(ABA_PROPOSTA_PCI)) throw new Error(`A planilha não tem a aba "${ABA_PROPOSTA_PCI}".`);
      return formularioDeLeitor((e) => xlsb.ler(ABA_PROPOSTA_PCI, e));
    }
    const pasta = new PastaXlsx(zip);
    if (!pasta.abas.includes(ABA_PROPOSTA_PCI)) throw new Error(`A planilha não tem a aba "${ABA_PROPOSTA_PCI}".`);
    return formularioDeLeitor((e) => pasta.ler(ABA_PROPOSTA_PCI, e));
  }
  throw new Error("Arquivo de planilha não reconhecido.");
}

/** Confere se o arquivo é a planilha da PCI (tem a aba da proposta). */
export function validarModeloPci(arquivo: Uint8Array, formato: FormatoModeloPci): void {
  let abas: string[];
  try {
    if (formato === "xls") abas = PastaBiff8.abrir(arquivo).abas.map((a) => a.nome);
    else if (formato === "xlsb") abas = new PastaXlsb(arquivo).abas;
    else abas = new PastaXlsx(unzipSync(arquivo)).abas;
  } catch (e) {
    throw new Error(`Não foi possível abrir o modelo: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!abas.includes(ABA_PROPOSTA_PCI)) throw new Error(`O arquivo não tem a aba "${ABA_PROPOSTA_PCI}". Envie a PCI oficial da CAIXA.`);
}

// ─── .xls ────────────────────────────────────────────────────────────────────

function gerarXls(modelo: Uint8Array, form: FormularioPci): ResultadoGeracaoPci {
  const p = PastaBiff8.abrir(modelo);
  if (!p.abas.some((a) => a.nome === ABA_PROPOSTA_PCI)) throw new Error(`O modelo não tem a aba "${ABA_PROPOSTA_PCI}". Confira se é a PCI oficial da CAIXA.`);
  const avisos: string[] = [];
  for (const { celula, valor, rotulo } of celulasDoFormulario(form)) {
    try {
      p.escrever(ABA_PROPOSTA_PCI, celula, valor);
    } catch (e) {
      if (valor !== null) avisos.push(`${rotulo} (${celula}): ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  for (const { celula, valor } of resultadosEmCache(form)) {
    try {
      if (p.ehFormula(ABA_PROPOSTA_PCI, celula)) p.gravarResultado(ABA_PROPOSTA_PCI, celula, valor);
    } catch {
      // cache é só conveniência; o Excel recalcula
    }
  }
  if (form.imagem) {
    try {
      substituirFotos(p, ABA_PROPOSTA_PCI, [QUADRO_LOCALIZACAO_PCI], [{ dados: new Uint8Array(Buffer.from(form.imagem.base64, "base64")), tipo: form.imagem.tipo }]);
    } catch (e) {
      avisos.push(`Imagem de localização não incluída no Excel: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { bytes: p.salvar(), formato: "xls", avisos };
}

// ─── .xlsm (Office Open XML) ─────────────────────────────────────────────────

const escaparXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const desescaparXml = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, "&");

function colunaParaIndice(col: string): number {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}
function separarEndereco(e: string): { col: string; linha: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(e.toUpperCase());
  if (!m) throw new Error(`Endereço de célula inválido: ${e}`);
  return { col: m[1], linha: Number(m[2]) };
}

/** Leitura/escrita mínima de .xlsx/.xlsm: só o necessário para as células de digitação. */
export class PastaXlsx {
  private abasPorNome = new Map<string, string>();
  private compartilhadas: string[] = [];
  constructor(private arquivos: Record<string, Uint8Array>) {
    const wb = arquivos["xl/workbook.xml"];
    const rels = arquivos["xl/_rels/workbook.xml.rels"];
    if (!wb || !rels) throw new Error("Planilha .xlsm sem pasta de trabalho.");
    const relXml = strFromU8(rels);
    const alvo = new Map<string, string>();
    for (const m of Array.from(relXml.matchAll(/<Relationship\b[^>]*>/g))) {
      const id = /\bId="([^"]+)"/.exec(m[0])?.[1];
      const t = /\bTarget="([^"]+)"/.exec(m[0])?.[1];
      if (id && t) alvo.set(id, t.startsWith("/") ? t.slice(1) : `xl/${t}`);
    }
    for (const m of Array.from(strFromU8(wb).matchAll(/<sheet\b[^>]*>/g))) {
      const nome = /\bname="([^"]+)"/.exec(m[0])?.[1];
      const rid = /\br:id="([^"]+)"/.exec(m[0])?.[1] ?? /\bid="([^"]+)"/.exec(m[0])?.[1];
      if (nome && rid && alvo.get(rid)) this.abasPorNome.set(desescaparXml(nome), alvo.get(rid)!);
    }
    const ss = arquivos["xl/sharedStrings.xml"];
    if (ss) {
      for (const si of Array.from(strFromU8(ss).matchAll(/<si>([\s\S]*?)<\/si>/g))) {
        this.compartilhadas.push(Array.from(si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map((t) => desescaparXml(t[1])).join(""));
      }
    }
  }

  get abas(): string[] {
    return Array.from(this.abasPorNome.keys());
  }

  private caminho(aba: string): string {
    const c = this.abasPorNome.get(aba);
    if (!c || !this.arquivos[c]) throw new Error(`A planilha não tem a aba "${aba}".`);
    return c;
  }

  private celulaXml(xml: string, endereco: string): { inicio: number; fim: number; texto: string } | null {
    const re = new RegExp(`<c\\b[^>]*\\br="${endereco}"[^>]*?(?:/>|>[\\s\\S]*?</c>)`);
    const m = re.exec(xml);
    return m ? { inicio: m.index, fim: m.index + m[0].length, texto: m[0] } : null;
  }

  ler(aba: string, endereco: string): ValorCelula {
    const xml = strFromU8(this.arquivos[this.caminho(aba)]);
    const cel = this.celulaXml(xml, endereco.toUpperCase());
    if (!cel) return null;
    const tipo = /^<c\b[^>]*\bt="([^"]+)"/.exec(cel.texto)?.[1];
    const v = /<v>([\s\S]*?)<\/v>/.exec(cel.texto)?.[1];
    if (tipo === "inlineStr") {
      const ts = Array.from(cel.texto.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map((t) => desescaparXml(t[1])).join("");
      return ts;
    }
    if (v === undefined) return null;
    if (tipo === "s") return this.compartilhadas[Number(v)] ?? null;
    if (tipo === "str") return desescaparXml(v);
    if (tipo === "b") return v === "1";
    if (tipo === "e") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  ehFormula(aba: string, endereco: string): boolean {
    const xml = strFromU8(this.arquivos[this.caminho(aba)]);
    const cel = this.celulaXml(xml, endereco.toUpperCase());
    return !!cel && /<f[\s>/]/.test(cel.texto);
  }

  /** Grava valores; não sobrescreve fórmulas (vão para `recusadas`). */
  escreverVarias(aba: string, valores: { celula: string; valor: ValorCelula }[]): string[] {
    const caminho = this.caminho(aba);
    let xml = strFromU8(this.arquivos[caminho]);
    const recusadas: string[] = [];
    for (const { celula, valor } of valores) {
      const endereco = celula.toUpperCase();
      const atual = this.celulaXml(xml, endereco);
      if (atual && /<f[\s>/]/.test(atual.texto)) {
        if (valor !== null) recusadas.push(endereco);
        continue;
      }
      const estilo = atual ? /^<c\b[^>]*\bs="(\d+)"/.exec(atual.texto)?.[1] : undefined;
      const s = estilo ? ` s="${estilo}"` : "";
      let nova: string;
      if (valor === null || valor === "") nova = `<c r="${endereco}"${s}/>`;
      else if (typeof valor === "number") nova = `<c r="${endereco}"${s}><v>${valor}</v></c>`;
      else if (typeof valor === "boolean") nova = `<c r="${endereco}"${s} t="b"><v>${valor ? 1 : 0}</v></c>`;
      else nova = `<c r="${endereco}"${s} t="inlineStr"><is><t xml:space="preserve">${escaparXml(valor.slice(0, 8000))}</t></is></c>`;
      if (atual) {
        xml = xml.slice(0, atual.inicio) + nova + xml.slice(atual.fim);
        continue;
      }
      if (valor === null || valor === "") continue; // célula inexistente e vazia: nada a fazer
      xml = inserirCelula(xml, endereco, nova);
    }
    this.arquivos[caminho] = strToU8(xml);
    return recusadas;
  }

  /** Pede ao Excel para recalcular tudo ao abrir (fórmulas não têm cache novo). */
  recalcularAoAbrir() {
    const wb = strFromU8(this.arquivos["xl/workbook.xml"]);
    let novo: string;
    if (/<calcPr\b/.test(wb)) novo = wb.replace(/<calcPr\b([^>]*?)(\/?)>/, (_m, attrs: string, fecha: string) => `<calcPr${attrs.replace(/\sfullCalcOnLoad="[^"]*"/, "")} fullCalcOnLoad="1"${fecha}>`);
    else novo = wb.replace(/<\/workbook>/, '<calcPr fullCalcOnLoad="1"/></workbook>');
    this.arquivos["xl/workbook.xml"] = strToU8(novo);
  }

  salvar(): Uint8Array {
    return zipSync(this.arquivos, { level: 6 });
  }
}

/** Insere a célula na linha certa (ordem das colunas) e cria a linha se faltar. */
function inserirCelula(xml: string, endereco: string, nova: string): string {
  const { col, linha } = separarEndereco(endereco);
  const reLinha = new RegExp(`<row\\b[^>]*\\br="${linha}"[^>]*?(?:/>|>([\\s\\S]*?)</row>)`);
  const m = reLinha.exec(xml);
  if (m) {
    const abre = /^<row\b[^>]*?(\/?)>/.exec(m[0])!;
    const conteudo = m[1] ?? "";
    const celulas = Array.from(conteudo.matchAll(/<c\b[^>]*\br="([A-Z]+)\d+"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g));
    let pos = conteudo.length;
    for (const c of celulas) {
      if (colunaParaIndice(c[1]) > colunaParaIndice(col)) { pos = c.index!; break; }
    }
    const novoConteudo = conteudo.slice(0, pos) + nova + conteudo.slice(pos);
    const cabecalho = abre[1] ? abre[0].replace(/\/>$/, ">") : abre[0];
    return xml.slice(0, m.index) + `${cabecalho}${novoConteudo}</row>` + xml.slice(m.index + m[0].length);
  }
  const novaLinha = `<row r="${linha}">${nova}</row>`;
  const sheetData = /<sheetData\b[^>]*?(\/?)>/.exec(xml);
  if (!sheetData) throw new Error("Aba sem dados (sheetData).");
  if (sheetData[1]) return xml.replace(sheetData[0], `<sheetData>${novaLinha}</sheetData>`);
  const fim = xml.indexOf("</sheetData>");
  for (const r of Array.from(xml.slice(sheetData.index, fim).matchAll(/<row\b[^>]*\br="(\d+)"/g))) {
    if (Number(r[1]) > linha) {
      const i = sheetData.index + r.index!;
      return xml.slice(0, i) + novaLinha + xml.slice(i);
    }
  }
  return xml.slice(0, fim) + novaLinha + xml.slice(fim);
}

function gerarXlsm(modelo: Uint8Array, form: FormularioPci): ResultadoGeracaoPci {
  const zip = unzipSync(modelo);
  if (zip["xl/workbook.bin"]) throw new Error(MENSAGEM_XLSB_SO_LEITURA);
  const pasta = new PastaXlsx(zip);
  if (!pasta.abas.includes(ABA_PROPOSTA_PCI)) throw new Error(`O modelo não tem a aba "${ABA_PROPOSTA_PCI}". Confira se é a PCI oficial da CAIXA.`);
  const celulas = celulasDoFormulario(form);
  const recusadas = new Set(pasta.escreverVarias(ABA_PROPOSTA_PCI, celulas));
  const avisos = celulas.filter((c) => recusadas.has(c.celula)).map((c) => `${c.rotulo} (${c.celula}): fórmula do modelo, não sobrescrita.`);
  pasta.recalcularAoAbrir();
  if (form.imagem) avisos.push("Imagem de localização: no modelo .xlsm ela vai só no PDF (insira no Excel, se precisar). No modelo .xls ela entra no quadro da poligonal.");
  return { bytes: pasta.salvar(), formato: "xlsm", avisos };
}

/** Preenche o modelo oficial (xls/xlsm). xlsb → erro claro. */
export function gerarPlanilhaPci(modelo: Uint8Array, formato: FormatoModeloPci, entrada: FormularioPci): ResultadoGeracaoPci {
  const form = normalizarFormularioPci(entrada);
  if (formato === "xlsb") throw new Error(MENSAGEM_XLSB_SO_LEITURA);
  return formato === "xls" ? gerarXls(modelo, form) : gerarXlsm(modelo, form);
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

const AZUL: [number, number, number] = [31, 56, 100];
const brl = (v: number | null | undefined, casas = 2) =>
  v === null || v === undefined || !Number.isFinite(v) ? "" : v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

function textoCampo(campo: CampoPci, v: ValorCampoPci): string {
  if (v === null || v === "") return "";
  if (campo.tipo === "numero") return brl(numeroPci(v));
  if (campo.tipo === "data") return String(v).split("-").reverse().join("/");
  return String(v);
}

export interface CabecalhoPdfPci {
  obraTitulo: string | null;
  modeloVersao: number;
  modeloArquivo: string;
  geradoEm: Date;
  autor: string | null;
}

/** PDF com os mesmos dados gravados na planilha, por seção, com paginação. */
export function gerarPdfPci(entrada: FormularioPci, cab: CabecalhoPdfPci): Uint8Array {
  const form = normalizarFormularioPci(entrada);
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const largura = pdf.internal.pageSize.getWidth();
  const margem = 12;
  let y = 14;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(...AZUL);
  pdf.text("Proposta de Construção Individual — CAIXA", margem, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(60, 60, 60);
  y += 5;
  const quando = cab.geradoEm.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  pdf.text(`${cab.obraTitulo ? `Obra: ${cab.obraTitulo} · ` : ""}Modelo v${cab.modeloVersao} (${cab.modeloArquivo}) · Gerado em ${quando}${cab.autor ? ` por ${cab.autor}` : ""}`, margem, y, { maxWidth: largura - 2 * margem });
  y += 5;

  const comum = {
    margin: { left: margem, right: margem, top: 12, bottom: 14 },
    styles: { fontSize: 8, cellPadding: 1.4, overflow: "linebreak" as const },
    headStyles: { fillColor: AZUL, textColor: 255, fontStyle: "bold" as const },
    theme: "grid" as const,
  };
  const proximoY = () => ((pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 4;

  for (const secao of SECOES_PCI) {
    if (secao.id === "custos") {
      const t = calcularTotaisPci(form);
      const linhas = [
        ...SERVICOS_CUSTO_PCI.map((nome, i) => [String(i + 1), nome, brl(form.custos[i]), brl(t.incidencias[i], 4), brl(t.acumulado[i], 4)]),
        ["20", SERVICO_OUTROS_PCI, brl(t.outros), brl(t.incidencias[19], 4), brl(t.acumulado[19], 4)],
      ];
      autoTable(pdf, { ...comum, startY: y, head: [[{ content: secao.titulo, colSpan: 5 }], ["Item", "Serviço", "Custo (R$)", "Incidência (%)", "% Ac."]], body: linhas,
        foot: [
          ["", "Custo total de serviços", brl(t.totalServicos), "", ""],
          ["", `BDI (${brl(numeroPci(form.campos.bdi))}%)`, brl(t.valorBdi), "", ""],
          ["", "Custo total com BDI", brl(t.totalComBdi), "", ""],
          ["", "Custo total de produção (terreno + serviços c/ BDI)", brl(t.custoProducao), "", ""],
        ],
        footStyles: { fillColor: [235, 235, 245], textColor: 20, fontStyle: "bold" },
        columnStyles: { 0: { cellWidth: 10 }, 2: { halign: "right", cellWidth: 28 }, 3: { halign: "right", cellWidth: 24 }, 4: { halign: "right", cellWidth: 22 } } });
      y = proximoY();
      const adicionais = form.adicionais.map((a, i) => [String(i + 1), a.descricao, brl(a.valor)]).filter((l) => l[1] || l[2]);
      if (adicionais.length) {
        autoTable(pdf, { ...comum, startY: y, head: [["Item", "Serviços adicionais", "Custo (R$)"]], body: adicionais,
          columnStyles: { 0: { cellWidth: 10 }, 2: { halign: "right", cellWidth: 28 } } });
        y = proximoY();
      }
      continue;
    }
    if (secao.id === "localizacao") {
      if (!form.imagem) continue;
      const altura = 90;
      if (y + altura + 8 > pdf.internal.pageSize.getHeight() - 14) { pdf.addPage(); y = 14; }
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(...AZUL);
      pdf.text(secao.titulo, margem, y);
      y += 2;
      try {
        const props = pdf.getImageProperties(`data:image/${form.imagem.tipo};base64,${form.imagem.base64}`);
        const w = Math.min(largura - 2 * margem, (altura * props.width) / props.height);
        const h = (w * props.height) / props.width;
        pdf.addImage(`data:image/${form.imagem.tipo};base64,${form.imagem.base64}`, form.imagem.tipo === "png" ? "PNG" : "JPEG", margem, y, w, h);
        y += h + 4;
      } catch {
        pdf.setFont("helvetica", "normal");
        pdf.text("Imagem de localização ilegível.", margem, y + 4);
        y += 8;
      }
      continue;
    }
    const campos = CAMPOS_PCI.filter((campo) => campo.secao === secao.id);
    const corpo = campos.map((campo) => [campo.rotulo, textoCampo(campo, form.campos[campo.id] ?? null)]);
    autoTable(pdf, { ...comum, startY: y, head: [[{ content: secao.titulo, colSpan: 2 }]], body: corpo,
      columnStyles: { 0: { cellWidth: 70, fontStyle: "bold", fillColor: [245, 245, 250] } } });
    y = proximoY();
    if (secao.id === "cronograma") {
      const etapas = form.cronograma.map((v, k) => [String(k + 1), brl(v)]);
      if (etapas.length) {
        autoTable(pdf, { ...comum, startY: y, head: [["Etapa (mês)", "% acumulado proposto"]], body: [["0", "0,00"], ...etapas],
          columnStyles: { 1: { halign: "right" } } });
        y = proximoY();
      }
    }
  }

  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(110, 110, 110);
    pdf.text(`Página ${i} de ${total}`, largura - margem, pdf.internal.pageSize.getHeight() - 6, { align: "right" });
  }
  return new Uint8Array(pdf.output("arraybuffer"));
}
