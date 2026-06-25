import { prisma } from "@/lib/db";
import { NovaAvaliacaoForm } from "./nova-avaliacao-form";

export default async function NovaAvaliacaoPage() {
  const leads = await prisma.lead.findMany({
    select: { id: true, nome: true, telefone: true, email: true },
    orderBy: { nome: "asc" },
  });
  return <NovaAvaliacaoForm leads={leads} />;
}
