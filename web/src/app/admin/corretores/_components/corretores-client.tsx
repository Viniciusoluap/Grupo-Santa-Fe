"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Phone, TrendingUp, Building2, Award, Search, Mail, Pencil, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { excluirCorretor } from "@/lib/actions/corretores";
import { COMMISSION_STATUS_CONFIG } from "@/lib/types/corretor";

type DbComissao = {
  id: string;
  imovel: string;
  valor: number;
  percentual: number;
  status: string;
  vencimento: Date;
  pagamentoEm: Date | null;
  notas: string;
};

type DbCorretor = {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  creci: string;
  ativo: boolean;
  especialidades: string;
  comissoes: DbComissao[];
  leads: { id: string }[];
  imoveis: { id: string }[];
};

interface CorretoresClientProps {
  corretores: DbCorretor[];
}

export function CorretoresClient({ corretores }: CorretoresClientProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | "ativos" | "inativos">("ativos");
  const [isPending, startTransition] = useTransition();

  function handleExcluir(id: string, nome: string) {
    if (!confirm(`Excluir o corretor "${nome}"? Esta ação não pode ser desfeita.`)) return;
    startTransition(async () => { await excluirCorretor(id); });
  }

  const filtered = corretores.filter((c) => {
    const especialidades: string[] = (() => {
      try { return JSON.parse(c.especialidades); } catch { return []; }
    })();
    const matchSearch =
      !search ||
      c.nome.toLowerCase().includes(search.toLowerCase()) ||
      c.creci.toLowerCase().includes(search.toLowerCase()) ||
      especialidades.some((s) => s.toLowerCase().includes(search.toLowerCase()));
    const matchFilter =
      filter === "todos" || (filter === "ativos" ? c.ativo : !c.ativo);
    return matchSearch && matchFilter;
  });

  const totalComissaoPaga = corretores
    .flatMap((c) => c.comissoes)
    .filter((cm) => cm.status === "paga")
    .reduce((s, cm) => s + cm.valor, 0);

  const totalComissaoPendente = corretores
    .flatMap((c) => c.comissoes)
    .filter((cm) => cm.status === "pendente" || cm.status === "aprovada")
    .reduce((s, cm) => s + cm.valor, 0);

  // Flat list of all commissions with corretor name for the summary table
  const todasComissoes = corretores
    .flatMap((c) =>
      c.comissoes.map((cm) => ({ ...cm, corretorNome: c.nome, corretorId: c.id }))
    )
    .sort((a, b) => new Date(b.vencimento).getTime() - new Date(a.vencimento).getTime());

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Corretores</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {corretores.filter((c) => c.ativo).length} ativos · {corretores.length} cadastrados
          </p>
        </div>
        <Link
          href="/admin/corretores/novo"
          className="flex items-center gap-1.5 bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-4 py-2.5 transition-colors"
        >
          <Plus size={14} /> Novo Corretor
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Ativos", value: corretores.filter((c) => c.ativo).length, sub: "corretores", icon: Award, color: "text-blue-500" },
          { label: "Vendas no Ano", value: corretores.flatMap((c) => c.comissoes).filter((cm) => cm.status === "paga").length, sub: "comissões pagas", icon: TrendingUp, color: "text-green-500" },
          { label: "Comissão Paga", value: formatCurrency(totalComissaoPaga), sub: "no período", icon: Building2, color: "text-[var(--brand-yellow)]" },
          { label: "A Receber", value: formatCurrency(totalComissaoPendente), sub: "pendente + aprovada", icon: Building2, color: "text-orange-400" },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 font-bold uppercase tracking-wide">{label}</span>
              <Icon size={16} className={color} />
            </div>
            <p className="font-black text-[var(--brand-dark)] text-xl leading-none">{value}</p>
            <p className="text-gray-400 text-xs mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome, CRECI ou especialidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-white"
          />
        </div>
        <div className="flex border border-gray-200">
          {(["todos", "ativos", "inativos"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 text-xs font-bold uppercase transition-colors capitalize ${
                filter === f ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)]" : "text-gray-400 hover:bg-gray-50"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-4">
        {filtered.map((c) => {
          const especialidades: string[] = (() => {
            try { return JSON.parse(c.especialidades); } catch { return []; }
          })();
          const totalComissao = c.comissoes
            .filter((cm) => cm.status !== "cancelada")
            .reduce((s, cm) => s + cm.valor, 0);
          const pendente = c.comissoes
            .filter((cm) => cm.status === "pendente" || cm.status === "aprovada")
            .reduce((s, cm) => s + cm.valor, 0);

          return (
            <div key={c.id} className={`bg-white border p-5 ${c.ativo ? "border-gray-100" : "border-gray-100 opacity-60"}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[var(--brand-yellow)] flex items-center justify-center shrink-0">
                    <span className="text-[var(--brand-dark)] font-black text-lg">{c.nome[0]}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-[var(--brand-dark)] leading-tight">{c.nome}</h3>
                    <p className="text-gray-400 text-xs">{c.creci}</p>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 uppercase ${
                    c.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {c.ativo ? "Ativo" : "Inativo"}
                </span>
              </div>

              <div className="flex flex-wrap gap-1 mb-4">
                {especialidades.map((s) => (
                  <span key={s} className="text-[9px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 uppercase">
                    {s}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center p-2 bg-gray-50">
                  <p className="font-black text-[var(--brand-dark)] text-lg leading-none">{c.leads.length}</p>
                  <p className="text-gray-400 text-[10px] mt-0.5">Leads</p>
                </div>
                <div className="text-center p-2 bg-gray-50">
                  <p className="font-black text-[var(--brand-dark)] text-lg leading-none">
                    {c.comissoes.filter((cm) => cm.status === "paga").length}
                  </p>
                  <p className="text-gray-400 text-[10px] mt-0.5">Vendas</p>
                </div>
                <div className="text-center p-2 bg-gray-50">
                  <p className="font-black text-[var(--brand-dark)] text-lg leading-none">
                    {c.leads.length > 0
                      ? ((c.comissoes.filter((cm) => cm.status === "paga").length / c.leads.length) * 100).toFixed(0)
                      : "0"}
                    %
                  </p>
                  <p className="text-gray-400 text-[10px] mt-0.5">Conversão</p>
                </div>
              </div>

              <div className="space-y-1.5 mb-4 pb-4 border-b border-gray-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Total comissão</span>
                  <span className="font-bold text-[var(--brand-dark)]">{formatCurrency(totalComissao)}</span>
                </div>
                {pendente > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">A receber</span>
                    <span className="font-bold text-orange-500">{formatCurrency(pendente)}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Link
                  href={`/admin/corretores/${c.id}`}
                  className="flex-1 text-center text-xs bg-[var(--brand-dark)] hover:bg-[var(--brand-dark-secondary)] text-[var(--brand-yellow)] font-bold uppercase tracking-wider py-2 transition-colors"
                >
                  Ver Perfil
                </Link>
                <a href={`tel:${c.telefone}`}
                  className="flex items-center gap-1 text-xs border border-gray-200 hover:border-[var(--brand-yellow)] text-gray-500 font-bold px-3 py-2 transition-colors">
                  <Phone size={12} />
                </a>
                <a href={`mailto:${c.email}`}
                  className="flex items-center gap-1 text-xs border border-gray-200 hover:border-[var(--brand-yellow)] text-gray-500 font-bold px-3 py-2 transition-colors">
                  <Mail size={12} />
                </a>
                <Link href={`/admin/corretores/${c.id}/editar`}
                  className="flex items-center gap-1 text-xs border border-gray-200 hover:border-[var(--brand-yellow)] text-gray-500 font-bold px-3 py-2 transition-colors">
                  <Pencil size={12} />
                </Link>
                <button onClick={() => handleExcluir(c.id, c.nome)} disabled={isPending}
                  className="flex items-center gap-1 text-xs border border-gray-200 hover:border-red-300 hover:text-red-500 text-gray-500 font-bold px-3 py-2 transition-colors disabled:opacity-50">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Commissions summary table */}
      <div className="bg-white border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-[var(--brand-dark)] text-sm uppercase tracking-wide">Últimas Comissões</h2>
          <Link href="/admin/comissoes" className="text-xs text-[var(--brand-yellow)] font-bold hover:underline">
            Ver todas →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Corretor</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase hidden md:table-cell">Imóvel</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-400 uppercase">Valor</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {todasComissoes.slice(0, 8).map((cm) => {
                const cfg = COMMISSION_STATUS_CONFIG[cm.status as keyof typeof COMMISSION_STATUS_CONFIG] ?? {
                  bgColor: "bg-gray-100",
                  color: "text-gray-600",
                  label: cm.status,
                };
                return (
                  <tr key={cm.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-[var(--brand-dark)] text-sm">{cm.corretorNome}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">{cm.imovel}</td>
                    <td className="px-4 py-3 text-right font-bold text-sm">{formatCurrency(cm.valor)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 uppercase ${cfg.bgColor} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
