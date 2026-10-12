import Link from "next/link";
import type { ComissaoDeObra } from "@/lib/comissoes/obras";
import { formatCurrency } from "@/lib/utils";

// EPIC-020 Lote 3 (item 32): comissões nascidas das obras com corretor no CRM.
const STATUS: Record<string, { label: string; cls: string }> = {
  dados_incompletos: { label: "Dados incompletos", cls: "bg-amber-100 text-amber-800" },
  pendente: { label: "Pendente", cls: "bg-gray-100 text-gray-700" },
  parcial: { label: "Paga parcialmente", cls: "bg-blue-100 text-blue-800" },
  paga: { label: "Paga", cls: "bg-green-100 text-green-800" },
};
const reais = (c: number | null) => (c === null ? "—" : formatCurrency(c / 100));

export function ComissoesDeObras({ linhas }: { linhas: ComissaoDeObra[] }) {
  const incompletas = linhas.filter((l) => l.calculo.status === "dados_incompletos").length;
  return (
    <section className="bg-white border border-gray-100 p-5 space-y-3">
      <div>
        <h2 className="font-black text-[var(--brand-dark)] text-sm uppercase tracking-wider">Comissões de obras (automáticas pelo CRM)</h2>
        <p className="text-xs text-gray-500 mt-1">
          Toda obra cujo lead tem corretor aparece aqui. Comissão = VGV × % / 100, com o percentual da obra ou o padrão do
          corretor. Pagamentos: lançamentos de categoria “Comissão” no financeiro da obra.
          {incompletas > 0 && ` ${incompletas} obra(s) com dados incompletos.`}
        </p>
      </div>
      {linhas.length === 0 ? (
        <p className="text-sm text-gray-400">Nenhuma obra com corretor vinculado no CRM.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                <th className="py-2 pr-3">Corretor / cliente</th><th className="py-2 pr-3">Obra</th><th className="py-2 pr-3">VGV · %</th>
                <th className="py-2 pr-3">Comissão</th><th className="py-2 pr-3">Pago · saldo</th><th className="py-2">Situação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.obraId} className="border-b border-gray-50 align-top">
                  <td className="py-2 pr-3">{l.corretor}<br /><span className="text-xs text-gray-400">{l.cliente}</span></td>
                  <td className="py-2 pr-3"><Link className="underline" href={`/admin/obras/${l.obraId}/editar`}>{l.obra}</Link></td>
                  <td className="py-2 pr-3">
                    {l.vgv ? formatCurrency(Number(l.vgv)) : "VGV não informado"}<br />
                    <span className="text-xs text-gray-500">{l.calculo.percentual ? `${Number(l.calculo.percentual).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}% (${l.calculo.fontePercentual === "obra" ? "da obra" : "padrão do corretor"})` : "sem percentual"}</span>
                  </td>
                  <td className="py-2 pr-3 font-bold">{reais(l.calculo.valorCentavos)}</td>
                  <td className="py-2 pr-3">{reais(l.calculo.pagoCentavos)}<br /><span className="text-xs text-gray-500">saldo {reais(l.calculo.saldoCentavos)}</span></td>
                  <td className="py-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 uppercase ${STATUS[l.calculo.status].cls}`}>{STATUS[l.calculo.status].label}</span>
                    {[...l.calculo.pendencias, ...l.alertas].map((t) => <p key={t} className="text-[11px] text-amber-700 mt-1">{t}</p>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
