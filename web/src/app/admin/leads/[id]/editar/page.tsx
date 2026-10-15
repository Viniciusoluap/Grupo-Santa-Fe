import { exigirModuloPagina } from "@/lib/auth/modulos";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/ui/back-button";
import { obterAtorCrm, autorizarLeadDoAtor } from "@/lib/crm/acesso-lead";
import { leadNoPipelineAtivo } from "@/lib/crm/pipeline";
import { prisma } from "@/lib/db";
import { listarResponsaveis } from "@/lib/crm/vinculo-lead";
import { rotuloResponsavel } from "@/lib/crm/responsavel";
import { EditarLeadForm } from "../editar-lead-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarLeadPage({ params }: PageProps) {
  await exigirModuloPagina("leads");
  const ator = await obterAtorCrm();
  const { id } = await params;
  const [lead, corretores, usuarios] = await Promise.all([
    prisma.lead.findUnique({ where: { id } }),
    prisma.corretor.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    listarResponsaveis(),
  ]);
  const responsaveis = usuarios.map((u) => ({ id: u.id, label: rotuloResponsavel(u) }));

  if (!lead) notFound();
  // Item 04: responsável antigo fora da regra (ex.: corretor) continua visível até ser trocado.
  if (lead.responsavelId && !responsaveis.some((r) => r.id === lead.responsavelId)) {
    const anterior = await prisma.usuario.findUnique({ where: { id: lead.responsavelId }, select: { nome: true, papel: true } });
    responsaveis.push({ id: lead.responsavelId, label: `Registro anterior: ${anterior ? rotuloResponsavel(anterior) : "usuário removido"}` });
  }
  autorizarLeadDoAtor(ator, lead);
  if (!leadNoPipelineAtivo(lead)) notFound();

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <BackButton />
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Editar Lead</h1>
      </div>
      <div className="bg-white border border-gray-100 p-6">
        <EditarLeadForm lead={{ id: lead.id, nome: lead.nome, telefone: lead.telefone, email: lead.email, servico: lead.servico, status: lead.status, etapaOperacional: lead.etapaOperacional, atualizadoEm: lead.atualizadoEm, origem: lead.origem, temperatura: lead.temperatura, orcamento: lead.orcamento, valorAprovado: lead.valorAprovado == null ? null : Number(lead.valorAprovado), notas: lead.notas, corretorId: lead.corretorId, responsavelId: lead.responsavelId }} corretores={corretores} responsaveis={responsaveis} />
      </div>
    </div>
  );
}
