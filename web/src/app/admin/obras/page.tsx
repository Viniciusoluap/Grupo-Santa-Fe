import { prisma } from "@/lib/db";
import { ObrasClient } from "./_components/obras-client";

export default async function ObrasPage() {
  const obras = await prisma.obra.findMany({
    orderBy: { criadoEm: "desc" },
    include: { etapas: { orderBy: { ordem: "asc" } } },
  });

  return <ObrasClient obras={obras} />;
}
