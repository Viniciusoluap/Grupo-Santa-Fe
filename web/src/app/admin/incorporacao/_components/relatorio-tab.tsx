"use client";

import { useState } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";
import { formatCurrency } from "@/lib/utils";
import type { EstudoData } from "./incorporacao-detail";

export function RelatorioTab({ estudo }: { estudo: EstudoData }) {
  const [busy, setBusy] = useState(false);
  const viab = estudo.viabilidadeJson ? JSON.parse(estudo.viabilidadeJson) : null;
  const r = viab?.resultado;

  function gerarPdf() {
    setBusy(true);
    try {
      const doc = new jsPDF();
      const pw = doc.internal.pageSize.getWidth();
      let y = 20;

      // Cabeçalho
      doc.setFillColor(26, 26, 26);
      doc.rect(0, 0, pw, 30, "F");
      doc.setTextColor(245, 196, 0);
      doc.setFontSize(16).setFont("helvetica", "bold");
      doc.text("ESTUDO DE INCORPORAÇÃO", 14, 18);
      doc.setTextColor(255, 255, 255).setFontSize(9).setFont("helvetica", "normal");
      doc.text("Grupo Santa Fé — Viabilidade Econômica (metodologia Carolina Caribé)", 14, 25);
      y = 42;

      doc.setTextColor(26, 26, 26).setFontSize(13).setFont("helvetica", "bold");
      doc.text(estudo.nome, 14, y); y += 6;
      doc.setFontSize(10).setFont("helvetica", "normal").setTextColor(90, 90, 90);
      doc.text(`${estudo.municipio}/${estudo.estado}`, 14, y); y += 10;

      // Terreno
      linhaTitulo(doc, "TERRENO", y); y += 7;
      linha(doc, "Área", `${estudo.areaM2.toLocaleString("pt-BR")} m² (${(estudo.areaM2 / 10_000).toFixed(2)} ha)`, y); y += 6;
      linha(doc, "Perímetro", `${estudo.perimetroM.toLocaleString("pt-BR")} m`, y); y += 6;
      if (estudo.centroLat && estudo.centroLng)
        { linha(doc, "Centro", `${estudo.centroLat.toFixed(5)}, ${estudo.centroLng.toFixed(5)}`, y); y += 6; }
      y += 4;

      // Viabilidade
      if (r) {
        linhaTitulo(doc, "VIABILIDADE ECONÔMICA (EVE)", y); y += 7;
        const items: [string, string][] = [
          ["VGV", formatCurrency(r.vgv)],
          ["Custo total", formatCurrency(r.custoTotal)],
          ["Custo do terreno", formatCurrency(r.custoTerreno)],
          ["Lucro bruto", formatCurrency(r.lucroBruto)],
          ["Margem líquida", `${(r.margemLiquida * 100).toFixed(1)}%`],
          ["VPL", formatCurrency(r.vpl)],
          ["TIR", r.tir != null ? `${(r.tir * 100).toFixed(2)}% a.m. (${((Math.pow(1 + r.tir, 12) - 1) * 100).toFixed(1)}% a.a.)` : "—"],
          ["Payback", r.paybackMes != null ? `${r.paybackMes} meses` : "não recuperado"],
          ["Exposição máxima de caixa", formatCurrency(r.exposicaoMaxima)],
        ];
        for (const [k, v] of items) { linha(doc, k, v, y); y += 6; }
        y += 4;
      } else {
        doc.setFontSize(9).setTextColor(150, 150, 150);
        doc.text("Viabilidade ainda não calculada.", 14, y); y += 8;
      }

      // Parecer
      if (estudo.parecerIa) {
        if (y > 240) { doc.addPage(); y = 20; }
        linhaTitulo(doc, "PARECER DE VIABILIDADE", y); y += 7;
        doc.setFontSize(9).setFont("helvetica", "normal").setTextColor(50, 50, 50);
        const linhas = doc.splitTextToSize(estudo.parecerIa, pw - 28);
        for (const l of linhas) {
          if (y > 280) { doc.addPage(); y = 20; }
          doc.text(l, 14, y); y += 5;
        }
      }

      // Rodapé de ressalva
      doc.setFontSize(7).setTextColor(150, 150, 150);
      doc.text(
        "Estudo preliminar de viabilidade. Não substitui projeto de engenharia/arquitetura aprovado, levantamento topográfico oficial ou aprovação municipal.",
        14, 290, { maxWidth: pw - 28 }
      );

      doc.save(`estudo-${estudo.nome.replace(/\s+/g, "-").toLowerCase()}.pdf`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 p-6 text-center">
        <FileText size={28} className="text-gray-300 mx-auto mb-3" />
        <p className="font-bold text-[var(--brand-dark)]">Laudo executivo do estudo</p>
        <p className="text-gray-400 text-sm mt-1 mb-4">
          Terreno, viabilidade econômica completa e parecer, em PDF.
        </p>
        <button onClick={gerarPdf} disabled={busy}
          className="inline-flex items-center gap-1.5 text-xs font-bold px-5 py-2.5 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 disabled:opacity-50">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Baixar laudo (PDF)
        </button>
        {!r && <p className="text-[10px] text-amber-600 mt-3">Dica: calcule e salve a viabilidade na aba EVE para um laudo completo.</p>}
      </div>
    </div>
  );
}

function linhaTitulo(doc: jsPDF, txt: string, y: number) {
  doc.setFontSize(11).setFont("helvetica", "bold").setTextColor(26, 26, 26);
  doc.text(txt, 14, y);
  doc.setDrawColor(245, 196, 0).setLineWidth(0.8);
  doc.line(14, y + 1.5, 60, y + 1.5);
}

function linha(doc: jsPDF, k: string, v: string, y: number) {
  doc.setFontSize(9).setFont("helvetica", "normal").setTextColor(110, 110, 110);
  doc.text(k, 14, y);
  doc.setFont("helvetica", "bold").setTextColor(26, 26, 26);
  doc.text(v, 90, y);
}
