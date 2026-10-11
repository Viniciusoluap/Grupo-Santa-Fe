import { auth } from "@/auth";
import { requirePageRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { NovaRegularizacaoForm } from "./nova-regularizacao-form";

export default async function NovoRegularizacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string }>;
}) {
  const { leadId } = await searchParams;
  const session = await auth();
  requirePageRole(session, "admin");

  const leads = await prisma.lead.findMany({
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, telefone: true, email: true },
  });

  return <NovaRegularizacaoForm leads={leads} leadIdInicial={leadId} />;
}
