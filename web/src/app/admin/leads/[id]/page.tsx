import { notFound } from "next/navigation";
import Link from "next/link";
import { Phone, MessageSquare, Mail, Calendar, User, UserCheck, Clock, FileText, Download, ExternalLink, Plus, Link2 } from "lucide-react";
import { auth } from "@/auth";
import { BackButton } from "@/components/ui/back-button";
import { prisma } from "@/lib/db";
import { LEAD_STATUS_CONFIG, INTERACTION_CONFIG, LeadStatus, InteractionType } from "@/lib/types/crm";
import { formatCurrency, formatTelefone } from "@/lib/utils";
import { MODULO_CONFIG, type ModuloServico } from "@/lib/crm/servicos-lead";
import { rotuloResponsavel } from "@/lib/crm/responsavel";
import { AddInteractionForm } from "./add-interaction-form";
import { LeadStatusPicker } from "./lead-status-picker";
import { LeadAgendarVisita } from "./lead-agendar-visita";

interface PageProps {
  params: Promise<{ id: string }>;
}

const statusOrder = Object.entries(LEAD_STATUS_CONFIG).sort(([, a], [, b]) => a.order - b.order);

export default async function LeadDetailPage({ params }: PageProps) {
  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      interacoes: { orderBy: { criadoEm: "desc" } },
      visitas: { orderBy: { agendadaPara: "asc" } },
      corretor: true,
      responsavel: { select: { nome: true, papel: true } },
      imovelInteresse: true,
      financiamentos: { select: { id: true, clienteNome: true, tipo: true, banco: true, status: true, criadoEm: true } },
      obras: { select: { id: true, nome: true, status: true, criadoEm: true } },
      projetos: { select: { id: true, nome: true, status: true, criadoEm: true } },
      regularizacoes: { select: { id: true, nome: true, status: true, criadoEm: true } },
      avaliacoes: { select: { id: true, numero: true, status: true, criadoEm: true } },
    },
  });

  if (!lead) notFound();

  const session = await auth();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";

  // Serviços do cliente = registros REAIS vinculados ao lead em cada módulo
  // (EPIC-007). Não há "desvincular": para remover, exclua o registro no módulo.
  type ServicoVinculado = { modulo: ModuloServico; id: string; titulo: string; status: string; criadoEm: Date };
  const servicosVinculados: ServicoVinculado[] = [
    ...lead.financiamentos.map((f) => ({ modulo: "financiamento" as const, id: f.id, titulo: `Financiamento ${f.tipo.toUpperCase()} · ${f.banco}`, status: f.status, criadoEm: f.criadoEm })),
    ...lead.obras.map((o) => ({ modulo: "obra" as const, id: o.id, titulo: o.nome, status: o.status, criadoEm: o.criadoEm })),
    ...lead.projetos.map((p) => ({ modulo: "projeto" as const, id: p.id, titulo: p.nome, status: p.status, criadoEm: p.criadoEm })),
    ...lead.regularizacoes.map((r) => ({ modulo: "regularizacao" as const, id: r.id, titulo: r.nome, status: r.status, criadoEm: r.criadoEm })),
    ...lead.avaliacoes.map((a) => ({ modulo: "avaliacao" as const, id: a.id, titulo: `Avaliação ${a.numero}`, status: a.status, criadoEm: a.criadoEm })),
  ].sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime());

  // Documentos vinculados a este lead via Jurídico (contratos gerados/assinados/anexos).
  const contratosComDocumentos = await prisma.contrato.findMany({
    where: { leadId: id },
    include: { documentos: { orderBy: { criadoEm: "desc" } } },
    orderBy: { criadoEm: "desc" },
  });

  const cfg = LEAD_STATUS_CONFIG[lead.status as LeadStatus] ?? {
    bgColor: "bg-gray-100",
    color: "text-gray-600",
    label: lead.status,
    order: 0,
  };
  function parseServicos(s: string): string[] { try { return JSON.parse(s); } catch { return [s]; } }
  const servicosLead = parseServicos(lead.servico);
  const whatsappMsg = encodeURIComponent(
    `Olá ${lead.nome}, aqui é da equipe do Grupo Santa Fé. Podemos conversar sobre ${servicosLead.join(", ")}?`
  );

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-start gap-4 flex-wrap">
        <BackButton className="mt-1" />
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase">{lead.nome}</h1>
            <span className={`text-xs font-bold px-2 py-0.5 uppercase ${cfg.bgColor} ${cfg.color}`}>{cfg.label}</span>
          </div>
          <p className="text-gray-400 text-sm mt-0.5">
            {servicosLead.join(", ")} · {lead.origem} · {lead.responsavel?.nome ?? "Sem responsável"}
          </p>
        </div>
      </div>

      {/* Status pipeline */}
      <div className="bg-white border border-gray-100 p-4 overflow-x-auto">
        <div className="flex items-center gap-0 min-w-max">
          {statusOrder
            .filter(([s]) => s !== "perdido")
            .map(([status, c], i, arr) => {
              const isActive = lead.status === status;
              const currentOrder = (LEAD_STATUS_CONFIG[lead.status as LeadStatus] ?? cfg).order;
              const isPast = c.order < currentOrder && lead.status !== "perdido";
              return (
                <div key={status} className="flex items-center">
                  <div className={`flex flex-col items-center px-3 py-1 ${isActive ? "opacity-100" : "opacity-50"}`}>
                    <div
                      className={`w-3 h-3 rounded-full border-2 ${
                        isActive
                          ? "border-[var(--brand-yellow)] bg-[var(--brand-yellow)]"
                          : isPast
                          ? "border-green-500 bg-green-500"
                          : "border-gray-300 bg-white"
                      }`}
                    />
                    <span className={`text-[10px] font-bold mt-1 uppercase ${isActive ? "text-[var(--brand-dark)]" : "text-gray-400"}`}>
                      {c.label}
                    </span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className={`h-0.5 w-8 ${isPast || isActive ? "bg-[var(--brand-yellow)]" : "bg-gray-200"}`} />
                  )}
                </div>
              );
            })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: info + interactions */}
        <div className="lg:col-span-2 space-y-5">
          {/* Contact info */}
          <div className="bg-white border border-gray-100 p-5">
            <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest mb-4 pb-2 border-b border-gray-100">
              Dados do Lead
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-2">
                <Phone size={14} className="text-[var(--brand-yellow)] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Telefone</p>
                  <p className="text-sm font-medium">{formatTelefone(lead.telefone)}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Mail size={14} className="text-[var(--brand-yellow)] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">E-mail</p>
                  <p className="text-sm font-medium">{lead.email ?? "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <UserCheck size={14} className="text-[var(--brand-yellow)] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Responsável</p>
                  <p className="text-sm font-medium">{lead.responsavel ? rotuloResponsavel(lead.responsavel) : "Sem responsável"}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <User size={14} className="text-[var(--brand-yellow)] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Corretor vinculado</p>
                  <p className="text-sm font-medium">{lead.corretor?.nome ?? "Sem corretor"}</p>
                </div>
              </div>
              {lead.orcamento && (
                <div className="flex items-start gap-2">
                  <span className="text-[var(--brand-yellow)] mt-0.5 text-sm shrink-0">R$</span>
                  <div>
                    <p className="text-xs text-gray-400">Budget</p>
                    <p className="text-sm font-bold">{formatCurrency(lead.orcamento)}</p>
                  </div>
                </div>
              )}
            </div>
            {lead.notas && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-1">Observações</p>
                <p className="text-sm text-gray-600 leading-relaxed">{lead.notas}</p>
              </div>
            )}
          </div>

          {/* Serviços do cliente — vínculo real com os módulos operacionais */}
          <div className="bg-white border border-gray-100 p-5">
            <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest mb-4 pb-2 border-b border-gray-100">
              Serviços do Cliente ({servicosVinculados.length})
            </h2>
            {servicosVinculados.length === 0 ? (
              <p className="text-xs text-gray-400 mb-3">
                Nenhum serviço operacional vinculado ainda. Marque o serviço no cadastro do lead ou vincule abaixo — os dados do cliente são copiados automaticamente.
              </p>
            ) : (
              <div className="divide-y divide-gray-50 border border-gray-100 mb-3">
                {servicosVinculados.map((sv) => (
                  <div key={`${sv.modulo}-${sv.id}`} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{MODULO_CONFIG[sv.modulo].label}</p>
                      <p className="text-sm font-medium text-[var(--brand-dark)] truncate">{sv.titulo}</p>
                      <p className="text-[11px] text-gray-400 capitalize">{sv.status.replace(/_/g, " ")}</p>
                    </div>
                    <Link
                      href={`${MODULO_CONFIG[sv.modulo].rota}/${sv.id}`}
                      className="shrink-0 flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-3 py-1.5 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 transition-opacity"
                    >
                      <ExternalLink size={11} /> Abrir
                    </Link>
                  </div>
                ))}
              </div>
            )}
            {isAdmin && (
              <div>
                <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                  <Link2 size={11} /> Vincular novo serviço
                </p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(MODULO_CONFIG) as ModuloServico[]).map((m) => (
                    <Link
                      key={m}
                      href={`${MODULO_CONFIG[m].novo}?leadId=${lead.id}`}
                      className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 border border-gray-200 text-gray-600 hover:border-[var(--brand-yellow)] hover:text-[var(--brand-dark)] transition-colors"
                    >
                      <Plus size={11} /> {MODULO_CONFIG[m].label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Interaction timeline */}
          <div className="bg-white border border-gray-100 p-5">
            <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest mb-4 pb-2 border-b border-gray-100">
              Histórico de Interações ({lead.interacoes.length})
            </h2>
            <div className="relative space-y-4">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-100" />
              {lead.interacoes.map((interacao) => {
                const icfg = INTERACTION_CONFIG[interacao.tipo as InteractionType] ?? {
                  label: interacao.tipo,
                  icon: "📝",
                };
                return (
                  <div key={interacao.id} className="relative flex gap-4 pl-10">
                    <div className="absolute left-0 w-8 h-8 bg-white border-2 border-gray-200 rounded-full flex items-center justify-center text-sm">
                      {icfg.icon}
                    </div>
                    <div className="flex-1 bg-gray-50 p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-bold text-[var(--brand-dark)] uppercase">{icfg.label}</span>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock size={10} />
                          {new Date(interacao.criadoEm).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">{interacao.descricao}</p>
                      <p className="text-xs text-gray-400 mt-1">por {interacao.criadoPor}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add interaction */}
          <div className="bg-white border border-gray-100 p-5">
            <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest mb-4 pb-2 border-b border-gray-100">
              Registrar Interação
            </h2>
            <AddInteractionForm leadId={lead.id} />
          </div>
        </div>

        {/* Right: sidebar */}
        <div className="space-y-4">
          {/* Quick actions */}
          <div className="bg-[var(--brand-dark)] p-5">
            <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-3">Contato Rápido</p>
            <div className="space-y-2">
              <a
                href={`tel:${lead.telefone}`}
                className="flex items-center gap-2 w-full bg-white/10 hover:bg-[var(--brand-yellow)] hover:text-[var(--brand-dark)] text-gray-300 font-bold text-xs uppercase tracking-wider py-2.5 px-3 transition-colors"
              >
                <Phone size={14} /> Ligar
              </a>
              <a
                href={`https://wa.me/55${lead.telefone.replace(/\D/g, "")}?text=${whatsappMsg}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white font-bold text-xs uppercase tracking-wider py-2.5 px-3 transition-colors"
              >
                <MessageSquare size={14} /> WhatsApp
              </a>
              <a
                href={`mailto:${lead.email}`}
                className="flex items-center gap-2 w-full bg-white/10 hover:bg-[var(--brand-yellow)] hover:text-[var(--brand-dark)] text-gray-300 font-bold text-xs uppercase tracking-wider py-2.5 px-3 transition-colors"
              >
                <Mail size={14} /> E-mail
              </a>
            </div>
          </div>

          {/* Alterar status */}
          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Alterar Status</p>
            <LeadStatusPicker leadId={lead.id} statusAtual={lead.status} />
          </div>

          {/* Visits */}
          {lead.visitas.length > 0 && (
            <div className="bg-white border border-gray-100 p-5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Visitas</p>
              {lead.visitas.map((visita) => (
                <div key={visita.id} className="border border-gray-100 p-3">
                  <div className="flex items-center gap-1 text-xs font-bold mb-1">
                    <Calendar size={11} className="text-[var(--brand-yellow)]" />
                    {new Date(visita.agendadaPara).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  <p className="text-xs text-gray-500">{visita.notas || visita.clienteNome}</p>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 uppercase mt-1 inline-block ${
                      visita.status === "realizada"
                        ? "bg-green-100 text-green-700"
                        : visita.status === "cancelada"
                        ? "bg-red-100 text-red-500"
                        : "bg-purple-100 text-purple-700"
                    }`}
                  >
                    {visita.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Agendar visita */}
          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Agendar Visita</p>
            <LeadAgendarVisita leadId={lead.id} />
          </div>

          {/* Documentos */}
          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Documentos</p>
            {contratosComDocumentos.length === 0 || contratosComDocumentos.every((c) => c.documentos.length === 0) ? (
              <div className="text-center py-4">
                <FileText size={22} className="text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400">
                  Nenhum documento vinculado a este lead ainda. Documentos gerados ou enviados em contratos do Jurídico aparecem aqui.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {contratosComDocumentos
                  .filter((c) => c.documentos.length > 0)
                  .map((c) => (
                    <div key={c.id} className="border border-gray-100">
                      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50">
                        <Link href={`/admin/juridico`} className="flex items-center gap-1 text-xs font-bold text-[var(--brand-dark)] hover:underline">
                          <ExternalLink size={10} /> Contrato {c.numero}
                        </Link>
                        <span className="text-[9px] text-gray-400 capitalize">{c.tipo.replace(/_/g, " ")}</span>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {c.documentos.map((doc) => (
                          <a
                            key={doc.id}
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 transition-colors"
                          >
                            <FileText size={12} className="text-gray-300 shrink-0" />
                            <span className="flex-1 min-w-0 truncate text-gray-600">{doc.nome}</span>
                            <Download size={11} className="text-gray-400 shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
