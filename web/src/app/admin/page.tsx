import {
  Building2,
  Users,
  TrendingUp,
  CircleDollarSign,
  CalendarDays,
  BadgeDollarSign,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import Link from "next/link";
import { auth } from "@/auth";
import { formatCurrency } from "@/lib/utils";
import { prisma } from "@/lib/db";
import type { UserRole } from "@/auth";

const leadStatusColor: Record<string, string> = {
  "novo": "bg-[var(--brand-yellow)] text-[var(--brand-dark)]",
  "em_contato": "bg-blue-100 text-blue-700",
  "visita_agendada": "bg-purple-100 text-purple-700",
  "proposta_enviada": "bg-orange-100 text-orange-700",
  "fechado": "bg-green-100 text-green-700",
};

function leadStatusLabel(status: string) {
  const map: Record<string, string> = {
    novo: "Novo",
    em_contato: "Em contato",
    visita_agendada: "Visita agendada",
    proposta_enviada: "Proposta enviada",
    fechado: "Fechado",
    perdido: "Perdido",
  };
  return map[status] ?? status;
}

const imovelStatusColor: Record<string, string> = {
  venda: "bg-green-100 text-green-700",
  locacao: "bg-blue-100 text-blue-700",
  lancamento: "bg-[var(--brand-yellow)] text-[var(--brand-dark)]",
  vendido: "bg-gray-100 text-gray-500",
  locado: "bg-gray-100 text-gray-500",
};

export default async function AdminDashboard() {
  const session = await auth();
  const role = ((session?.user as { role?: UserRole } | undefined)?.role) ?? "corretor";

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Fetch all real data in parallel
  const [
    imoveisAtivos,
    leadsThisMonth,
    leadsFechados,
    comissoesThisMonth,
    recentLeads,
    recentImoveis,
  ] = await Promise.all([
    prisma.imovel.count({
      where: { status: { notIn: ["vendido", "locado"] } },
    }),
    prisma.lead.count({
      where: { criadoEm: { gte: firstOfMonth } },
    }),
    prisma.lead.count({
      where: { status: "fechado" },
    }),
    prisma.comissao.aggregate({
      _sum: { valor: true },
      where: { status: "paga", pagamentoEm: { gte: firstOfMonth } },
    }),
    prisma.lead.findMany({
      orderBy: { criadoEm: "desc" },
      take: 5,
    }),
    prisma.imovel.findMany({
      orderBy: { criadoEm: "desc" },
      take: 5,
    }),
  ]);

  const receitaMes = comissoesThisMonth._sum.valor ?? 0;

  const kpis = [
    {
      label: "Imóveis Ativos",
      value: imoveisAtivos,
      change: "portfólio ativo",
      up: true,
      icon: Building2,
      color: "bg-[var(--brand-yellow)]",
      href: "/admin/imoveis",
    },
    {
      label: "Novos Leads",
      value: leadsThisMonth,
      change: "este mês",
      up: true,
      icon: Users,
      color: "bg-blue-500",
      href: "/admin/leads",
    },
    {
      label: "Negócios Fechados",
      value: leadsFechados,
      change: "total fechados",
      up: true,
      icon: TrendingUp,
      color: "bg-green-500",
      href: "/admin/leads",
    },
    {
      label: "Receita do Mês",
      value: formatCurrency(receitaMes),
      change: "comissões pagas",
      up: receitaMes >= 0,
      icon: CircleDollarSign,
      color: "bg-purple-500",
      href: "/admin",
    },
  ];

  if (role === "corretor") {
    const userName = session?.user?.name ?? "Corretor";
    const corretorLeads = recentLeads.slice(0, 3);
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">
            Olá, {userName.split(" ")[0]}
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">Seu painel de atividades</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: "Meus Leads", value: corretorLeads.length, change: "recentes", up: true, icon: Users, color: "bg-blue-500", href: "/admin/leads" },
            { label: "Imóveis Disponíveis", value: imoveisAtivos, change: "carteira ativa", up: true, icon: Building2, color: "bg-[var(--brand-yellow)]", href: "/admin/imoveis" },
            { label: "Agenda Hoje", value: 0, change: "visitas marcadas", up: true, icon: CalendarDays, color: "bg-purple-500", href: "/admin/agenda" },
            { label: "Comissões do Mês", value: formatCurrency(receitaMes), change: "pagas este mês", up: true, icon: BadgeDollarSign, color: "bg-green-500", href: "/admin/comissoes" },
          ].map(({ label, value, change, up, icon: Icon, color, href }) => (
            <Link key={label} href={href} className="bg-white border border-gray-100 p-5 hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 ${color} flex items-center justify-center`}>
                  <Icon size={18} className="text-white" />
                </div>
                <ArrowUpRight size={14} className="text-gray-300 group-hover:text-[var(--brand-yellow)] transition-colors" />
              </div>
              <p className="font-black text-[var(--brand-dark)] text-2xl leading-none">{value}</p>
              <p className="text-gray-400 text-xs mt-1">{label}</p>
              <div className={`flex items-center gap-1 text-xs mt-2 font-medium ${up ? "text-green-500" : "text-red-400"}`}>
                {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                {change}
              </div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-[var(--brand-dark)] text-sm uppercase tracking-wide">Meus Leads</h2>
              <Link href="/admin/leads" className="text-xs text-[var(--brand-yellow)] font-bold uppercase tracking-wide">Ver todos</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {corretorLeads.map((lead) => (
                <div key={lead.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-gray-50">
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--brand-dark)] text-sm truncate">{lead.nome}</p>
                    <p className="text-gray-400 text-xs">{lead.servico} · {new Date(lead.criadoEm).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 uppercase ${leadStatusColor[lead.status] ?? "bg-gray-100 text-gray-500"}`}>
                    {leadStatusLabel(lead.status)}
                  </span>
                </div>
              ))}
              {corretorLeads.length === 0 && (
                <p className="px-5 py-4 text-xs text-gray-400">Nenhum lead ainda.</p>
              )}
            </div>
          </div>
          <div className="bg-white border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-[var(--brand-dark)] text-sm uppercase tracking-wide">Imóveis em Carteira</h2>
              <Link href="/admin/imoveis" className="text-xs text-[var(--brand-yellow)] font-bold uppercase tracking-wide">Ver todos</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {recentImoveis.slice(0, 4).map((imovel) => (
                <div key={imovel.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-gray-50">
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--brand-dark)] text-sm truncate">{imovel.titulo}</p>
                    <p className="text-gray-400 text-xs">{imovel.bairro} · {formatCurrency(imovel.preco)}</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 uppercase bg-gray-100 text-gray-500">{imovel.status}</span>
                </div>
              ))}
              {recentImoveis.length === 0 && (
                <p className="px-5 py-4 text-xs text-gray-400">Nenhum imóvel cadastrado.</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-[var(--brand-dark)] p-5">
          <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-3">Ações rápidas</p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Registrar Lead", href: "/admin/leads/novo" },
              { label: "Ver Simulações", href: "/simulador" },
              { label: "Minha Agenda", href: "/admin/agenda" },
              { label: "Site Público", href: "/" },
            ].map(({ label, href }) => (
              <Link key={label} href={href} className="text-xs bg-white/10 hover:bg-[var(--brand-yellow)] hover:text-[var(--brand-dark)] text-gray-300 px-3 py-1.5 font-medium transition-colors">
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">
          Dashboard
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">
          Visão geral do Grupo Santa Fé
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map(({ label, value, change, up, icon: Icon, color, href }) => (
          <Link
            key={label}
            href={href}
            className="bg-white border border-gray-100 p-5 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 ${color} flex items-center justify-center`}>
                <Icon size={18} className="text-white" />
              </div>
              <ArrowUpRight
                size={14}
                className="text-gray-300 group-hover:text-[var(--brand-yellow)] transition-colors"
              />
            </div>
            <p className="font-black text-[var(--brand-dark)] text-2xl leading-none">
              {value}
            </p>
            <p className="text-gray-400 text-xs mt-1">{label}</p>
            <div className={`flex items-center gap-1 text-xs mt-2 font-medium ${up ? "text-green-500" : "text-red-400"}`}>
              {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
              {change}
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent Leads */}
        <div className="bg-white border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-[var(--brand-dark)] text-sm uppercase tracking-wide">
              Leads Recentes
            </h2>
            <Link
              href="/admin/leads"
              className="text-xs text-[var(--brand-yellow)] hover:text-[var(--brand-yellow-dark)] font-bold uppercase tracking-wide"
            >
              Ver todos
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentLeads.map((lead) => (
              <div key={lead.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-gray-50">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--brand-dark)] text-sm truncate">
                    {lead.nome}
                  </p>
                  <p className="text-gray-400 text-xs">{lead.servico} · {new Date(lead.criadoEm).toLocaleDateString("pt-BR")}</p>
                </div>
                <span
                  className={`shrink-0 text-[10px] font-bold px-2 py-0.5 uppercase ${leadStatusColor[lead.status] ?? "bg-gray-100 text-gray-500"}`}
                >
                  {leadStatusLabel(lead.status)}
                </span>
              </div>
            ))}
            {recentLeads.length === 0 && (
              <p className="px-5 py-4 text-xs text-gray-400">Nenhum lead cadastrado.</p>
            )}
          </div>
        </div>

        {/* Recent Properties */}
        <div className="bg-white border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-[var(--brand-dark)] text-sm uppercase tracking-wide">
              Imóveis Recentes
            </h2>
            <Link
              href="/admin/imoveis"
              className="text-xs text-[var(--brand-yellow)] hover:text-[var(--brand-yellow-dark)] font-bold uppercase tracking-wide"
            >
              Ver todos
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentImoveis.map((imovel) => (
              <div key={imovel.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-gray-50">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--brand-dark)] text-sm truncate">
                    {imovel.titulo}
                  </p>
                  <p className="text-gray-400 text-xs">{imovel.bairro} · {formatCurrency(imovel.preco)}</p>
                </div>
                <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 uppercase ${imovelStatusColor[imovel.status] ?? "bg-gray-100 text-gray-500"}`}>
                  {imovel.status}
                </span>
              </div>
            ))}
            {recentImoveis.length === 0 && (
              <p className="px-5 py-4 text-xs text-gray-400">Nenhum imóvel cadastrado.</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-[var(--brand-dark)] p-5">
        <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-3">
          Ações rápidas
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Cadastrar Imóvel", href: "/admin/imoveis/novo" },
            { label: "Registrar Lead", href: "/admin/leads/novo" },
            { label: "Ver Simulações", href: "/simulador" },
            { label: "Site Público", href: "/" },
          ].map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className="text-xs bg-white/10 hover:bg-[var(--brand-yellow)] hover:text-[var(--brand-dark)] text-gray-300 px-3 py-1.5 font-medium transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
