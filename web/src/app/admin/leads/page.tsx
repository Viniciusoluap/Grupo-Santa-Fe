import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { LeadsClient } from "./_components/leads-client";

type SessionUser = { role?: string; corretorId?: string };

export default async function LeadsPage() {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  const isCorretor = user?.role === "corretor";
  const corretorId = user?.corretorId;

  const leads = await prisma.lead.findMany({
    where: isCorretor && corretorId ? { corretorId } : {},
    orderBy: { criadoEm: "desc" },
    include: {
      corretor: true,
      imovelInteresse: true,
      visitas: true,
    },
  });

  return <LeadsClient leads={leads} />;
}
