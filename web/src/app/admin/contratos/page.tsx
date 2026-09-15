import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { requirePageRole } from "@/lib/auth/rbac";
import ContratosClient from "./_components/contratos-client";

export default async function ContratosPage() {
  const session = await auth();
  requirePageRole(session, "admin");

  const contratos = await prisma.contrato.findMany({
    orderBy: { criadoEm: "desc" },
  });

  return (
    <ContratosClient
      contratos={contratos.map((c) => ({
        ...c,
      }))}
    />
  );
}
