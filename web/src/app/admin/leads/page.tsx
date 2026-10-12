import { prisma } from "@/lib/db";
import { obterAtorCrm, escopoLeadsDoAtor } from "@/lib/crm/acesso-lead";
import { LeadsClient } from "./_components/leads-client";

export default async function LeadsPage() {
  const ator = await obterAtorCrm();
  const leads = await prisma.lead.findMany({
    where: escopoLeadsDoAtor(ator),
    orderBy: { criadoEm: "desc" },
    select: {
      id: true, nome: true, telefone: true, email: true, servico: true,
      status: true, temperatura: true, etapaOperacional: true, arquivadoEm: true, excluidoEm: true,
      origem: true, orcamento: true, notas: true, criadoEm: true, atualizadoEm: true, responsavelId: true,
      corretor: { select: { id: true, nome: true } },
      responsavel: { select: { id: true, nome: true } },
      visitas: { select: { id: true, status: true, agendadaPara: true } },
    },
  });
  return <LeadsClient leads={leads} />;
}
