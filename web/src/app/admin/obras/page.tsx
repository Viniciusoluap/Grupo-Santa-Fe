import { auth } from "@/auth";
import { progressoDaObra } from "@/lib/financeiro/progresso";
import { requirePageRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { ObrasClient } from "./_components/obras-client";

export default async function ObrasPage() {
  const session = await auth();
  requirePageRole(session, "admin");

  const registros = await prisma.obra.findMany({
    orderBy: { criadoEm: "desc" },
    include: { etapas: { orderBy: { ordem: "asc" } }, servicoLead: { select: { servico: true } } },
  });
  // Campos Decimal (EPIC-020 Lote 2) não atravessam para Client Components:
  // a lista recebe só o VGV como número para exibição.
  const obras = registros.map((o) => ({
    id: o.id, nome: o.nome, tipo: o.tipo, servicoLead: o.servicoLead, status: o.status,
    clienteNome: o.clienteNome, clienteTel: o.clienteTel, endereco: o.endereco, area: o.area,
    valorTotal: o.valorTotal, valorPago: o.valorPago, progresso: progressoDaObra(o.progressoMedido?.toString(), o.progresso), engenheiroResp: o.engenheiroResp,
    dataInicio: o.dataInicio, dataPrevisaoFim: o.dataPrevisaoFim, dataConclusao: o.dataConclusao, etapas: o.etapas,
    vgv: o.vgv == null ? null : Number(o.vgv),
  }));

  return <ObrasClient obras={obras} />;
}
