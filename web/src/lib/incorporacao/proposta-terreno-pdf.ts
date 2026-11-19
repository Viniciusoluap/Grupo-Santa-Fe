// Paridade 17/11 (bloco 2) — Prospecta EPIC-024 S-06 (`shared/incorporacao/proposta-terreno-pdf.ts`): proposta formal
// de aquisição do terreno (PDF). UM gerador só, usado pelo download e pelo e-mail:
// mesmos dados + mesma data de emissão = mesmos bytes (data de criação e identificador do PDF fixados pela entrada).
// Regra do dono: nunca inventar termos — só o que está registrado na negociação; campo vazio é omitido.
import { jsPDF } from "jspdf";
import type { Proposta, TipoProposta } from "./negociacao";

export const ROTULO_MODALIDADE: Record<TipoProposta, string> = {
  compra_avista: "Compra à vista",
  compra_parcelada: "Compra parcelada",
  permuta_fisica: "Permuta física",
  permuta_financeira: "Permuta financeira",
  misto: "Misto (pagamento e permuta)",
};

const ROTULO_TIPO_EMPREENDIMENTO: Record<string, string> = {
  desmembramento_simples: "Desmembramento simples",
  vertical: "Vertical",
  loteamento: "Loteamento",
  residencial: "Residencial",
};

export interface DadosPropostaTerreno {
  empreendimento: { nome: string; cidade?: string | null; uf?: string | null; endereco?: string | null; tipo?: string | null };
  terreno: { areaM2?: number | null; matricula?: string | null };
  proprietario: { nome?: string | null; contato?: string | null; email?: string | null };
  proposta: Proposta;
  proponente: { empresa: string; responsavel?: string | null };
  /** AAAA-MM-DD (injetada: o download e o e-mail usam a mesma). */
  dataEmissao: string;
  /** PNG de exibição do logotipo do empreendimento (S-02), quando houver. */
  logoEmpreendimento?: { png: Uint8Array; largura: number; altura: number } | null;
}

export type Secao = { titulo: string; linhas: [string, string][] };

