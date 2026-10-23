import { ChecklistDocumentos } from "@/components/documentos/checklist-documentos";
import { exigirModuloPagina } from "@/lib/auth/modulos";
import { notFound } from "next/navigation";
import { LEAD_TEMPERATURA_CONFIG, leadTemperaturaRotulo, type LeadTemperatura } from "@/lib/crm/temperatura-lead";
import Link from "next/link";
import { Phone, MessageSquare, Mail, Calendar, User, UserCheck, Clock, ExternalLink, AlertTriangle } from "lucide-react";
import { obterAtorCrm, autorizarLeadDoAtor } from "@/lib/crm/acesso-lead";
import { etapaDoLead, parseServicosLead, leadNoPipelineAtivo } from "@/lib/crm/pipeline";
import { BackButton } from "@/components/ui/back-button";
import { prisma } from "@/lib/db";
import { LEAD_STAGE_CONFIG, LEAD_STAGES, INTERACTION_CONFIG, InteractionType } from "@/lib/types/crm";
import { formatCurrency, formatTelefone } from "@/lib/utils";
import { MODULO_CONFIG, PARAM_FALHA_SERVICOS, parseFalhasServicos, type ModuloServico } from "@/lib/crm/servicos-lead";
import { rotuloResponsavel } from "@/lib/crm/responsavel";
import { AddInteractionForm } from "./add-interaction-form";
import { LeadStatusPicker } from "./lead-status-picker";
import { AdicionarOperacaoForm } from "./adicionar-operacao-form";
import { LeadAgendarVisita } from "./lead-agendar-visita";
import { LeadContratos } from "./lead-contratos";
import { usuarioAtual } from "@/lib/auth/modulos";
import { podeAcessarModulo } from "@/lib/perfis-acesso";
import { listarResponsaveis } from "@/lib/crm/vinculo-lead";
import { rotulo } from "@/lib/rotulos";


interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const statusOrder = LEAD_STAGES.map((s) => [s, LEAD_STAGE_CONFIG[s]] as const);

