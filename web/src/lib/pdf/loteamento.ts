// Relatórios PDF do estudo de loteamento (Executivo, Custos, Terreneiro).
// Gerados 100% no browser com jspdf + autotable a partir dos resultados do
// motor determinístico — sem servidor, sem IA, sem custo por geração.

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CenariosLoteamento, ResultadoLoteamento } from "@/lib/finance/loteamento";
import { formatCurrency } from "@/lib/utils";

export interface MetaRelatorio {
  nome: string;
  municipio: string;
  estado: string;
  permutaPct: number;       // % (0..100) do VGV do terreneiro
  taxaDescontoAnual: number; // % a.a.
}

const ESCURO: [number, number, number] = [26, 26, 26];
const AMARELO: [number, number, number] = [245, 196, 0];

function cabecalho(doc: jsPDF, tituloRelatorio: string, meta: MetaRelatorio) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(...ESCURO);
  doc.rect(0, 0, pw, 34, "F");
  doc.setTextColor(...AMARELO).setFontSize(15).setFont("helvetica", "bold");
  doc.text(tituloRelatorio.toUpperCase(), 14, 16);
  doc.setTextColor(255, 255, 255).setFontSize(9).setFont("helvetica", "normal");
  doc.text("Grupo Santa Fé — Estudo de Loteamento (motor determinístico)", 14, 23);
  doc.text(new Date().toLocaleDateString("pt-BR"), 14, 29);

  const y = 44;
  doc.setTextColor(...ESCURO).setFontSize(13).setFont("helvetica", "bold");
  doc.text(meta.nome, 14, y);
  doc.setFontSize(10).setFont("helvetica", "normal").setTextColor(90, 90, 90);
  doc.text(`${meta.municipio}/${meta.estado}`, 14, y + 6);
  return y + 14;
}

function titulo(doc: jsPDF, txt: string, y: number): number {
  if (y > 258) { doc.addPage(); y = 20; }
  doc.setFontSize(11).setFont("helvetica", "bold").setTextColor(...ESCURO);
  doc.text(txt, 14, y);
  doc.setDrawColor(...AMARELO).setLineWidth(0.8);
  doc.line(14, y + 1.5, 90, y + 1.5);
  return y + 5;
}

function fimTabela(doc: jsPDF, fallback: number): number {
  const d = doc as jsPDF & { lastAutoTable?: { finalY?: number } };
  return (d.lastAutoTable?.finalY ?? fallback) + 8;
}

function tabela(doc: jsPDF, y: number, head: string[], body: (string | number)[][]): number {
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 8 },
    headStyles: { fillColor: ESCURO, textColor: AMARELO },
    head: [head],
    body: body.map((linha) => linha.map(String)),
  });
  return fimTabela(doc, y);
}

function ressalva(doc: jsPDF, y: number) {
  const pw = doc.internal.pageSize.getWidth();
  if (y > 270) { doc.addPage(); y = 20; }
  doc.setFontSize(7).setTextColor(150, 150, 150);
  doc.text(
    "Estudo preliminar de viabilidade calculado por fórmulas determinísticas. Não substitui projeto urbanístico aprovado, orçamento executivo de engenharia, análise contratual ou registro do loteamento.",
    14, Math.max(y + 6, 285), { maxWidth: pw - 28 }
  );
}

function pctStr(v: number, casas = 1) {
  return `${(v * 100).toFixed(casas)}%`;
}

function m2Str(v: number) {
  return `${Math.round(v).toLocaleString("pt-BR")} m²`;
}

/** Agrega o fluxo mensal em recebimentos por ano (bruto, incorporador, terreneiro). */
export function recebimentosPorAno(r: ResultadoLoteamento) {
  const anos: { ano: number; bruto: number; voce: number; terreneiro: number }[] = [];
  for (const f of r.fluxo) {
    const ano = Math.floor(f.mes / 12);
    if (!anos[ano]) anos[ano] = { ano: ano + 1, bruto: 0, voce: 0, terreneiro: 0 };
    anos[ano].bruto += f.receitaBruta;
    anos[ano].voce += f.receitaVoce;
    anos[ano].terreneiro += f.receitaTerreneiro;
  }
  return anos.filter((a) => a && (a.bruto > 0.005));
}

