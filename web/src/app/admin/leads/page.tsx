import { prisma } from "@/lib/db";
import { LeadsClient } from "./_components/leads-client";

export default async function LeadsPage() {
  const leads = await prisma.lead.findMany({
    orderBy: { criadoEm: "desc" },
    include: {
      corretor: true,
      imovelInteresse: true,
      visitas: true,
    },
  });

  return <LeadsClient leads={leads} />;
}
