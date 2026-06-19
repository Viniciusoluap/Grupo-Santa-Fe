import { BackButton } from "@/components/ui/back-button";
import { prisma } from "@/lib/db";
import { NovoLeadForm } from "./novo-lead-form";

export default async function NovoLeadPage() {
  const corretores = await prisma.corretor.findMany({
    where: { ativo: true },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <BackButton />
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Novo Lead</h1>
      </div>

      <div className="bg-white border border-gray-100 p-6">
        <NovoLeadForm corretores={corretores} />
      </div>
    </div>
  );
}
