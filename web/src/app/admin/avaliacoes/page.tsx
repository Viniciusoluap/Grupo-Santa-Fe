import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { AvaliacoesClient } from "./_components/avaliacoes-client";

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; order: number }> = {
  solicitada:        { label: "Solicitada",       bg: "bg-gray-100",    text: "text-gray-600",   order: 1 },
  vistoria:          { label: "Vistoria",          bg: "bg-blue-100",    text: "text-blue-700",   order: 2 },
  elaboracao:        { label: "Em Elaboração",     bg: "bg-yellow-100",  text: "text-yellow-700", order: 3 },
  revisao:           { label: "Revisão",           bg: "bg-orange-100",  text: "text-orange-700", order: 4 },
  entregue:          { label: "Entregue",          bg: "bg-green-100",   text: "text-green-700",  order: 5 },
  cancelada:         { label: "Cancelada",         bg: "bg-red-100",     text: "text-red-600",    order: 6 },
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

  const rows = avaliacoes.map((a) => ({
    id: a.id,
    numero: a.numero,
    clienteNome: a.clienteNome,
    endereco: a.endereco,
    bairro: a.bairro,
    tipo: a.tipo,
    avaliador: a.avaliador,
    valorEstimado: a.valorEstimado,
    status: a.status,
  }));

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
          <p className="font-black text-[var(--brand-dark)] text-xl">{valorMedio > 0 ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valorMedio) : "—"}</p>
          <p className="text-gray-400 text-xs mt-1 uppercase tracking-wide">Valor médio avaliado</p>
        </div>
      </div>

      <AvaliacoesClient avaliacoes={rows} />
    </div>
  );
}
