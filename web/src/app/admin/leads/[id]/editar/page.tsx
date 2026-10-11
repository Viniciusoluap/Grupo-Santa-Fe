import { notFound } from "next/navigation";
import { BackButton } from "@/components/ui/back-button";
import { prisma } from "@/lib/db";
import { listarResponsaveis } from "@/lib/crm/vinculo-lead";
import { rotuloResponsavel } from "@/lib/crm/responsavel";
import { EditarLeadForm } from "../editar-lead-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarLeadPage({ params }: PageProps) {
  const { id } = await params;
  const [lead, corretores, usuarios] = await Promise.all([
    prisma.lead.findUnique({ where: { id } }),
    prisma.corretor.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    listarResponsaveis(),
  ]);
  const responsaveis = usuarios.map((u) => ({ id: u.id, label: rotuloResponsavel(u) }));

  if (!lead) notFound();

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <BackButton />
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Editar Lead</h1>
      </div>
      <div className="bg-white border border-gray-100 p-6">
        <EditarLeadForm lead={lead} corretores={corretores} responsaveis={responsaveis} />
      </div>
    </div>
  );
}
