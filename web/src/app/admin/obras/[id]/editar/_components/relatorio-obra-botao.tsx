"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { dadosRelatorioObra } from "@/lib/actions/obra-progresso";
import { gerarPdfRelatorioObra } from "@/lib/obras/relatorio-pdf";
import { montarRelatorioObra, progressoParaRelatorio, verificarCompletude } from "@/lib/obras/relatorio";
import { calcularProgresso } from "@/lib/financeiro/progresso";
import { obraStatusLabel } from "@/lib/types/obra";
import { gerarExcelRelatorioObra } from "@/lib/obras/relatorio-excel";

// EPIC-020 Lote 4 (item 29) — relatório executivo da obra em PDF, com a
// logomarca do Grupo Santa Fé e somente dados reais da obra (admin).

const EMPRESA = "Grupo Santa Fé";

export function RelatorioObraBotao({ obraId }: { obraId: string }) {
  const [gerando, setGerando] = useState<"pdf" | "excel" | null>(null);
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const gerar = async (formato: "pdf" | "excel") => {
    setGerando(formato);
    setMensagem(null);
    try {
      const d = await dadosRelatorioObra(obraId);
      const r = d.resumo;
      const relatorio = montarRelatorioObra({
        empresa: EMPRESA,
        geradoEm: new Date(),
        info: { ...d.info, status: obraStatusLabel(d.info.status) },
        valores: {
          vgv: r.valores.vgv, financiamento: r.valores.financiamento, fgts: r.valores.fgts, subsidio: r.valores.subsidio,
          custoTerreno: r.valores.custoTerreno, comissao: r.valores.comissao, orcamentoPrevisto: r.valores.orcamentoPrevisto,
          taxaMensalPct: r.valores.taxaMensalPct, parcelas: r.valores.parcelas, percentualEmpreiteiro: r.valores.percentualEmpreiteiro,
          incluirProSolutoBaseEmpreiteiro: r.valores.incluirProSolutoBaseEmpreiteiro,
        },
        calculo: r.calculo,
        empreiteiro: r.empreiteiro?.nome ?? null,
        investidores: r.investidores.map((i, idx) => ({ nome: i.nome, percentual: i.percentual, lucro: r.calculo.investidores[idx]?.lucro })),
        comissao: r.corretor ? r.comissaoCalculada : null,
        movimentos: r.movimentos.map((m) => ({ data: m.data, natureza: m.natureza, categoria: m.categoria, descricao: m.descricao, valor: m.valor, status: m.status, origem: m.origem })),
        progresso: progressoParaRelatorio(calcularProgresso(d.progresso.itens), d.progresso.medido, d.progresso.progressoLegado),
        fotos: d.fotos.map((f) => ({ legenda: f.legenda, data: f.data })),
      });
      const faltas = verificarCompletude(relatorio);
      if (faltas.length) throw new Error(`Relatório incompleto: ${faltas.join("; ")}`);
      const nome = `relatorio-executivo-${d.info.titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}`;
      if (formato === "pdf") await gerarPdfRelatorioObra(
        relatorio, { empresa: EMPRESA, logoUrl: "/logo.png", primaria: [245, 196, 0], escura: [26, 26, 26] }, d.fotos, `${nome}.pdf`
      );
      else await gerarExcelRelatorioObra(relatorio, d.fotos.map(f => ({ legenda: f.legenda, data: f.data, url: new URL(f.url, window.location.origin).href })), `${nome}.xlsx`);
      setMensagem({ tipo: "ok", texto: `Relatório ${formato === "pdf" ? "PDF" : "Excel"} gerado.` });
    } catch (e) {
      setMensagem({ tipo: "erro", texto: e instanceof Error ? e.message : String(e) });
    } finally {
      setGerando(null);
    }
  };

  return (
    <section className="bg-white border border-gray-100 p-5 space-y-3">
      <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest">Relatório executivo (PDF e Excel)</h2>
      <p className="text-xs text-gray-500">Multipágina: capa, sumário, informações, valores da operação, custos (com históricos manual/BPO), os 20 serviços do progresso, gráficos e fotos marcadas. Campos sem informação aparecem como &quot;Não informado&quot;.</p>
      <div className="flex flex-wrap gap-2">
        {(["pdf", "excel"] as const).map(formato => <button key={formato} type="button" onClick={() => gerar(formato)} disabled={gerando !== null}
          className="flex items-center gap-2 bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-6 py-2.5 disabled:opacity-60">
          {gerando === formato ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {gerando === formato ? "Gerando..." : `Baixar ${formato === "pdf" ? "PDF" : "Excel"}`}
        </button>)}
      </div>
      {mensagem && <p role={mensagem.tipo === "erro" ? "alert" : "status"} className={`text-sm ${mensagem.tipo === "erro" ? "text-red-700" : "text-green-700"}`}>{mensagem.texto}</p>}
    </section>
  );
}
