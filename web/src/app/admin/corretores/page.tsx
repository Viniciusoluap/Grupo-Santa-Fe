import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { CorretoresClient } from "./_components/corretores-client";

export default async function AdminCorretoresPage() {
  const session = await auth();
  if ((session?.user as { role?: string })?.role !== "admin") redirect("/admin");
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
