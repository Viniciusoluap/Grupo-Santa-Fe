import { auth } from "@/auth";
import { BackButton } from "@/components/ui/back-button";
import { prisma } from "@/lib/db";
import { listarResponsaveis } from "@/lib/crm/vinculo-lead";
import { rotuloResponsavel } from "@/lib/crm/responsavel";
import { NovoLeadForm } from "./novo-lead-form";

export default async function NovoLeadPage() {
  const session = await auth();
  const [corretores, usuarios] = await Promise.all([
    prisma.corretor.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    listarResponsaveis(),
  ]);
  const responsaveis = usuarios.map((u) => ({ id: u.id, label: rotuloResponsavel(u) }));
  // Padrão: quem está cadastrando (se for um responsável válido).
  const sessaoId = session?.user?.id ?? null;
  const responsavelPadrao = responsaveis.some((r) => r.id === sessaoId) ? sessaoId : null;

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <BackButton />
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Novo Lead</h1>
      </div>

      <div className="bg-white border border-gray-100 p-6">
        <NovoLeadForm corretores={corretores} responsaveis={responsaveis} responsavelPadrao={responsavelPadrao} />
      </div>
    </div>
  );
}
