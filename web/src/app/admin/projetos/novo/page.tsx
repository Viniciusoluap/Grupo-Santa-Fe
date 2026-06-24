import { prisma } from "@/lib/db";
import { NovoProjetoForm } from "./novo-projeto-form";

export default async function NovoProjetoPage() {
  const leads = await prisma.lead.findMany({
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, telefone: true, email: true },
  });

  return <NovoProjetoForm leads={leads} />;
}
