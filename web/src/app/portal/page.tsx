import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText, CalendarDays, MessageSquare, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { getPortalDashboard } from "@/lib/data/portal-real";
import { formatCurrency } from "@/lib/utils";

const STATUS_FINANCIAMENTO: Record<string, { label: string; color: string }> = {
  analise_credito:     { label: "Análise de crédito",     color: "text-blue-600" },
  documentacao:        { label: "Documentação",            color: "text-orange-500" },
  avaliacao_imovel:    { label: "Avaliação do imóvel",    color: "text-purple-600" },
  aprovado:            { label: "Aprovado",                color: "text-green-600" },
  contrato_assinatura: { label: "Assinatura de contrato", color: "text-teal-600" },
  registro_cartorio:   { label: "Registro em cartório",   color: "text-indigo-600" },
  liberado:            { label: "Liberado",                color: "text-green-700" },
  cancelado:           { label: "Cancelado",               color: "text-red-500" },
};

export default async function PortalDashboard() {
  const session = await auth();
  if (!session) redirect("/login");

  const leadId = (session.user as { leadId?: string }).leadId;

  if (!leadId) {
    return (
      <div className="space-y-5">
        <div className="bg-[var(--brand-dark)] p-5">
          <p className="text-gray-400 text-xs uppercase tracking-widest">Bem-vindo</p>
          <h1 className="text-white font-black text-xl mt-1">{session.user.name}</h1>
        </div>
        <div className="bg-white border border-gray-100 p-8 text-center">
          <AlertCircle size={28} className="text-[var(--brand-yellow)] mx-auto mb-3" />
          <p className="text-[var(--brand-dark)] font-bold">Perfil em configuração</p>
          <p className="text-gray-400 text-sm mt-1">
            Seu cadastro ainda não foi vinculado a um processo. Entre em contato com sua equipe.
          </p>
          <a
            href="https://wa.me/5594993044689"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 bg-[var(--brand-yellow)] text-[var(--brand-dark)] text-sm font-bold px-5 py-2 hover:opacity-90 transition-opacity"
          >
            <MessageSquare size={14} /> Falar no WhatsApp
          </a>
        </div>
      </div>
    );
  }

  const lead = await getPortalDashboard(leadId);

  if (!lead) {
    return (
      <div className="bg-white border border-gray-100 p-8 text-center">
        <p className="text-gray-500">Processo não encontrado.</p>
      </div>
    );
  }

  const financiamento = lead.financiamentos[0];
  const ultimaInteracao = lead.interacoes[0];

  return (
    <div className="space-y-5">
      {/* Welcome */}
      <div className="bg-[var(--brand-dark)] p-5">
        <p className="text-gray-400 text-xs uppercase tracking-widest">Bem-vindo de volta</p>
        <h1 className="text-white font-black text-xl mt-1">{lead.nome}</h1>
        {lead.imovelInteresse && (
          <p className="text-gray-400 text-sm mt-0.5">
            {lead.imovelInteresse.titulo} — {lead.imovelInteresse.bairro}, {lead.imovelInteresse.cidade}
          </p>
        )}
      </div>

      {/* Service / status */}
      {financiamento && (
        <div className="bg-white border border-gray-100 p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Processo Ativo</p>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-bold text-[var(--brand-dark)] capitalize">
                {financiamento.tipo.replace(/_/g, " ")} — {financiamento.banco}
              </p>
              <p className={`text-sm font-medium mt-0.5 ${STATUS_FINANCIAMENTO[financiamento.status]?.color ?? "text-gray-600"}`}>
                {STATUS_FINANCIAMENTO[financiamento.status]?.label ?? financiamento.status}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Valor financiado</p>
              <p className="font-black text-[var(--brand-dark)] text-lg">{formatCurrency(financiamento.valorFinanciado)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { href: "/portal/documentos", label: "Documentos", icon: FileText, desc: "Envie e acompanhe" },
          { href: "/portal/visitas", label: "Visitas", icon: CalendarDays, desc: "Seu histórico" },
          { href: "/portal/acompanhamento", label: "Acompanhamento", icon: CheckCircle2, desc: "Atualizações" },
          { href: "/portal/chat", label: "Chat", icon: MessageSquare, desc: "Fale com corretor" },
        ].map(({ href, label, icon: Icon, desc }) => (
          <Link
            key={href}
            href={href}
            className="bg-white border border-gray-100 p-4 hover:border-[var(--brand-yellow)] hover:shadow-sm transition-all group"
          >
            <Icon size={20} className="text-[var(--brand-yellow)] mb-2" />
            <p className="font-bold text-[var(--brand-dark)] text-sm">{label}</p>
            <p className="text-gray-400 text-xs mt-0.5">{desc}</p>
          </Link>
        ))}
      </div>

      {/* Last update */}
      {ultimaInteracao && (
        <div className="bg-white border border-gray-100 p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Clock size={11} /> Última Atualização
          </p>
          <p className="text-[var(--brand-dark)] text-sm font-medium">{ultimaInteracao.descricao}</p>
          <p className="text-gray-400 text-xs mt-1">
            {new Date(ultimaInteracao.criadoEm).toLocaleDateString("pt-BR", {
              day: "2-digit", month: "long", year: "numeric",
            })}
          </p>
        </div>
      )}

      {/* Corretor */}
      {lead.corretor && (
        <div className="bg-[var(--brand-yellow)] p-4">
          <p className="text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wide mb-1">Seu Corretor</p>
          <p className="text-[var(--brand-dark)] font-black">{lead.corretor.nome}</p>
          {lead.corretor.telefone && (
            <a href={`tel:${lead.corretor.telefone}`} className="text-[var(--brand-dark)]/70 text-sm hover:text-[var(--brand-dark)] mt-0.5 block">
              {lead.corretor.telefone}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