function linhasComparativas(c: CenariosLoteamento): (string | number)[][] {
  const col = (r: ResultadoLoteamento) => r;
  const cs = [col(c.conservador), col(c.ideal), col(c.agressivo)];
  const linha = (label: string, f: (r: ResultadoLoteamento) => string) =>
    [label, ...cs.map(f)] as (string | number)[];
  return [
    linha("VGV bruto", (r) => formatCurrency(r.vgvGross)),
    linha("VPL", (r) => formatCurrency(r.vpl)),
    linha("TIR (a.a.)", (r) => (r.tirAnual != null ? pctStr(r.tirAnual, 2) : "—")),
    linha("ROI", (r) => pctStr(r.roi)),
    linha("Margem líquida", (r) => pctStr(r.margemLiquida)),
    linha("Payback", (r) => (r.paybackMes != null ? `${r.paybackMes} meses` : "não recupera")),
    linha("Exposição máxima", (r) => formatCurrency(r.exposicaoMaxima)),
    linha("Mês do pico", (r) => `mês ${r.mesPico}`),
    linha("Custo total", (r) => formatCurrency(r.custoTotal)),
    linha("Recebível (incorporador)", (r) => formatCurrency(r.recebiveis.voce)),
  ];
}

/** Relatório Executivo: urbanístico + comparação de cenários + indicadores do ideal. */
export function gerarRelatorioExecutivo(meta: MetaRelatorio, c: CenariosLoteamento) {
  const doc = new jsPDF();
  const r = c.ideal;
  const urb = r.urbanistico;
  let y = cabecalho(doc, "Relatório Executivo", meta);

  y = titulo(doc, "1. ESTUDO URBANÍSTICO", y);
  y = tabela(doc, y,
    ["Área bruta", "Área vendável", "Aproveitamento", "Total de lotes", "Preço médio/lote"],
    [[m2Str(urb.areaBrutaM2), m2Str(urb.areaVendavelM2), pctStr(urb.taxaAproveitamento), urb.totalLotes.toLocaleString("pt-BR"), formatCurrency(r.precoLote)]]
  );
  y = tabela(doc, y,
    ["Dedução", "Área"],
    [
      ["Área pública", m2Str(urb.areaPublicaM2)],
      ["Área verde", m2Str(urb.areaVerdeM2)],
      ["Sistema viário", m2Str(urb.areaViarioM2)],
      ["APP", m2Str(urb.areaAppM2)],
      ["Faixa de servidão", m2Str(urb.areaServidaoM2)],
    ]
  );

  y = titulo(doc, "2. COMPARAÇÃO DE CENÁRIOS", y);
  y = tabela(doc, y, ["Métrica", "Conservador (−10%)", "Ideal", "Agressivo (+10%)"], linhasComparativas(c));

  y = titulo(doc, "3. INDICADORES — CENÁRIO IDEAL", y);
  y = tabela(doc, y,
    ["Indicador", "Valor", "Indicador", "Valor"],
    [
      ["VGV bruto", formatCurrency(r.vgvGross), "VPL", formatCurrency(r.vpl)],
      ["VGV líquido", formatCurrency(r.vgvNet), "TIR", r.tirAnual != null ? `${pctStr(r.tirAnual, 2)} a.a.` : "—"],
      ["Custo total", formatCurrency(r.custoTotal), "ROI", pctStr(r.roi)],
      ["Exposição máx. de caixa", formatCurrency(r.exposicaoMaxima), "Margem líquida", pctStr(r.margemLiquida)],
      ["Mês do pico", `mês ${r.mesPico}`, "Payback", r.paybackMes != null ? `${r.paybackMes} meses` : "não recupera"],
      ["Break-even", `${r.breakEven.lotesNecessarios.toLocaleString("pt-BR")} lotes`, "Taxa de desconto", `${meta.taxaDescontoAnual}% a.a.`],
    ]
  );

  y = titulo(doc, "4. DISTRIBUIÇÃO DE RECEBÍVEIS (PERMUTA)", y);
  y = tabela(doc, y,
    ["Parte", "Percentual", "Valor"],
    [
      ["Incorporador", `${(100 - meta.permutaPct).toFixed(0)}%`, formatCurrency(r.recebiveis.voce)],
      ["Terreneiro", `${meta.permutaPct.toFixed(0)}%`, formatCurrency(r.recebiveis.terreneiro)],
      ["Total a receber", "100%", formatCurrency(r.recebiveis.total)],
    ]
  );

  ressalva(doc, y);
  doc.save(`relatorio-executivo-${meta.nome.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}

/** Relatório de Custos: breakdown pré-venda × durante-venda do cenário ideal. */
export function gerarRelatorioCustos(
  meta: MetaRelatorio,
  c: CenariosLoteamento,
  extras: { projetosLicencas: number; marketing: number; registroPorLote: number; contingenciaPct: number; bdiPct: number; comissaoPct: number; despesasPct: number; impostosPct: number }
) {
  const doc = new jsPDF();
  const r = c.ideal;
  let y = cabecalho(doc, "Relatório de Custos", meta);

  const registroTotal = extras.registroPorLote * r.urbanistico.totalLotes;
  const infraSemBdi = r.custoInfra / (1 + extras.bdiPct / 100);
  const bdi = r.custoInfra - infraSemBdi;
  const contingencia = infraSemBdi * (extras.contingenciaPct / 100);
  const comissao = r.vgvGross * (extras.comissaoPct / 100);
  const despesas = r.vgvGross * (extras.despesasPct / 100);
  const impostos = r.vgvGross * (extras.impostosPct / 100);

  y = titulo(doc, "1. CUSTOS PRÉ-VENDA (EXIGEM CAPITAL PRÓPRIO)", y);
  y = tabela(doc, y,
    ["Item", "Valor"],
    [
      ["Infraestrutura (base)", formatCurrency(infraSemBdi)],
      [`BDI (${extras.bdiPct}%)`, formatCurrency(bdi)],
      [`Contingência (${extras.contingenciaPct}% da infra)`, formatCurrency(contingencia)],
      ["Projetos e licenças", formatCurrency(extras.projetosLicencas)],
      ["Marketing e lançamento", formatCurrency(extras.marketing)],
      [`Registro do loteamento (${r.urbanistico.totalLotes.toLocaleString("pt-BR")} lotes × ${formatCurrency(extras.registroPorLote)})`, formatCurrency(registroTotal)],
      ["Subtotal pré-venda", formatCurrency(r.custosPreVenda)],
    ]
  );

  y = titulo(doc, "2. CUSTOS DURANTE VENDAS (PAGOS COM RECEITA)", y);
  y = tabela(doc, y,
    ["Item", "Valor"],
    [
      [`Comissões de venda (${extras.comissaoPct}% VGV)`, formatCurrency(comissao)],
      [`Despesas gerais (${extras.despesasPct}% VGV)`, formatCurrency(despesas)],
      [`Impostos (${extras.impostosPct}% VGV)`, formatCurrency(impostos)],
      ["Subtotal durante vendas", formatCurrency(r.custosDuranteVenda)],
    ]
  );

  y = titulo(doc, "3. TOTAL GERAL", y);
  y = tabela(doc, y,
    ["Total geral dos custos", "Capital necessário (exposição máx.)", "Mês do pico"],
    [[formatCurrency(r.custoTotal), formatCurrency(r.exposicaoMaxima), `mês ${r.mesPico}`]]
  );

  ressalva(doc, y);
  doc.save(`relatorio-custos-${meta.nome.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}

/** Relatório do Terreneiro: permuta e recebimentos ano a ano da parte dele. */
export function gerarRelatorioTerreneiro(meta: MetaRelatorio, c: CenariosLoteamento) {
  const doc = new jsPDF();
  const r = c.ideal;
  let y = cabecalho(doc, "Relatório do Terreneiro", meta);

  y = titulo(doc, "1. CONDIÇÕES DA PERMUTA", y);
  y = tabela(doc, y,
    ["Modalidade", "Participação", "Total estimado a receber"],
    [["Permuta financeira (% do VGV)", `${meta.permutaPct.toFixed(0)}% dos recebimentos`, formatCurrency(r.recebiveis.terreneiro)]]
  );

  y = titulo(doc, "2. RECEBIMENTOS PROJETADOS POR ANO", y);
  const anos = recebimentosPorAno(r);
  y = tabela(doc, y,
    ["Ano", "Recebido total (bruto)", "Parte do terreneiro"],
    anos.map((a) => [`Ano ${a.ano}`, formatCurrency(a.bruto), formatCurrency(a.terreneiro)])
  );
  y = tabela(doc, y,
    ["Total geral", "Parte do terreneiro"],
    [[formatCurrency(r.recebiveis.total), formatCurrency(r.recebiveis.terreneiro)]]
  );

  doc.setFontSize(8).setTextColor(60, 60, 60);
  if (y > 265) { doc.addPage(); y = 20; }
  doc.text(
    "Valores brutos projetados conforme a curva de vendas e o parcelamento indexado do estudo. O fluxo contratual efetivo depende do instrumento de permuta firmado entre as partes.",
    14, y + 2, { maxWidth: doc.internal.pageSize.getWidth() - 28 }
  );

  ressalva(doc, y);
  doc.save(`relatorio-terreneiro-${meta.nome.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}
