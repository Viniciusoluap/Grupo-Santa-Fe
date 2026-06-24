import { prisma } from "@/lib/db";
import { NovaObraForm } from "./nova-obra-form";

export default async function NovaObraPage() {
  const leads = await prisma.lead.findMany({
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, telefone: true, email: true },
  });

  return <NovaObraForm leads={leads} />;
}
