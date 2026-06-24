import { prisma } from "@/lib/db";
import { NovaRegularizacaoForm } from "./nova-regularizacao-form";

export default async function NovoRegularizacaoPage() {
  const leads = await prisma.lead.findMany({
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, telefone: true, email: true },
  });

  return <NovaRegularizacaoForm leads={leads} />;
}
