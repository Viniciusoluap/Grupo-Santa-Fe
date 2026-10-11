import { auth } from "@/auth";
import { requirePageRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { NovaAvaliacaoForm } from "./nova-avaliacao-form";

export default async function NovaAvaliacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string }>;
}) {
  const session = await auth();
  requirePageRole(session, "admin");
  const { leadId } = await searchParams;

  const leads = await prisma.lead.findMany({
    select: { id: true, nome: true, telefone: true, email: true },
    orderBy: { nome: "asc" },
  });
  return <NovaAvaliacaoForm leads={leads} leadIdInicial={leadId} />;
}
