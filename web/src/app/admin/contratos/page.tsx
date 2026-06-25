import { prisma } from "@/lib/db";
import ContratosClient from "./_components/contratos-client";

export default async function ContratosPage() {
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