export default async function LeadDetailPage({ params, searchParams }: PageProps) {
  await exigirModuloPagina("leads");
  const ator = await obterAtorCrm();
  const { id } = await params;
  // Serviços cuja criação automática falhou no último cadastro/edição do lead.
  const falhasServicos = parseFalhasServicos((await searchParams)[PARAM_FALHA_SERVICOS]);

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      interacoes: { orderBy: { criadoEm: "desc" } },
      visitas: { orderBy: { agendadaPara: "asc" }, include: { corretor: { select: { nome: true } } } },
      corretor: true,
      responsavel: { select: { nome: true, papel: true } },
      imovelInteresse: true,
      financiamentos: { select: { id: true, clienteNome: true, tipo: true, banco: true, status: true, criadoEm: true } },
      obras: { select: { id: true, nome: true, status: true, criadoEm: true } },
      projetos: { select: { id: true, nome: true, status: true, criadoEm: true } },
      regularizacoes: { select: { id: true, nome: true, status: true, criadoEm: true } },
      avaliacoes: { select: { id: true, numero: true, status: true, criadoEm: true } },
      tarefas: { select: { id: true, titulo: true, status: true, criadoEm: true } },
    },
  });

  if (!lead) notFound();
  autorizarLeadDoAtor(ator, lead);

  const interno = ator.papel === "admin" || ator.papel === "colaborador";
  const etapa = etapaDoLead(lead);
  const ativo = leadNoPipelineAtivo(lead);

  // Serviços do cliente = registros REAIS vinculados ao lead em cada módulo
  // (EPIC-007). Não há "desvincular": para remover, exclua o registro no módulo.
  type ServicoVinculado = { modulo: ModuloServico; id: string; titulo: string; status: string; criadoEm: Date };
  const servicosVinculados: ServicoVinculado[] = [
    ...lead.financiamentos.map((f) => ({ modulo: "financiamento" as const, id: f.id, titulo: `Financiamento ${f.tipo.toUpperCase()} · ${f.banco ?? "Banco a configurar"}`, status: f.status, criadoEm: f.criadoEm })),
    ...lead.obras.map((o) => ({ modulo: "obra" as const, id: o.id, titulo: o.nome, status: o.status, criadoEm: o.criadoEm })),
    ...lead.projetos.map((p) => ({ modulo: "projeto" as const, id: p.id, titulo: p.nome, status: p.status, criadoEm: p.criadoEm })),
    ...lead.regularizacoes.map((r) => ({ modulo: "regularizacao" as const, id: r.id, titulo: r.nome, status: r.status, criadoEm: r.criadoEm })),
    ...lead.avaliacoes.map((a) => ({ modulo: "avaliacao" as const, id: a.id, titulo: `Avaliação ${a.numero}`, status: a.status, criadoEm: a.criadoEm })),
    ...lead.tarefas.map((t) => ({ modulo: "tarefa" as const, id: t.id, titulo: t.titulo, status: t.status, criadoEm: t.criadoEm })),
  ].sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime());

  // Item 10 (18/10): opções do agendamento de visita (responsável e corretor).
  const [usuariosResponsaveis, corretoresAtivos] = interno
    ? await Promise.all([
        listarResponsaveis(),
        prisma.corretor.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
      ])
    : [[], []];
  const responsaveisVisita = usuariosResponsaveis.map((u) => ({ id: u.id, label: rotuloResponsavel(u) }));

  const usuarioSessao = await usuarioAtual();
  const podeJuridico = !!usuarioSessao && podeAcessarModulo(usuarioSessao, "juridico");
  // Documentos vinculados a este lead via Jurídico (contratos gerados/assinados/anexos).
  const contratosComDocumentos = await prisma.contrato.findMany({
    where: { leadId: id },
    include: { documentos: { orderBy: { criadoEm: "desc" } } },
    orderBy: { criadoEm: "desc" },
  });

  const cfg = etapa ? LEAD_STAGE_CONFIG[etapa] : { bgColor: "bg-amber-100", color: "text-amber-800", label: "A CLASSIFICAR", order: -1 };
  const servicosLead = parseServicosLead(lead.servico);
  const whatsappMsg = encodeURIComponent(
    `Olá ${lead.nome}, aqui é da equipe do Grupo Santa Fé. Podemos conversar sobre ${servicosLead.join(", ")}?`
  );

  return (
    <div className="space-y-5 max-w-5xl min-w-0">
      {/* Header */}
      <div className="flex items-start gap-4 flex-wrap">
        <BackButton className="mt-1" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase break-words">
              {lead.temperatura === "fechado" && <span className="mr-2" title="Negócio fechado">{LEAD_TEMPERATURA_CONFIG.fechado.emoji}</span>}
              {lead.nome}
            </h1>
            <span className={`text-xs font-bold ${LEAD_TEMPERATURA_CONFIG[lead.temperatura as LeadTemperatura]?.color ?? "text-gray-500"}`}>{leadTemperaturaRotulo(lead.temperatura)}</span>
            <span className={`text-xs font-bold px-2 py-0.5 uppercase ${cfg.bgColor} ${cfg.color}`}>{lead.excluidoEm ? "EXCLUÍDO" : lead.arquivadoEm ? "ARQUIVADO" : !ativo ? "FORA DO PIPELINE" : cfg.label}</span>
          </div>
          <p className="text-gray-600 text-sm mt-0.5">
            {servicosLead.join(", ")} · {lead.origem} · {lead.responsavel?.nome ?? "Sem responsável"}
          </p>
        </div>
      </div>

      {falhasServicos.length > 0 && (
        <div role="alert" className="flex items-start gap-3 border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <p className="font-bold">
              O lead foi salvo, mas não foi possível criar o registro de:{" "}
              {falhasServicos.map((m) => MODULO_CONFIG[m].label).join(", ")}.
            </p>
            <p className="mt-1 text-amber-800">
              O serviço continua marcado no lead. Edite e salve o lead novamente para tentar de novo, ou abra o
              serviço em &quot;Vincular novo serviço&quot;.
            </p>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-600">Status comercial original: {lead.status}. Etapa operacional independente.</p>

      {ativo && <Link href={`/admin/leads/${lead.id}/editar`} className="inline-flex border border-gray-200 rounded-lg px-4 py-2 text-xs font-bold hover:border-[var(--brand-yellow)]">Editar lead</Link>}

      {/* Status pipeline */}
      <div className="bg-white border border-gray-100 p-4 overflow-x-auto">
        <div className="flex items-center gap-0 min-w-max">
          {statusOrder
            .map(([status, c], i, arr) => {
              const isActive = etapa === status && ativo;
              const currentOrder = cfg.order;
              const isPast = c.order < currentOrder && ativo;
              return (
                <div key={status} className="flex items-center">
                  <div className="flex flex-col items-center px-3 py-1">
                    <div
                      className={`w-3 h-3 rounded-full border-2 ${
                        isActive
                          ? "border-[var(--brand-yellow)] bg-[var(--brand-yellow)]"
                          : isPast
                          ? "border-green-500 bg-green-500"
                          : "border-gray-300 bg-white"
                      }`}
                    />
                    <span className={`text-[10px] font-bold mt-1 uppercase ${isActive ? "text-[var(--brand-dark)]" : "text-gray-600"}`}>
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
                  <p className="text-xs text-gray-600">Telefone</p>
                  <p className="text-sm font-medium">{formatTelefone(lead.telefone)}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Mail size={14} className="text-[var(--brand-yellow)] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-600">E-mail</p>
                  <p className="text-sm font-medium">{lead.email ?? "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <UserCheck size={14} className="text-[var(--brand-yellow)] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-600">Responsável</p>
                  <p className="text-sm font-medium">{lead.responsavel ? rotuloResponsavel(lead.responsavel) : "Sem responsável"}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <User size={14} className="text-[var(--brand-yellow)] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-600">Corretor vinculado</p>
                  <p className="text-sm font-medium">{lead.corretor?.nome ?? "Sem corretor"}</p>
                </div>
              </div>
              {lead.valorAprovado != null && (
                <div className="flex items-start gap-2">
                  <span className="text-[var(--brand-dark)] mt-0.5 text-sm shrink-0">R$</span>
                  <div>
                    <p className="text-xs text-gray-600">Valor financiado aprovado</p>
                    <p className="text-sm font-bold">{formatCurrency(Number(lead.valorAprovado))}</p>
                  </div>
                </div>
              )}
              {lead.orcamento && (
                <div className="flex items-start gap-2">
                  <span className="text-[var(--brand-dark)] mt-0.5 text-sm shrink-0">R$</span>
                  <div>
                    <p className="text-xs text-gray-600">VGV simulado</p>
                    <p className="text-sm font-bold">{formatCurrency(lead.orcamento)}</p>
                  </div>
                </div>
              )}
            </div>
            {lead.notas && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-600 mb-1">Observações</p>
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
              <p className="text-xs text-gray-600 mb-3">
                Nenhum serviço operacional vinculado ainda. Adicione o serviço pelo cadastro do CRM ou pelo formulário abaixo — os dados do cliente são copiados automaticamente.
              </p>
            ) : (
              <div className="divide-y divide-gray-50 border border-gray-100 mb-3">
                {servicosVinculados.map((sv) => (
                  <div key={`${sv.modulo}-${sv.id}`} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">{MODULO_CONFIG[sv.modulo].label}</p>
                      <p className="text-sm font-medium text-[var(--brand-dark)] truncate">{sv.titulo}</p>
                      <p className="text-[11px] text-gray-600">{rotulo(sv.status)}</p>
                    </div>
                    <Link
                      href={sv.modulo === "tarefa" ? "/admin/agenda" : `${MODULO_CONFIG[sv.modulo].rota}/${sv.id}`}
                      className="shrink-0 flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-3 py-1.5 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 transition-opacity"
                    >
                      <ExternalLink size={11} /> Abrir
                    </Link>
                  </div>
                ))}
              </div>
            )}
            {interno && ativo && <AdicionarOperacaoForm leadId={lead.id} servicos={servicosLead} />}
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
                        <div className="flex items-center gap-1 text-xs text-gray-600">
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
                      <p className="text-xs text-gray-600 mt-1">por {interacao.criadoPor}</p>
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
            <p className="text-gray-300 text-xs uppercase tracking-widest font-bold mb-3">Contato Rápido</p>
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
                className="flex items-center gap-2 w-full bg-green-700 hover:bg-green-800 text-white font-bold text-xs uppercase tracking-wider py-2.5 px-3 transition-colors"
              >
                <MessageSquare size={14} /> WhatsApp
              </a>
              <a
                href={`mailto:${lead.email}`}
                className="flex items-center gap-2 w-full bg-white/10 hover:bg-[var(--brand-yellow)] hover:text-[var(--brand-dark)] text-gray-500 font-bold text-xs uppercase tracking-wider py-2.5 px-3 transition-colors"
              >
                <Mail size={14} /> E-mail
              </a>
            </div>
          </div>

          {/* Alterar status */}
          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3">Etapa operacional</p>
            <LeadStatusPicker leadId={lead.id} statusAtual={lead.status} etapaOperacional={lead.etapaOperacional} atualizadoEm={lead.atualizadoEm.toISOString()} arquivadoEm={lead.arquivadoEm?.toISOString() ?? null} excluidoEm={lead.excluidoEm?.toISOString() ?? null} interno={interno} admin={ator.papel === "admin"} />
          </div>

          {/* Item 10 (18/10): agendamentos de visita do lead — os mesmos registros da Agenda. */}
          <div className="bg-white border border-gray-100 p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">Agendamento de visita</p>
              <Link href="/admin/agenda" className="text-xs font-bold text-[var(--brand-dark)] underline">Abrir na Agenda</Link>
            </div>
            {lead.visitas.length > 0 && (
              <div className="mb-4 space-y-2">
                {lead.visitas.map((visita) => (
                  <div key={visita.id} className="border border-gray-100 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-1 text-xs font-bold text-[var(--brand-dark)]">
                        <Calendar size={11} className="text-[var(--brand-dark)]" />
                        {new Date(visita.agendadaPara).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        {" · "}{rotulo(visita.tipoVisita)}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 uppercase ${visita.status === "realizada" ? "bg-green-100 text-green-800" : visita.status === "cancelada" ? "bg-red-100 text-red-700" : "bg-purple-100 text-purple-800"}`}>
                        {rotulo(visita.status)}
                      </span>
                    </div>
                    <p className="mt-1 break-words text-xs text-gray-700">
                      {[visita.colaboradorNome && `Responsável: ${visita.colaboradorNome}`, visita.corretor?.nome && `Corretor: ${visita.corretor.nome}`, visita.notas].filter(Boolean).join(" · ") || "Sem observações"}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {ativo ? (
              <LeadAgendarVisita leadId={lead.id} responsaveis={responsaveisVisita} corretores={corretoresAtivos} interno={interno} />
            ) : (
              <p className="text-xs text-gray-600">Agendamento disponível para leads ativos.</p>
            )}
          </div>

          {interno && <ChecklistDocumentos tipo="crm" id={lead.id} />}

          {/* Item 11 (18/10): contratos do cliente, criados e mantidos no Jurídico. */}
          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3">Contratos (Jurídico)</p>
            <LeadContratos
              leadId={lead.id}
              podeJuridico={podeJuridico}
              contratos={contratosComDocumentos.map((c) => ({
                id: c.id, numero: c.numero, tipo: c.tipo, status: c.status, assinaturaStatus: c.assinaturaStatus,
                documentos: c.documentos.map((d) => ({ id: d.id, nome: d.nome, url: d.url, tipo: d.tipo })),
              }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
