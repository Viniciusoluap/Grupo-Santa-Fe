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
import { properties } from "@/lib/data/properties";
import type { UserRole } from "@/auth";

const kpis = [
  {
    label: "Imóveis Ativos",
    value: properties.length,
    change: "+2 este mês",
    up: true,
    icon: Building2,
    color: "bg-[var(--brand-yellow)]",
    href: "/admin/imoveis",
  },
  {
    label: "Novos Leads",
    value: 24,
    change: "+6 esta semana",
    up: true,
    icon: Users,
    color: "bg-blue-500",
    href: "/admin/leads",
  },
  {
    label: "Negócios Fechados",
    value: 7,
    change: "+2 este mês",
    up: true,
    icon: TrendingUp,
    color: "bg-green-500",
    href: "/admin/leads",
  },
  {
    label: "Receita do Mês",
    value: formatCurrency(38500),
    change: "-5% vs mês anterior",
    up: false,
    icon: CircleDollarSign,
    color: "bg-purple-500",
    href: "/admin",
  },
];

const recentLeads = [
  { id: 1, name: "Carlos Mendes", phone: "(62) 9 8765-4321", service: "Financiamento MCMV", status: "Novo", time: "há 15 min" },
  { id: 2, name: "Ana Paula Santos", phone: "(62) 9 9876-5432", service: "Compra de imóvel", status: "Em contato", time: "há 1h" },
  { id: 3, name: "Roberto Lima", phone: "(62) 9 7654-3210", service: "Avaliação de imóvel", status: "Visita agendada", time: "há 3h" },
  { id: 4, name: "Fernanda Costa", phone: "(62) 9 6543-2109", service: "Regularização", status: "Proposta enviada", time: "ontem" },
  { id: 5, name: "Marcos Oliveira", phone: "(62) 9 5432-1098", service: "Obra e reforma", status: "Novo", time: "ontem" },
];

const recentProperties = properties.slice(0, 5);

const statusColor: Record<string, string> = {
  "Novo": "bg-[var(--brand-yellow)] text-[var(--brand-dark)]",
  "Em contato": "bg-blue-100 text-blue-700",
  "Visita agendada": "bg-purple-100 text-purple-700",
  "Proposta enviada": "bg-orange-100 text-orange-700",
};

export default async function AdminDashboard() {
  const session = await auth();
  const role = ((session?.user as { role?: UserRole } | undefined)?.role) ?? "corretor";

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
            { label: "Meus Leads", value: corretorLeads.length, change: "+2 esta semana", up: true, icon: Users, color: "bg-blue-500", href: "/admin/leads" },
            { label: "Imóveis Disponíveis", value: properties.length, change: "carteira ativa", up: true, icon: Building2, color: "bg-[var(--brand-yellow)]", href: "/admin/imoveis" },
            { label: "Agenda Hoje", value: 2, change: "visitas marcadas", up: true, icon: CalendarDays, color: "bg-purple-500", href: "/admin/agenda" },
            { label: "Comissões do Mês", value: formatCurrency(4200), change: "+1 negócio fechado", up: true, icon: BadgeDollarSign, color: "bg-green-500", href: "/admin/comissoes" },
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
                    <p className="font-medium text-[var(--brand-dark)] text-sm truncate">{lead.name}</p>
                    <p className="text-gray-400 text-xs">{lead.service} · {lead.time}</p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 uppercase ${statusColor[lead.status] ?? "bg-gray-100 text-gray-500"}`}>
                    {lead.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-[var(--brand-dark)] text-sm uppercase tracking-wide">Imóveis em Carteira</h2>
              <Link href="/admin/imoveis" className="text-xs text-[var(--brand-yellow)] font-bold uppercase tracking-wide">Ver todos</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {properties.slice(0, 4).map((property) => (
                <div key={property.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-gray-50">
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--brand-dark)] text-sm truncate">{property.title}</p>
                    <p className="text-gray-400 text-xs">{property.address.neighborhood} · {formatCurrency(property.price)}</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 uppercase bg-gray-100 text-gray-500">{property.status}</span>
                </div>
              ))}
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
                    {lead.name}
                  </p>
                  <p className="text-gray-400 text-xs">{lead.service} · {lead.time}</p>
                </div>
                <span
                  className={`shrink-0 text-[10px] font-bold px-2 py-0.5 uppercase ${statusColor[lead.status] ?? "bg-gray-100 text-gray-500"}`}
                >
                  {lead.status}
                </span>
              </div>
            ))}
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
            {recentProperties.map((property) => (
              <div key={property.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-gray-50">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--brand-dark)] text-sm truncate">
                    {property.title}
                  </p>
                  <p className="text-gray-400 text-xs">{property.address.neighborhood} · {formatCurrency(property.price)}</p>
                </div>
                <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 uppercase ${
                  property.status === "lancamento"
                    ? "bg-[var(--brand-yellow)] text-[var(--brand-dark)]"
                    : "bg-gray-100 text-gray-500"
                }`}>
                  {property.status}
                </span>
              </div>
            ))}
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
