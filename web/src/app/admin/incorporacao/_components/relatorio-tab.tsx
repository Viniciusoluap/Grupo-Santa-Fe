"use client";

import { useState } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "@/lib/utils";
import {
  montarRelatorioExecutivo,
  temDado,
  type RelatorioExecutivoModel,
  type Secao,
  type DadoTerreno,
  type DadoCadastral,
  type DadoMercado,
  type DadoMassa,
  type DadoQuadroAreas,
  type DadoMixProdutos,
  type DadoCustosReceitasVgv,
  type DadoIndicadoresFinanceiros,
  type DadoImpostosComissoesPermutas,
  type DadoNegociacao,
  type DadoDocumentosLicencas,
  type DadoCronograma,
  type DadoPremissasFontesVersao,
} from "@/lib/incorporacao/relatorio-executivo";
import type { EstudoData } from "./incorporacao-detail";

// Relatório Executivo de Incorporação (Lote 6 do hardening): consolida os 13
// temas pedidos — terreno/mapas/APP/restrições, dados cadastrais/urbanísticos,
// mercado/referências, estudo de massa/cenários, quadro de áreas, mix de
// produtos, custos/receitas/VGV, VPL/TIR/ROI/payback/fluxo de caixa,
// impostos/comissões/permutas, negociações/proposta aceita,
// documentos/licenças/pendências, cronograma/tarefas/responsáveis/riscos e
// premissas/fontes/data/versão — a partir do modelo puro e testável
// montarRelatorioExecutivo(). Gerado 100% no navegador via jsPDF + autotable.
//
// Regra central (Lote 6): toda seção sem dado aparece no PDF com uma linha de
// pendência explícita — nunca é omitida silenciosamente.

const SECOES_CHECKLIST: { label: string; chave: keyof RelatorioExecutivoModel }[] = [
  { label: "Terreno / mapas / APP / restrições", chave: "terreno" },
  { label: "Dados cadastrais / urbanísticos", chave: "dadosCadastrais" },
  { label: "Mercado / referências", chave: "mercado" },
  { label: "Estudo de massa / cenários", chave: "massa" },
  { label: "Quadro de áreas", chave: "quadroAreas" },
  { label: "Mix de produtos", chave: "mixProdutos" },
  { label: "Custos / receitas / VGV", chave: "custosReceitasVgv" },
  { label: "VPL / TIR / ROI / payback / fluxo de caixa", chave: "indicadoresFinanceiros" },
  { label: "Impostos / comissões / permutas", chave: "impostosComissoesPermutas" },
  { label: "Negociações / proposta aceita", chave: "negociacao" },
  { label: "Documentos / licenças / pendências", chave: "documentosLicencas" },
  { label: "Cronograma / tarefas / responsáveis / riscos", chave: "cronograma" },
  { label: "Parecer de viabilidade (IA)", chave: "parecerIa" },
];

