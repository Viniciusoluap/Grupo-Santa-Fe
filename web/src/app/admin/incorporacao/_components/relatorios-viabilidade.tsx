"use client";
import { Download, FileText } from "lucide-react";
import { calcularCenarios } from "@/lib/finance/loteamento";
import { defaultsForm, montarPremissasLoteamento } from "@/lib/incorporacao/premissas-loteamento";
import { gerarRelatorioExecutivo, gerarRelatorioCustos, gerarRelatorioTerreneiro } from "@/lib/pdf/loteamento";
import type { EstudoData } from "./incorporacao-detail";

/** Reutiliza motor e PDFs existentes; cada público mantém seu próprio modelo. */
export function RelatoriosViabilidade({ estudo }: { estudo: EstudoData }) {
  const premissas = montarPremissasLoteamento(estudo);
  if (!premissas) return <section className="rounded-xl border border-gray-200 bg-white p-4"><h2 className="font-bold">Relatórios da Viabilidade e Negociação</h2><p className="mt-2 text-sm text-gray-600">Salve as premissas na aba Viabilidade para gerar os relatórios.</p></section>;
  const form = { ...defaultsForm(estudo), ...JSON.parse(estudo.loteamentoJson!) };
  const cenarios = calcularCenarios(premissas);
  const meta = { nome: estudo.nome, municipio: estudo.municipio, estado: estudo.estado, permutaPct: form.permutaPctVgv, taxaDescontoAnual: form.taxaDescontoAnual };
  const opcoes = [
    { nome: "Relatório Executivo da Viabilidade", gerar: () => gerarRelatorioExecutivo(meta, cenarios) },
    { nome: "Relatório de Custos", gerar: () => gerarRelatorioCustos(meta, cenarios, {
      projetosLicencas: form.projetosLicencas, marketing: form.marketing, registroPorUnidade: form.registroPorUnidade,
      contingenciaPct: form.contingenciaPctInfra, bdiPct: form.bdiPct, comissaoPct: form.comissaoPctVgv,
      despesasPct: form.despesasGeraisPctVgv, impostosPct: form.impostosPctVgv,
    }) },
    { nome: "Relatório do Terreneiro", gerar: () => gerarRelatorioTerreneiro(meta, cenarios) },
  ];
  return <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
    <h2 className="font-bold text-[var(--brand-dark)]">Relatórios da Viabilidade e Negociação</h2>
    <p className="mb-4 mt-2 text-sm text-gray-600">Gerados com as premissas salvas na Viabilidade. Salve suas alterações antes de baixar.</p>
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{opcoes.map(({ nome, gerar }) => <button key={nome} type="button" onClick={gerar} className="flex min-h-12 items-center gap-2 rounded-lg border border-gray-200 px-4 py-3 text-left text-xs font-bold text-[var(--brand-dark)] hover:border-[var(--brand-yellow)]">
      <FileText size={16} className="shrink-0" /><span className="min-w-0 flex-1">{nome}</span><Download size={14} className="shrink-0" />
    </button>)}</div>
  </section>;
}
