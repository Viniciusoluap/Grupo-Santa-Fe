"use client";

import { useState } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "@/lib/utils";
import { calcularLoteamento } from "@/lib/finance/loteamento";
import { montarPremissasLoteamento } from "./viabilidade-tab";
import type { EstudoData } from "./incorporacao-detail";

// Laudo executivo consolidado: terreno, cidade & mercado, estudo de massa
// (cenário escolhido) e viabilidade completa (motor determinístico).

export function RelatorioTab({ estudo }: { estudo: EstudoData }) {
  const [busy, setBusy] = useState(false);

  // Viabilidade: prioriza o motor determinístico atual (aba Viabilidade); usa o
  // EVE antigo (viabilidadeJson) só como fallback para estudos legados.
  const premissas = montarPremissasLoteamento(estudo);
  const r = premissas ? calcularLoteamento(premissas) : null;
  const viabLegado = !premissas && estudo.viabilidadeJson ? JSON.parse(estudo.viabilidadeJson) : null;
  const rLegado = viabLegado?.resultado;
  const cidade = estudo.pesquisaCidadeJson ? JSON.parse(estudo.pesquisaCidadeJson) : null;
  const mercado = estudo.estudoMercadoJson ? JSON.parse(estudo.estudoMercadoJson) : null;
  const massa = estudo.massaCenariosJson ? JSON.parse(estudo.massaCenariosJson) : null;
  const cenario = massa?.cenarios?.find(
    (c: { id: string }) => c.id === estudo.cenarioEscolhidoId
  ) ?? massa?.cenarios?.[0];

  const secoes = [
    { ok: !!estudo.geojson, label: "Terreno (KML)" },
    { ok: !!estudo.appAreaM2, label: "APP automática" },
    { ok: !!cidade, label: "Cidade & Mercado" },
    { ok: !!cenario, label: "Estudo de massa" },
    { ok: !!r || !!rLegado, label: "Viabilidade" },
    { ok: !!estudo.parecerIa, label: "Parecer IA" },
  ];

  function gerarPdf() {
    setBusy(true);
    try {
      const doc = new jsPDF();
      const pw = doc.internal.pageSize.getWidth();

      // Capa/cabeçalho
      doc.setFillColor(26, 26, 26);
      doc.rect(0, 0, pw, 34, "F");
      doc.setTextColor(245, 196, 0).setFontSize(16).setFont("helvetica", "bold");
      doc.text("ESTUDO COMPLETO DE INCORPORAÇÃO", 14, 16);
      doc.setTextColor(255, 255, 255).setFontSize(9).setFont("helvetica", "normal");
      doc.text("Grupo Santa Fé — metodologia Carolina Caribé · estudo de massa generativo", 14, 23);
      doc.text(new Date().toLocaleDateString("pt-BR"), 14, 29);

      let y = 44;
      doc.setTextColor(26, 26, 26).setFontSize(14).setFont("helvetica", "bold");
      doc.text(estudo.nome, 14, y);
      doc.setFontSize(10).setFont("helvetica", "normal").setTextColor(90, 90, 90);
      doc.text(`${estudo.municipio}/${estudo.estado}`, 14, y + 6);
      y += 14;

      // 1. Terreno
      y = titulo(doc, "1. TERRENO", y);
      autoTable(doc, {
        startY: y,
        theme: "grid",
        styles: { fontSize: 8 },
        headStyles: { fillColor: [26, 26, 26], textColor: [245, 196, 0] },
        head: [["Área", "Perímetro", "Centro", "APP (automática)"]],
        body: [[
          `${estudo.areaM2.toLocaleString("pt-BR")} m² (${(estudo.areaM2 / 10000).toFixed(2)} ha)`,
          `${estudo.perimetroM.toLocaleString("pt-BR")} m`,
          estudo.centroLat && estudo.centroLng ? `${estudo.centroLat.toFixed(5)}, ${estudo.centroLng.toFixed(5)}` : "—",
          estudo.appAreaM2 ? `${Math.round(estudo.appAreaM2).toLocaleString("pt-BR")} m²` : "—",
        ]],
      });
      y = fimTabela(doc, y);

      // 2. Cidade & Mercado
      if (cidade || mercado) {
        y = titulo(doc, "2. PESQUISA DA CIDADE & MERCADO", y);
        if (cidade?.resumo) {
          doc.setFontSize(8).setTextColor(60, 60, 60);
          const linhas = doc.splitTextToSize(cidade.resumo, pw - 28);
          doc.text(linhas, 14, y + 2);
          y += linhas.length * 4 + 4;
        }
        autoTable(doc, {
          startY: y, theme: "grid", styles: { fontSize: 8 },
          headStyles: { fillColor: [26, 26, 26], textColor: [245, 196, 0] },
          head: [["População", "Renda média", "m² Lote", "m² Casa", "m² Apto"]],
          body: [[
            cidade?.populacao ? cidade.populacao.toLocaleString("pt-BR") : "—",
            cidade?.rendaMediaMensal ? formatCurrency(cidade.rendaMediaMensal) : "—",
            mercado?.precoM2Lote ? formatCurrency(mercado.precoM2Lote) : "—",
            mercado?.precoM2Casa ? formatCurrency(mercado.precoM2Casa) : "—",
            mercado?.precoM2Apartamento ? formatCurrency(mercado.precoM2Apartamento) : "—",
          ]],
        });
        y = fimTabela(doc, y);
      }

      // 3. Estudo de massa
      if (cenario) {
        y = titulo(doc, "3. ESTUDO DE MASSA (CENÁRIO ESCOLHIDO)", y);
        autoTable(doc, {
          startY: y, theme: "grid", styles: { fontSize: 8 },
          headStyles: { fillColor: [26, 26, 26], textColor: [245, 196, 0] },
          head: [["Lotes vendáveis", "Área vendável", "Aproveitamento", "VGV do cenário", "Lote típico", "Via"]],
          body: [[
            String(cenario.kpis.lotesVendaveis),
            `${cenario.kpis.areaVendavelM2.toLocaleString("pt-BR")} m²`,
            `${(cenario.kpis.aproveitamento * 100).toFixed(0)}%`,
            formatCurrency(cenario.kpis.vgv),
            `${cenario.testadaLoteM}×${cenario.profundidadeLoteM} m`,
            `${cenario.larguraViaM} m`,
          ]],
        });
        y = fimTabela(doc, y);
      }

      // 4. Viabilidade (motor determinístico atual)
      if (r) {
        y = titulo(doc, "4. VIABILIDADE ECONÔMICA", y);
        autoTable(doc, {
          startY: y, theme: "grid", styles: { fontSize: 8 },
          headStyles: { fillColor: [26, 26, 26], textColor: [245, 196, 0] },
          head: [["Indicador", "Valor", "Indicador", "Valor"]],
          body: [
            ["VGV bruto", formatCurrency(r.vgvGross), "VPL", formatCurrency(r.vpl)],
            ["Custo total (hoje)", formatCurrency(r.custoTotal), "TIR", r.tirAnual != null ? `${(r.tirAnual * 100).toFixed(2)}% a.a.` : "—"],
            ["Custo total nominal (futuro, c/ INCC)", formatCurrency(r.custoTotalNominal), "Payback", r.paybackMes != null ? `${r.paybackMes} meses` : "—"],
            ["ROI", `${(r.roi * 100).toFixed(1)}%`, "Exposição máx.", formatCurrency(r.exposicaoMaxima)],
            ["Margem líquida", `${(r.margemLiquida * 100).toFixed(1)}%`, "Capacidade estimada", `${r.urbanistico.capacidadeEstimadaUnidades.toLocaleString("pt-BR")} unidades`],
          ],
        });
        y = fimTabela(doc, y);
      } else if (rLegado) {
        // Fallback: estudo legado com o EVE antigo (produto único).
        y = titulo(doc, "4. VIABILIDADE ECONÔMICA (ESTUDO LEGADO)", y);
        autoTable(doc, {
          startY: y, theme: "grid", styles: { fontSize: 8 },
          headStyles: { fillColor: [26, 26, 26], textColor: [245, 196, 0] },
          head: [["Indicador", "Valor", "Indicador", "Valor"]],
          body: [
            ["VGV", formatCurrency(rLegado.vgv), "VPL", formatCurrency(rLegado.vpl)],
            ["Custo total", formatCurrency(rLegado.custoTotal), "TIR", rLegado.tir != null ? `${(rLegado.tir * 100).toFixed(2)}% a.m.` : "—"],
            ["Custo do terreno", formatCurrency(rLegado.custoTerreno), "Payback", rLegado.paybackMes != null ? `${rLegado.paybackMes} meses` : "—"],
            ["Lucro bruto", formatCurrency(rLegado.lucroBruto), "Exposição máx.", formatCurrency(rLegado.exposicaoMaxima)],
            ["Margem líquida", `${(rLegado.margemLiquida * 100).toFixed(1)}%`, "", ""],
          ],
        });
        y = fimTabela(doc, y);
      }

      // 5. Parecer
      if (estudo.parecerIa) {
        y = titulo(doc, "5. PARECER DE VIABILIDADE", y);
        doc.setFontSize(8).setFont("helvetica", "normal").setTextColor(50, 50, 50);
        const linhas = doc.splitTextToSize(estudo.parecerIa, pw - 28);
        for (const l of linhas) {
          if (y > 278) { doc.addPage(); y = 20; }
          doc.text(l, 14, y);
          y += 4.2;
        }
      }

      // Ressalva
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFontSize(7).setTextColor(150, 150, 150);
      doc.text(
        "Estudo preliminar de viabilidade e aproveitamento. Não substitui projeto urbanístico/engenharia aprovado, levantamento topográfico oficial, matrícula ou aprovação municipal.",
        14, Math.max(y + 6, 285), { maxWidth: pw - 28 }
      );

      doc.save(`estudo-completo-${estudo.nome.replace(/\s+/g, "-").toLowerCase()}.pdf`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 p-6">
        <div className="text-center mb-5">
          <FileText size={28} className="text-gray-300 mx-auto mb-3" />
          <p className="font-bold text-[var(--brand-dark)]">Laudo executivo consolidado</p>
          <p className="text-gray-400 text-sm mt-1">
            Terreno (com APP automática), cidade & mercado, estudo de massa e viabilidade completa em um único PDF.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
          {secoes.map((s) => (
            <div key={s.label} className={`text-xs px-3 py-2 border ${s.ok ? "border-green-200 bg-green-50 text-green-700" : "border-gray-100 bg-gray-50 text-gray-400"}`}>
              {s.ok ? "✓" : "○"} {s.label}
            </div>
          ))}
        </div>

        <div className="text-center">
          <button onClick={gerarPdf} disabled={busy}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-5 py-2.5 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Baixar laudo completo (PDF)
          </button>
          <p className="text-[10px] text-gray-400 mt-2">Seções sem dados são omitidas do PDF automaticamente.</p>
        </div>
      </div>
    </div>
  );
}

function titulo(doc: jsPDF, txt: string, y: number): number {
  if (y > 260) { doc.addPage(); y = 20; }
  doc.setFontSize(11).setFont("helvetica", "bold").setTextColor(26, 26, 26);
  doc.text(txt, 14, y);
  doc.setDrawColor(245, 196, 0).setLineWidth(0.8);
  doc.line(14, y + 1.5, 80, y + 1.5);
  return y + 5;
}

function fimTabela(doc: jsPDF, fallback: number): number {
  const d = doc as jsPDF & { lastAutoTable?: { finalY?: number } };
  return (d.lastAutoTable?.finalY ?? fallback) + 8;
}
