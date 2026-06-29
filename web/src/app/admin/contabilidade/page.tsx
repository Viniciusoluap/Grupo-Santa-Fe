import { auth } from "@/auth";
import { requirePageRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { ContabilidadeClient } from "./_components/contabilidade-client";

export default async function ContabilidadePage() {
  const session = await auth();
  requirePageRole(session, "admin");

  const lancamentos = await prisma.lancamento.findMany({
    orderBy: { data: "desc" },
  });
  return <ContabilidadeClient lancamentos={lancamentos} />;
}
