import { prisma } from "@/lib/db";
import { NovoFinanciamentoForm } from "./novo-financiamento-form";

export default async function NovoFinanciamentoPage() {
  const [leads, imoveis] = await Promise.all([
    prisma.lead.findMany({
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, telefone: true, email: true },
    }),
    prisma.imovel.findMany({
      where: { publicadoSite: true },
      orderBy: { titulo: "asc" },
      select: { id: true, titulo: true, bairro: true, cidade: true },
    }),
  ]);

  return <NovoFinanciamentoForm leads={leads} imoveis={imoveis} />;
}
