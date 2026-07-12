import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { AgendaClient } from "./_components/agenda-client";

type SessionUser = { role?: string; corretorId?: string };

export default async function AgendaPage() {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  const isCorretor = user?.role === "corretor";
  const corretorId = user?.corretorId;

  const visitasRaw = await prisma.visita.findMany({
    where: isCorretor && corretorId ? { corretorId } : {},
    include: { corretor: true, imovel: true },
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
    select: { id: true, nome: true, telefone: true },
    orderBy: { nome: "asc" },
  });

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
  }));

  return (
    <AgendaClient
      visitas={visitas}
      corretores={corretores}
      imoveis={imoveis}
      leads={leads}
    />
  );
}
