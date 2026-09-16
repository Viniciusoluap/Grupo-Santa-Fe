import { auth } from "@/auth";
import { requirePageRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { ProjetosClient } from "./_components/projetos-client";

export default async function ProjetosPage() {
  const session = await auth();
  requirePageRole(session, "admin");

  const projetos = await prisma.projeto.findMany({
    orderBy: { criadoEm: "desc" },
  });

  return <ProjetosClient projetos={projetos} />;
}
