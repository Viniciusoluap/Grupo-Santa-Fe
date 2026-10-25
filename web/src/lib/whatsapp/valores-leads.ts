import "server-only";
import { prisma } from "@/lib/db";
import { parseServicosLead } from "@/lib/crm/servicos-lead";
import { rotulo } from "@/lib/rotulos";
import { montarValoresLead, type LeadParaTemplate } from "./valores-lead-regra";

/**
 * Pedido de 25/10: valores das variáveis dos templates para cada lead. Gêmeo de `valoresDosLeads`
 * em Prospecta/server/whatsapp-router.ts; {{horario}}/{{documentos}} e o que faltar vêm dos campos da tela.
 */
export async function valoresDosLeads(ids: string[], remetente: string | null): Promise<Map<string, Record<string, string>>> {
  const out = new Map<string, Record<string, string>>();
  if (!ids.length) return out;
  const leads = await prisma.lead.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, nome: true, servico: true,
      corretor: { select: { nome: true } },
      responsavel: { select: { nome: true } },
      imovelInteresse: { select: { titulo: true, rua: true, bairro: true } },
      financiamentos: {
        orderBy: { criadoEm: "desc" }, take: 1,
        select: { imovel: true, banco: true, imovelVinculado: { select: { titulo: true, rua: true, bairro: true } } },
      },
      obras: { orderBy: { criadoEm: "desc" }, take: 1, select: { endereco: true } },
    },
  });
  for (const l of leads) {
    const fin = l.financiamentos[0];
    const dados: LeadParaTemplate = {
      nome: l.nome,
      servicos: parseServicosLead(l.servico),
      corretor: l.corretor?.nome ?? l.responsavel?.nome ?? null,
      imovelFinanciamento: fin?.imovel ?? fin?.imovelVinculado?.titulo ?? null,
      imovelInteresse: l.imovelInteresse?.titulo ?? null,
      banco: fin?.banco ? rotulo(fin.banco) : null,
      enderecoImovel: fin?.imovelVinculado ?? l.imovelInteresse ?? null,
      enderecoObra: l.obras[0]?.endereco ?? null,
    };
    out.set(l.id, montarValoresLead(dados, remetente));
  }
  return out;
}
