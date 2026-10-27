import { exigirModuloPagina } from "@/lib/auth/modulos";
import { prisma } from "@/lib/db";
import { ProjetosClient } from "./_components/projetos-client";

export default async function ProjetosPage() {
  await exigirModuloPagina("projetos");

  const projetos = await prisma.projeto.findMany({
    include: { _count: { select: { revisoes: { where: { status: "pendente" } } } } },
    orderBy: { criadoEm: "desc" },
  });

  return <ProjetosClient projetos={projetos} />;
}
