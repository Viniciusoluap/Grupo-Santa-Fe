import Link from "next/link";
import { Plus, ClipboardList } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { ExcluirAvaliacaoBtn } from "./_components/excluir-avaliacao-btn";

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; order: number }> = {
  solicitada:        { label: "Solicitada",       bg: "bg-gray-100",    text: "text-gray-600",   order: 1 },
  vistoria:          { label: "Vistoria",          bg: "bg-blue-100",    text: "text-blue-700",   order: 2 },
  elaboracao:        { label: "Em Elaboração",     bg: "bg-yellow-100",  text: "text-yellow-700", order: 3 },
  revisao:           { label: "Revisão",           bg: "bg-orange-100",  text: "text-orange-700", order: 4 },
  entregue:          { label: "Entregue",          bg: "bg-green-100",   text: "text-green-700",  order: 5 },
  cancelada:         { label: "Cancelada",         bg: "bg-red-100",     text: "text-red-600",    order: 6 },
};

const TIPO_LABELS: Record<string, string> = {
  mercado:        "Avaliação de Mercado",
  locacao:        "Avaliação p/ Locação",
  judicial:       "Avaliação Judicial",
  parecer_tecnico: "Parecer Técnico",
};

export default async function AvaliacoesPage() {
  const avaliacoes = await prisma.avaliacao.findMany({ orderBy: { criadoEm: "desc" } });

  const statusCounts = avaliacoes.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const emAndamento = avaliacoes.filter((a) => !["entregue", "cancelada"].includes(a.status)).length;
  const entregues = statusCounts["entregue"] ?? 0;
  const valorMedio = avaliacoes.filter((a) => a.valorEstimado).reduce((s, a, _, arr) =>
    s + (a.valorEstimado ?? 0) / arr.filter((x) => x.valorEstimado).length, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Avaliação de Imóveis</h1>
          <p className="text-gray-400 text-sm mt-0.5">{avaliacoes.length} laudo{avaliacoes.length !== 1 ? "s" : ""} · Laudos e pareceres de avaliação</p>
        </div>
        <Link
          href="/admin/avaliacoes/nova"
          className="flex items-center gap-1.5 bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-4 py-2.5 transition-colors"
        >
          <Plus size={14} /> Nova Avaliação
        </Link>
      </div>

      {/* Pipeline */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {Object.entries(STATUS_CONFIG)
          .sort(([, a], [, b]) => a.order - b.order)
          .map(([status, cfg]) => (
            <div key={status} className="bg-white border border-gray-100 p-3 text-center">
              <p className="font-black text-[var(--brand-dark)] text-2xl">{statusCounts[status] ?? 0}</p>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 uppercase inline-block mt-1 ${cfg.bg} ${cfg.text}`}>
                {cfg.label}
              </span>
            </div>
          ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white border border-gray-100 p-4">
          <p className="font-black text-[var(--brand-dark)] text-xl">{emAndamento}</p>
          <p className="text-gray-400 text-xs mt-1 uppercase tracking-wide">Em andamento</p>
        </div>
        <div className="bg-white border border-gray-100 p-4">
          <p className="font-black text-green-600 text-xl">{entregues}</p>
          <p className="text-gray-400 text-xs mt-1 uppercase tracking-wide">Laudos entregues</p>
        </div>
        <div className="bg-white border border-gray-100 p-4">
          <p className="font-black text-[var(--brand-dark)] text-xl">{valorMedio > 0 ? formatCurrency(valorMedio) : "—"}</p>
          <p className="text-gray-400 text-xs mt-1 uppercase tracking-wide">Valor médio avaliado</p>
        </div>
      </div>

      {/* List */}
      {avaliacoes.length === 0 ? (
        <div className="bg-gray-50 border border-dashed border-gray-200 p-12 text-center">
          <ClipboardList size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhuma avaliação cadastrada</p>
          <p className="text-gray-400 text-sm mt-1">
            <Link href="/admin/avaliacoes/nova" className="text-[var(--brand-yellow)] hover:underline">Solicitar primeira avaliação</Link>
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--brand-dark)]">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase">Número</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase">Cliente / Endereço</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase hidden md:table-cell">Tipo</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase hidden lg:table-cell">Avaliador</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-400 uppercase hidden lg:table-cell">Valor Estimado</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-400 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {avaliacoes.map((a) => {
                  const cfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.solicitada;
                  return (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{a.numero}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--brand-dark)]">{a.clienteNome}</p>
                        <p className="text-xs text-gray-400">{a.endereco}, {a.bairro}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-600">{TIPO_LABELS[a.tipo] ?? a.tipo}</td>
                      <td className="px-4 py-3 hidden lg:table-cell text-sm text-gray-600">{a.avaliador}</td>
                      <td className="px-4 py-3 hidden lg:table-cell text-right font-bold text-[var(--brand-dark)]">
                        {a.valorEstimado ? formatCurrency(a.valorEstimado) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 uppercase ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <Link href={`/admin/avaliacoes/${a.id}`} className="text-xs font-bold text-[var(--brand-yellow)] hover:underline">Ver</Link>
                        <ExcluirAvaliacaoBtn id={a.id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