export function RelatorioTab({ estudo }: { estudo: EstudoData }) {
  const [busy, setBusy] = useState(false);
  const modelo = montarRelatorioExecutivo(estudo);

  function gerarPdf() {
    setBusy(true);
    try {
      const geradoEm = new Date();
      const m = montarRelatorioExecutivo(estudo, geradoEm);
      const doc = new jsPDF();
      const pw = doc.internal.pageSize.getWidth();

      doc.setFillColor(26, 26, 26);
      doc.rect(0, 0, pw, 34, "F");
      doc.setTextColor(245, 196, 0).setFontSize(16).setFont("helvetica", "bold");
      doc.text("RELATÓRIO EXECUTIVO DE INCORPORAÇÃO", 14, 16);
      doc.setTextColor(255, 255, 255).setFontSize(9).setFont("helvetica", "normal");
      doc.text("Grupo Santa Fé — metodologia Carolina Caribé · estudo de massa generativo", 14, 23);
      doc.text(geradoEm.toLocaleString("pt-BR"), 14, 29);

      let y = 44;
      doc.setTextColor(26, 26, 26).setFontSize(14).setFont("helvetica", "bold");
      doc.text(m.nome, 14, y);
      doc.setFontSize(10).setFont("helvetica", "normal").setTextColor(90, 90, 90);
      doc.text(`${m.municipio}/${m.estado}`, 14, y + 6);
      y += 14;

      y = secaoTerreno(doc, y, m.terreno);
      y = secaoDadosCadastrais(doc, y, m.dadosCadastrais);
      y = secaoMercado(doc, y, m.mercado);
      y = secaoMassa(doc, y, m.massa);
      y = secaoQuadroAreas(doc, y, m.quadroAreas);
      y = secaoMix(doc, y, m.mixProdutos);
      y = secaoCustosVgv(doc, y, m.custosReceitasVgv);
      y = secaoIndicadores(doc, y, m.indicadoresFinanceiros);
      y = secaoImpostos(doc, y, m.impostosComissoesPermutas);
      y = secaoNegociacao(doc, y, m.negociacao);
      y = secaoDocumentosLicencas(doc, y, m.documentosLicencas);
      y = secaoCronograma(doc, y, m.cronograma);
      y = secaoPremissasFontesVersao(doc, y, m.premissasFontesVersao);
      y = secaoParecer(doc, y, m.parecerIa);

      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFontSize(7).setTextColor(150, 150, 150);
      doc.text(
        "Estudo preliminar de viabilidade e aproveitamento. Não substitui projeto urbanístico/engenharia aprovado, levantamento topográfico oficial, matrícula ou aprovação municipal.",
        14, Math.max(y + 6, 285), { maxWidth: pw - 28 }
      );

      doc.save(`relatorio-executivo-${estudo.nome.replace(/\s+/g, "-").toLowerCase()}.pdf`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 p-6">
        <div className="text-center mb-5">
          <FileText size={28} className="text-gray-500 mx-auto mb-3" />
          <p className="font-bold text-[var(--brand-dark)]">Relatório executivo de incorporação</p>
          <p className="text-gray-600 text-sm mt-1">
            Consolida terreno, mercado, massa, quadro de áreas, mix, custos/VGV, indicadores financeiros,
            impostos/comissões/permutas, negociação, documentos/licenças, cronograma e premissas em um único PDF.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
          {SECOES_CHECKLIST.map((s) => {
            const ok = temDado(modelo[s.chave] as Secao<unknown>);
            return (
              <div key={s.chave} className={`text-xs px-3 py-2 border ${ok ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                {ok ? "✓" : "○"} {s.label}
              </div>
            );
          })}
        </div>

        <div className="text-center">
          <button onClick={gerarPdf} disabled={busy}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-5 py-2.5 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Baixar relatório completo (PDF)
          </button>
          <p className="text-[10px] text-gray-600 mt-2">
            Seções sem dados aparecem no PDF como pendência explícita — nunca são omitidas.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers de layout (mesmo padrão visual de src/lib/pdf/loteamento.ts) ───

function titulo(doc: jsPDF, txt: string, y: number): number {
  if (y > 258) { doc.addPage(); y = 20; }
  doc.setFontSize(11).setFont("helvetica", "bold").setTextColor(26, 26, 26);
  doc.text(txt, 14, y);
  doc.setDrawColor(245, 196, 0).setLineWidth(0.8);
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
    headStyles: { fillColor: [26, 26, 26], textColor: [245, 196, 0] },
    head: [head],
    body: body.map((linha) => linha.map(String)),
  });
  return fimTabela(doc, y);
}

/** Linha de pendência explícita — nunca omite a seção, só avisa o que falta. */
function pendenciaLinha(doc: jsPDF, y: number, msg: string): number {
  const pw = doc.internal.pageSize.getWidth();
  if (y > 270) { doc.addPage(); y = 20; }
  doc.setFontSize(8).setFont("helvetica", "italic").setTextColor(170, 110, 0);
  const linhas = doc.splitTextToSize(`Pendência: ${msg}`, pw - 28);
  doc.text(linhas, 14, y);
  return y + linhas.length * 4 + 6;
}

function paragrafo(doc: jsPDF, y: number, texto: string): number {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFontSize(8).setFont("helvetica", "normal").setTextColor(60, 60, 60);
  const linhas = doc.splitTextToSize(texto, pw - 28);
  for (const l of linhas) {
    if (y > 278) { doc.addPage(); y = 20; }
    doc.text(l, 14, y);
    y += 4.2;
  }
  return y + 3;
}

function pctStr(v: number, casas = 1): string {
  return `${(v * 100).toFixed(casas)}%`;
}

function m2Str(v: number): string {
  return `${Math.round(v).toLocaleString("pt-BR")} m²`;
}

/** Renderiza o conteúdo de uma seção OU, se não houver dado, uma pendência explícita. */
function renderSecao<T>(doc: jsPDF, y: number, titulo_: string, secao: Secao<T>, render: (doc: jsPDF, y: number, dado: T) => number): number {
  y = titulo(doc, titulo_, y);
  if (temDado(secao)) return render(doc, y, secao.dado);
  return pendenciaLinha(doc, y, secao.pendencia);
}

// ─── 1. Terreno ──────────────────────────────────────────────────────────

function secaoTerreno(doc: jsPDF, y: number, secao: Secao<DadoTerreno>): number {
  return renderSecao(doc, y, "1. TERRENO / MAPAS / APP / RESTRIÇÕES", secao, (doc, y, d) => {
    y = tabela(doc, y,
      ["Área", "Perímetro", "Centro", "APP (automática)"],
      [[
        `${d.areaM2.toLocaleString("pt-BR")} m² (${(d.areaM2 / 10000).toFixed(2)} ha)`,
        `${d.perimetroM.toLocaleString("pt-BR")} m`,
        d.centroLat && d.centroLng ? `${d.centroLat.toFixed(5)}, ${d.centroLng.toFixed(5)}` : "—",
        d.appAreaM2 ? `${Math.round(d.appAreaM2).toLocaleString("pt-BR")} m² (${d.appOrigem ?? "—"})` : "—",
      ]]
    );
    if (d.appPendencia) y = pendenciaLinha(doc, y, d.appPendencia);
    return y;
  });
}

// ─── 2. Dados cadastrais / urbanísticos ────────────────────────────────────

function secaoDadosCadastrais(doc: jsPDF, y: number, secao: Secao<DadoCadastral>): number {
  return renderSecao(doc, y, "2. DADOS CADASTRAIS / URBANÍSTICOS", secao, (doc, y, d) => {
    const entradas: (string | number)[][] = [];
    for (const [k, v] of Object.entries(d.parametros ?? {})) entradas.push([k, formatarValorGenerico(v)]);
    for (const [k, v] of Object.entries(d.potencial ?? {})) entradas.push([k, formatarValorGenerico(v)]);
    if (entradas.length > 0) y = tabela(doc, y, ["Parâmetro", "Valor"], entradas);
    const cadastro = [
      ["Matrícula", d.matriculaImovel], ["CAR", d.carRegistro],
      ["Zoneamento oficial", d.zoneamentoOficial], ["Fonte do zoneamento", d.zoneamentoFonte],
    ].filter((row): row is string[] => !!row[1]);
    if (cadastro.length) y = tabela(doc, y, ["Dado cadastral", "Valor informado"], cadastro);
    if (d.parecerUrbanistico) y = paragrafo(doc, y, d.parecerUrbanistico);
    if (d.matriculaPendencia) y = pendenciaLinha(doc, y, d.matriculaPendencia);
    if (d.carPendencia) y = pendenciaLinha(doc, y, d.carPendencia);
    if (d.zoneamentoOficialPendencia) y = pendenciaLinha(doc, y, d.zoneamentoOficialPendencia);
    return y;
  });
}

function formatarValorGenerico(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") return v.toLocaleString("pt-BR");
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

// ─── 3. Mercado / referências ──────────────────────────────────────────────

function secaoMercado(doc: jsPDF, y: number, secao: Secao<DadoMercado>): number {
  return renderSecao(doc, y, "3. MERCADO / REFERÊNCIAS", secao, (doc, y, d) => {
    if (d.cidade?.resumo) y = paragrafo(doc, y, d.cidade.resumo);
    y = tabela(doc, y,
      ["População", "Renda média", "m² Lote", "m² Casa", "m² Apto"],
      [[
        d.cidade?.populacao ? d.cidade.populacao.toLocaleString("pt-BR") : "—",
        d.cidade?.rendaMediaMensal ? formatCurrency(d.cidade.rendaMediaMensal) : "—",
        d.mercado?.precoM2Lote ? formatCurrency(d.mercado.precoM2Lote) : "—",
        d.mercado?.precoM2Casa ? formatCurrency(d.mercado.precoM2Casa) : "—",
        d.mercado?.precoM2Apartamento ? formatCurrency(d.mercado.precoM2Apartamento) : "—",
      ]]
    );
    if (d.precificacaoComparaveis) {
      const c = d.precificacaoComparaveis;
      y = tabela(doc, y,
        ["Nota ponderada (novo)", "Nota ponderada (comparáveis)", "Preço médio comparáveis", "Preço sugerido/m²"],
        [[c.notaPonderadaNovo, c.notaPonderadaMediaComparaveis, formatCurrency(c.precoMedioComparaveis), formatCurrency(c.precoSugeridoM2)]]
      );
      if (c.comparaveisIncompletos.length > 0) {
        y = pendenciaLinha(doc, y, `Comparáveis incompletos (sem nota ou preço): ${c.comparaveisIncompletos.join(", ")}.`);
      }
    }
    if (d.pesquisaPrimaria) {
      const p = d.pesquisaPrimaria;
      y = tabela(doc, y,
        ["Entrevistados", "Interesse em comprar (12m)", "Já tem imóvel próprio", "Tamanho ideal médio"],
        [[p.totalEntrevistados, pctStr(p.pctInteresseComprar12Meses / 100), pctStr(p.pctComImovelProprio / 100), m2Str(p.tamanhoIdealMedioM2)]]
      );
    }
    if (d.fontes) y = paragrafo(doc, y, `Fontes da pesquisa de mercado: ${d.fontes.join("; ")}. Confiabilidade: ${d.confiabilidade || "não informada"}.`);
    if (d.fontesPendencia) y = pendenciaLinha(doc, y, d.fontesPendencia);
    return y;
  });
}

// ─── 4. Estudo de massa / cenários ──────────────────────────────────────────

function secaoMassa(doc: jsPDF, y: number, secao: Secao<DadoMassa>): number {
  return renderSecao(doc, y, "4. ESTUDO DE MASSA / CENÁRIOS", secao, (doc, y, d) => {
    const c = d.cenario;
    y = tabela(doc, y,
      ["Lotes vendáveis", "Área vendável", "Aproveitamento", "VGV do cenário", "Lote típico", "Via"],
      [[
        c.kpis.lotesVendaveis,
        m2Str(c.kpis.areaVendavelM2),
        pctStr(c.kpis.aproveitamento),
        formatCurrency(c.kpis.vgv),
        `${c.testadaLoteM}×${c.profundidadeLoteM} m`,
        `${c.larguraViaM} m`,
      ]]
    );
    return paragrafo(doc, y, `Cenário escolhido entre ${d.totalCenarios} cenário(s) gerado(s) para este estudo.`);
  });
}

// ─── 5. Quadro de áreas ──────────────────────────────────────────────────────

function secaoQuadroAreas(doc: jsPDF, y: number, secao: Secao<DadoQuadroAreas>): number {
  return renderSecao(doc, y, "5. QUADRO DE ÁREAS (NBR 12721)", secao, (doc, y, d) => {
    y = tabela(doc, y,
      ["Pavimento", "Área const. coberta", "Área const. descoberta", "Área computável", "Área privativa"],
      d.itens.map((it) => [it.pavimento, m2Str(it.areaConstCobertaM2), m2Str(it.areaConstDescobertaM2), m2Str(it.areaComputavelM2), m2Str(it.areaPrivativaM2)])
    );
    const r = d.resultado;
    y = tabela(doc, y,
      ["ACT total", "APV total", "Área computável máx.", "Aproveitamento", "Excede coeficiente?"],
      [[m2Str(r.areaConstTotalM2), m2Str(r.areaPrivativaTotalM2), m2Str(r.areaComputavelMaximaM2), pctStr(r.aproveitamentoPct), r.excedeCoeficiente ? "Sim" : "Não"]]
    );
    return y;
  });
}

// ─── 6. Mix de produtos ──────────────────────────────────────────────────────

function secaoMix(doc: jsPDF, y: number, secao: Secao<DadoMixProdutos>): number {
  return renderSecao(doc, y, "6. MIX DE PRODUTOS", secao, (doc, y, d) => {
    const mix = d.mix;
    y = tabela(doc, y,
      ["Produto", "Quantidade", "Área/unidade", "Preço/m²", "VGV do produto"],
      mix.itens.map((i) => [i.nome, i.quantidade.toLocaleString("pt-BR"), m2Str(i.areaUnidadeM2), formatCurrency(i.precoM2), formatCurrency(i.vgv)])
    );
    return tabela(doc, y,
      ["Total de unidades", "Área vendida", "VGV do mix", "Preço médio/unidade"],
      [[mix.totalUnidades.toLocaleString("pt-BR"), m2Str(mix.areaVendidaM2), formatCurrency(mix.vgv), formatCurrency(mix.precoMedioUnidade)]]
    );
  });
}

// ─── 7. Custos / receitas / VGV ──────────────────────────────────────────────

function secaoCustosVgv(doc: jsPDF, y: number, secao: Secao<DadoCustosReceitasVgv>): number {
  return renderSecao(doc, y, "7. CUSTOS / RECEITAS / VGV", secao, (doc, y, d) => {
    if (d.modo === "motor_atual") {
      y = tabela(doc, y,
        ["VGV bruto", "VGV líquido", "Custo infra", "Custo total (hoje)", "Custo total nominal (c/ INCC)"],
        [[formatCurrency(d.vgvGross), formatCurrency(d.vgvNet), formatCurrency(d.custoInfra), formatCurrency(d.custoTotal), formatCurrency(d.custoTotalNominal)]]
      );
      return tabela(doc, y,
        ["Custos pré-venda", "Custos durante venda", "Taxa adm. obra", "Manutenção", "Taxa incorporação"],
        [[formatCurrency(d.custosPreVenda), formatCurrency(d.custosDuranteVenda), formatCurrency(d.custosDetalhados.taxaAdministracaoObra), formatCurrency(d.custosDetalhados.manutencao), formatCurrency(d.custosDetalhados.taxaIncorporacao)]]
      );
    }
    y = paragrafo(doc, y, "Estudo no formato legado (EVE) — detalhamento equivalente ao do motor atual não disponível.");
    return tabela(doc, y,
      ["VGV", "Custo do terreno", "Custo total", "Lucro bruto"],
      [[formatCurrency(d.vgv), formatCurrency(d.custoTerreno), formatCurrency(d.custoTotal), formatCurrency(d.lucroBruto)]]
    );
  });
}

// ─── 8. VPL / TIR / ROI / payback / fluxo de caixa ──────────────────────────

function secaoIndicadores(doc: jsPDF, y: number, secao: Secao<DadoIndicadoresFinanceiros>): number {
  return renderSecao(doc, y, "8. VPL / TIR / ROI / PAYBACK / FLUXO DE CAIXA", secao, (doc, y, d) => {
    if (d.modo === "motor_atual") {
      y = tabela(doc, y,
        ["VPL", "TIR (a.a.)", "ROI", "Margem líquida", "Payback", "Exposição máx."],
        [[
          formatCurrency(d.vpl),
          d.tirAnual != null ? pctStr(d.tirAnual, 2) : "—",
          pctStr(d.roi),
          pctStr(d.margemLiquida),
          d.paybackMes != null ? `${d.paybackMes} meses` : "não recupera",
          formatCurrency(d.exposicaoMaxima),
        ]]
      );
    } else {
      y = tabela(doc, y,
        ["VPL", "TIR (a.m.)", "Margem líquida", "Payback", "Exposição máx."],
        [[
          formatCurrency(d.vpl),
          d.tirMensal != null ? pctStr(d.tirMensal, 2) : "—",
          pctStr(d.margemLiquida),
          d.paybackMes != null ? `${d.paybackMes} meses` : "não recupera",
          formatCurrency(d.exposicaoMaxima),
        ]]
      );
    }
    if (d.fluxo.length === 0) return pendenciaLinha(doc, y, "Fluxo de caixa mês a mês não disponível para este estudo.");
    y = titulo(doc, "Fluxo de caixa mês a mês", y);
    return tabela(doc, y,
      ["Mês", "Receita bruta", "Custo do mês", "Saldo do mês", "Saldo acumulado"],
      d.fluxo.map((f) => [f.mes, formatCurrency(f.receitaBruta), formatCurrency(f.custoTotalMes), formatCurrency(f.saldoMes), formatCurrency(f.saldoAcumulado)])
    );
  });
}

// ─── 9. Impostos / comissões / permutas ─────────────────────────────────────

function secaoImpostos(doc: jsPDF, y: number, secao: Secao<DadoImpostosComissoesPermutas>): number {
  return renderSecao(doc, y, "9. IMPOSTOS / COMISSÕES / PERMUTAS", secao, (doc, y, d) => {
    y = tabela(doc, y,
      ["Comissão (% VGV)", "Despesas gerais (% VGV)", "Impostos (% VGV)", "Permuta terreneiro (% VGV)"],
      [[pctStr(d.comissaoPct), pctStr(d.despesasGeraisPct), pctStr(d.impostosPct), pctStr(d.permutaPct)]]
    );
    y = tabela(doc, y,
      ["Comissão (R$)", "Despesas gerais (R$)", "Impostos (R$)", "Permuta terreneiro (R$)"],
      [[formatCurrency(d.comissaoValor), formatCurrency(d.despesasGeraisValor), formatCurrency(d.impostosValor), formatCurrency(d.permutaValorTerreneiro)]]
    );
    return paragrafo(doc, y, d.observacao);
  });
}

// ─── 10. Negociações / proposta aceita ──────────────────────────────────────

function secaoNegociacao(doc: jsPDF, y: number, secao: Secao<DadoNegociacao>): number {
  return renderSecao(doc, y, "10. NEGOCIAÇÕES / PROPOSTA ACEITA", secao, (doc, y, d) => {
    const r = d.resumo;
    const p = r.propostaAtual;
    return tabela(doc, y,
      ["Proprietário", "Total de propostas", "Negociação fechada?", "Proposta atual", "Valor estimado"],
      [[
        d.proprietarioNome,
        r.totalPropostas,
        r.fechada ? "Sim" : "Não",
        p ? `${p.tipo} (${p.status})` : "—",
        formatCurrency(r.valorEstimadoAtual),
      ]]
    );
  });
}

// ─── 11. Documentos / licenças / pendências ─────────────────────────────────

function secaoDocumentosLicencas(doc: jsPDF, y: number, secao: Secao<DadoDocumentosLicencas>): number {
  return renderSecao(doc, y, "11. DOCUMENTOS / LICENÇAS / PENDÊNCIAS", secao, (doc, y, d) => {
    if (d.aprovacaoProjeto) {
      const a = d.aprovacaoProjeto;
      y = tabela(doc, y,
        ["Processos de aprovação", "Protocolados", "Aprovados", "% aprovado", "Com exigência", "Atrasados"],
        [[a.total, a.protocolados, a.aprovados, pctStr(a.pctAprovado / 100), a.comExigencia.length, a.atrasados.length]]
      );
    } else {
      y = pendenciaLinha(doc, y, "Aprovação do projeto (licenças/órgãos) ainda não cadastrada nesta aba.");
    }
    if (d.registroIncorporacao) {
      const r = d.registroIncorporacao;
      y = tabela(doc, y,
        ["Documentos do registro", "Obtidos", "Em providência", "% obtido"],
        [[r.total, r.obtidos, r.emProvidencia, pctStr(r.pctObtido / 100)]]
      );
      if (r.pendentes.length > 0) {
        y = pendenciaLinha(doc, y, `Documentos do registro ainda pendentes: ${r.pendentes.map((p) => p.nome).join(", ")}.`);
      }
    } else {
      y = pendenciaLinha(doc, y, "Registro da incorporação (documentos do art. 32) ainda não cadastrado nesta aba.");
    }
    return y;
  });
}

// ─── 12. Cronograma / tarefas / responsáveis / riscos ───────────────────────

function secaoCronograma(doc: jsPDF, y: number, secao: Secao<DadoCronograma>): number {
  return renderSecao(doc, y, "12. CRONOGRAMA / TAREFAS / RESPONSÁVEIS / RISCOS", secao, (doc, y, d) => {
    if (d.cronogramaObra) {
      const c = d.cronogramaObra;
      y = tabela(doc, y,
        ["Avanço físico atual", "Avanço financeiro projetado", "Desvio", "Obra concluída?"],
        [[
          pctStr(c.avancoFisicoAtualPct / 100),
          c.avancoFinanceiroProjetadoAtualPct != null ? pctStr(c.avancoFinanceiroProjetadoAtualPct / 100) : "—",
          c.desvioAtualPct != null ? pctStr(c.desvioAtualPct / 100) : "—",
          c.obraConcluida ? "Sim" : "Não",
        ]]
      );
    } else {
      y = pendenciaLinha(doc, y, "Cronograma físico-financeiro da obra (curva S) ainda não cadastrado nesta aba.");
    }
    if (d.planejamentoLancamento) {
      const p = d.planejamentoLancamento;
      y = tabela(doc, y,
        ["Marcos do lançamento", "Concluídos", "% concluído", "Atrasados"],
        [[p.total, p.concluidos, pctStr(p.pctConcluido / 100), p.atrasados.length]]
      );
    } else {
      y = pendenciaLinha(doc, y, "Planejamento do lançamento (marcos) ainda não cadastrado nesta aba.");
    }
    y = paragrafo(doc, y, `Responsável do estudo (contexto geral, não por tarefa): ${d.responsavelDoEstudo ?? "não definido"}.`);
    if (d.responsaveisPorTarefa.length) y = tabela(doc, y, ["Tarefa", "Responsável"], d.responsaveisPorTarefa.map((t) => [t.tarefa, t.responsavel]));
    if (d.riscosExecucao.length) y = tabela(doc, y, ["Risco de execução", "Impacto", "Mitigação", "Responsável", "Status"],
      d.riscosExecucao.map((r) => [r.descricao, r.impacto, r.mitigacao, r.responsavel, r.status]));
    if (d.responsavelPorTarefaPendencia) y = pendenciaLinha(doc, y, d.responsavelPorTarefaPendencia);
    if (d.riscosExecucaoPendencia) y = pendenciaLinha(doc, y, d.riscosExecucaoPendencia);
    return y;
  });
}

// ─── 13. Premissas / fontes / data / versão ─────────────────────────────────

function secaoPremissasFontesVersao(doc: jsPDF, y: number, d: DadoPremissasFontesVersao): number {
  y = titulo(doc, "13. PREMISSAS / FONTES / DATA / VERSÃO", y);
  y = paragrafo(doc, y, `Data e hora de geração deste PDF: ${new Date(d.geradoEm).toLocaleString("pt-BR")}.`);
  if (temDado(d.premissasNumericas)) {
    y = tabela(doc, y, ["Premissa", "Valor"], d.premissasNumericas.dado.map((p) => [p.label, p.valor]));
  } else {
    y = pendenciaLinha(doc, y, d.premissasNumericas.pendencia);
  }
  if (temDado(d.versao)) y = paragrafo(doc, y, d.versao.dado);
  else y = pendenciaLinha(doc, y, d.versao.pendencia);
  if (temDado(d.fontesPesquisaMercado)) y = paragrafo(doc, y, `Fontes da pesquisa de mercado: ${d.fontesPesquisaMercado.dado}.`);
  else y = pendenciaLinha(doc, y, d.fontesPesquisaMercado.pendencia);
  return y;
}

// ─── Parecer de viabilidade (IA) ─────────────────────────────────────────────

function secaoParecer(doc: jsPDF, y: number, secao: Secao<string>): number {
  return renderSecao(doc, y, "PARECER DE VIABILIDADE (IA)", secao, (doc, y, texto) => paragrafo(doc, y, texto));
}
