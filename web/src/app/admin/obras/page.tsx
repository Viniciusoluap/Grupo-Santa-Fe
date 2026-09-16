import { auth } from "@/auth";
import { requirePageRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { ObrasClient } from "./_components/obras-client";

export default async function ObrasPage() {
  const session = await auth();
  requirePageRole(session, "admin");

  const obras = await prisma.obra.findMany({
    orderBy: { criadoEm: "desc" },
    include: { etapas: { orderBy: { ordem: "asc" } } },
  });

  return <ObrasClient obras={obras} />;
}
