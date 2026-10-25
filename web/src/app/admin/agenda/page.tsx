import { exigirModuloPagina } from "@/lib/auth/modulos";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { AgendaClient } from "./_components/agenda-client";

type SessionUser = { role?: string; corretorId?: string };

export default async function AgendaPage() {
  await exigirModuloPagina("agenda");
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  const isCorretor = user?.role === "corretor";
  const corretorId = user?.corretorId;

  const visitasRaw = await prisma.visita.findMany({
    where: isCorretor && corretorId ? { corretorId } : {},
    include: { corretor: true, imovel: true, lead: { select: { responsavel: { select: { nome: true } } } } },
    orderBy: { agendadaPara: "asc" },
  });

  const corretores = await prisma.corretor.findMany({
    where: { ativo: true },
    select: { id: true, nome: true },
  });

  const imoveis = await prisma.imovel.findMany({
    select: { id: true, titulo: true },
  });

  const leads = await prisma.lead.findMany({
    select: { id: true, nome: true, telefone: true, responsavel: { select: { nome: true } } },
    orderBy: { nome: "asc" },
  });
  const vencimentos = isCorretor ? [] : await prisma.lead.findMany({
    where: { vencimentoCard: { not: null }, excluidoEm: null, arquivadoEm: null,
      NOT: { etapaOperacional: "finalizado" } },
    select: { id: true, nome: true, vencimentoCard: true, responsavel: { select: { nome: true } } },
  });
  const tarefas = isCorretor ? [] : await prisma.tarefaCrm.findMany({
    where: { lead: { excluidoEm: null, arquivadoEm: null } },
    select: { id: true, titulo: true, status: true, prazo: true, leadId: true, responsavelId: true,
      lead: { select: { nome: true, responsavel: { select: { nome: true } } } } }, orderBy: { criadoEm: "desc" },
  });
  const responsaveisTarefas = await prisma.usuario.findMany({
    where: { id: { in: tarefas.flatMap(t => t.responsavelId ? [t.responsavelId] : []) } },
    select: { id: true, nome: true },
  });
  const nomeResponsavelTarefa = new Map(responsaveisTarefas.map(u => [u.id, u.nome]));

  const visitas = visitasRaw.map((v) => ({
    id: v.id,
    tipoVisita: v.tipoVisita,
    clienteNome: v.clienteNome,
    clienteTel: v.clienteTel,
    agendadaPara: v.agendadaPara,
    status: v.status,
    notas: v.notas,
    corretorId: v.corretorId,
    corretor: v.corretor ? { id: v.corretor.id, nome: v.corretor.nome } : null,
    colaboradorNome: v.colaboradorNome,
    imovelId: v.imovelId,
    imovel: v.imovel ? { id: v.imovel.id, titulo: v.imovel.titulo } : null,
    leadId: v.leadId ?? null,
    responsavelLeadNome: v.lead?.responsavel?.nome ?? null,
  }));

  return (
    <AgendaClient
      visitas={visitas}
      corretores={corretores}
      imoveis={imoveis}
      leads={leads}
      vencimentos={vencimentos}
      tarefas={tarefas.map(t => ({ ...t, responsavelNome: (t.responsavelId ? nomeResponsavelTarefa.get(t.responsavelId) : null) ?? t.lead.responsavel?.nome ?? null }))}
      ehCorretor={isCorretor}
    />
  );
}
