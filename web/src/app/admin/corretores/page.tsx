import { exigirModuloPagina } from "@/lib/auth/modulos";
import { prisma } from "@/lib/db";
import { CorretoresClient } from "./_components/corretores-client";

export default async function AdminCorretoresPage() {
  await exigirModuloPagina("corretores");
  const corretores = await prisma.corretor.findMany({
    orderBy: { nome: "asc" },
    include: {
      comissoes: true,
      leads: { select: { id: true } },
      imoveis: { select: { id: true } },
    },
  });

  return <CorretoresClient corretores={corretores} />;
}