const texto = (v: string | null | undefined) => (v ?? "").trim();
const positivo = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const semNbsp = (s: string) => s.replace(/[  ]/g, " ");
export const reais = (v: number) => semNbsp(v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const numero = (v: number, casas = 2) => semNbsp(v.toLocaleString("pt-BR", { maximumFractionDigits: casas }));
export const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

function linhas(pares: [string, string | null | undefined][]): [string, string][] {
  return pares.filter((p): p is [string, string] => !!texto(p[1])).map(([r, v]) => [r, texto(v)]);
}

/** Conteúdo do PDF, em ordem; seções sem nenhum campo registrado não aparecem. */
export function secoesPropostaTerreno(d: DadosPropostaTerreno): Secao[] {
  const p = d.proposta;
  const e = d.empreendimento;
  const local = [texto(e.cidade), texto(e.uf)].filter(Boolean).join("/");
  const valor: [string, string | null][] = [
    ["Valor proposto", positivo(p.valorTotal) ? reais(p.valorTotal) : null],
    ["Permuta (percentual do VGV)", positivo(p.permutaPctVgv) ? `${numero(p.permutaPctVgv, 4)}%` : null],
    ["Unidades em permuta", positivo(p.unidadesPermuta) ? numero(p.unidadesPermuta, 0) : null],
  ];
  const secoes: Secao[] = [
    { titulo: "Empreendimento", linhas: linhas([
      ["Nome", e.nome], ["Tipo", e.tipo ? ROTULO_TIPO_EMPREENDIMENTO[e.tipo] ?? null : null], ["Município/UF", local],
    ]) },
    { titulo: "Proprietário/Terreneiro", linhas: linhas([
      ["Nome", d.proprietario.nome], ["Contato", d.proprietario.contato], ["E-mail", d.proprietario.email],
    ]) },
    { titulo: "Terreno", linhas: linhas([
      ["Endereço", e.endereco],
      ["Área", positivo(d.terreno.areaM2) ? `${numero(d.terreno.areaM2)} m² (${numero(d.terreno.areaM2 / 10_000, 4)} ha)` : null],
      ["Matrícula", d.terreno.matricula],
    ]) },
    { titulo: "Proposta", linhas: linhas([
      ["Modalidade", ROTULO_MODALIDADE[p.tipo]], ["Data da proposta", p.data ? dataBr(p.data) : null], ...valor,
    ]) },
    { titulo: "Condições de pagamento", linhas: linhas([
      ["Entrada", positivo(p.entradaPct) ? `${numero(p.entradaPct, 4)}% do valor proposto` : null],
      ["Prazo de parcelamento", positivo(p.prazoParcelamentoMeses) ? `${numero(p.prazoParcelamentoMeses, 0)} meses` : null],
    ]) },
    { titulo: "Prazos e observações", linhas: linhas([["Registrado na negociação", p.condicoes]]) },
    { titulo: "Proponente", linhas: linhas([["Empresa", d.proponente.empresa], ["Responsável", d.proponente.responsavel]]) },
  ];
  return secoes.filter((s) => s.linhas.length > 0);
}

export function nomeArquivoProposta(d: DadosPropostaTerreno): string {
  const base = d.empreendimento.nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "empreendimento";
  return `Proposta-terreno-${base}-${d.dataEmissao}.pdf`;
}

/** Identificador do PDF derivado do conteúdo (32 hex), para o arquivo ser reproduzível. */
function idDoArquivo(semente: string): string {
  let h = "";
  for (let k = 0; k < 4; k++) {
    let x = 0x811c9dc5 ^ k;
    for (let i = 0; i < semente.length; i++) { x ^= semente.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; }
    h += x.toString(16).padStart(8, "0");
  }
  return h.toUpperCase();
}

/** Diferença de identidade (não de regra): o cabeçalho leva a marca do Santa Fé. */
export const MARCA_CABECALHO = "GRUPO SANTA FÉ";
export const EMPRESA_PROPONENTE = "Grupo Santa Fé";

const ESCURO: [number, number, number] = [26, 35, 50];
const DOURADO: [number, number, number] = [201, 169, 97];

export function gerarPdfPropostaTerreno(d: DadosPropostaTerreno): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const emissao = new Date(`${d.dataEmissao}T12:00:00Z`);
  doc.setCreationDate(emissao);
  doc.setFileId(idDoArquivo(JSON.stringify([d.empreendimento.nome, d.proposta.id, d.dataEmissao])));
  doc.setProperties({ title: `Proposta de aquisição do terreno — ${d.empreendimento.nome}`, author: d.proponente.empresa, creator: d.proponente.empresa });
  const L = doc.internal.pageSize.getWidth();
  const A = doc.internal.pageSize.getHeight();
  const m = 18;
  const larg = L - m * 2;
  const fim = A - 18;
  let y = 0;

  // Cabeçalho: identidade do Grupo Santa Fé sempre; logotipo do empreendimento à direita, quando houver.
  doc.setFillColor(...ESCURO).rect(0, 0, L, 24, "F");
  doc.setFillColor(...DOURADO).rect(0, 24, L, 1.2, "F");
  doc.setTextColor(...DOURADO).setFont("helvetica", "bold").setFontSize(19).text(MARCA_CABECALHO, m, 12.5);
  doc.setTextColor(255, 255, 255).setFont("helvetica", "normal").setFontSize(8.5).text(d.proponente.empresa, m, 19);
  const logo = d.logoEmpreendimento;
  if (logo && logo.largura > 0 && logo.altura > 0) {
    const h = 16, w = Math.min(45, (h * logo.largura) / logo.altura);
    const hh = (w * logo.altura) / logo.largura;
    doc.setFillColor(255, 255, 255).rect(L - m - w - 2, 3, w + 4, 18, "F");
    try {
      doc.addImage(logo.png, "PNG", L - m - w, 4 + (h - hh) / 2, w, hh, undefined, "FAST");
    } catch {
      // PNG ilegível: a proposta sai só com a identidade do Grupo Santa Fé
    }
  }

  y = 37;
  doc.setTextColor(...ESCURO).setFont("helvetica", "bold").setFontSize(14);
  doc.text("PROPOSTA DE AQUISIÇÃO DE TERRENO", m, y);
  y += 6;
  doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(90, 90, 90);
  doc.text(`Emitida em ${dataBr(d.dataEmissao)}`, m, y);
  y += 9;

  const reservar = (alt: number) => {
    if (y + alt > fim) { doc.addPage(); y = m + 4; }
  };
  const destinatario = texto(d.proprietario.nome);
  const abertura = `${d.proponente.empresa} apresenta${destinatario ? ` a ${destinatario}` : ""} proposta formal de aquisição do terreno identificado abaixo, `
    + `na modalidade ${ROTULO_MODALIDADE[d.proposta.tipo].toLowerCase()}, conforme as condições registradas a seguir.`;
  doc.setTextColor(30, 30, 30).setFontSize(10.5);
  for (const linha of doc.splitTextToSize(abertura, larg) as string[]) { reservar(6); doc.text(linha, m, y); y += 5.2; }
  y += 4;

  const col = 52;
  for (const s of secoesPropostaTerreno(d)) {
    reservar(16);
    doc.setFillColor(244, 241, 232).rect(m, y - 4.6, larg, 7, "F");
    doc.setTextColor(...ESCURO).setFont("helvetica", "bold").setFontSize(10).text(s.titulo.toUpperCase(), m + 2, y);
    y += 6.5;
    for (const [rotulo, valor] of s.linhas) {
      const partes = doc.setFont("helvetica", "normal").setFontSize(10).splitTextToSize(valor, larg - col) as string[];
      reservar(partes.length * 4.6 + 1.2);
      doc.setFont("helvetica", "bold").setTextColor(90, 90, 90).text(rotulo, m + 2, y);
      doc.setFont("helvetica", "normal").setTextColor(30, 30, 30).text(partes, m + col, y);
      y += partes.length * 4.6 + 1.2;
    }
    y += 3;
  }

  // Aceite: o proprietário manifesta acordo assinando; o proponente assina a emissão.
  reservar(34);
  y += 2;
  doc.setTextColor(30, 30, 30).setFont("helvetica", "normal").setFontSize(10);
  doc.text("De acordo com a proposta acima, nas condições registradas.", m, y);
  y += 16;
  const metade = (larg - 12) / 2;
  doc.setDrawColor(120, 120, 120).line(m, y, m + metade, y).line(m + metade + 12, y, L - m, y);
  y += 5;
  doc.setFontSize(9).setFont("helvetica", "bold");
  doc.text(destinatario || "Proprietário(a)/Terreneiro(a)", m, y);
  doc.text(d.proponente.empresa, m + metade + 12, y, { maxWidth: metade });
  y += 4.5;
  doc.setFont("helvetica", "normal").setTextColor(90, 90, 90);
  doc.text("Proprietário(a)/Terreneiro(a) — data: ____/____/______", m, y);
  if (texto(d.proponente.responsavel)) doc.text(`Responsável: ${texto(d.proponente.responsavel)}`, m + metade + 12, y, { maxWidth: metade });

  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setDrawColor(...DOURADO).line(m, A - 14, L - m, A - 14);
    doc.setFontSize(7.5).setTextColor(110, 110, 110);
    doc.text(`${d.proponente.empresa} · Proposta de aquisição do terreno — ${d.empreendimento.nome}`, m, A - 9, { maxWidth: larg - 20 });
    doc.text(`${i}/${paginas}`, L - m, A - 9, { align: "right" });
  }
  return new Uint8Array(doc.output("arraybuffer"));
}
