import { prisma } from "@/lib/db";
import { calcularComissaoObra } from "@/lib/financeiro/comissao";
import { centavosDe, reaisDeCentavos } from "@/lib/financeiro/obra";

// Pedido de 15/10: obra com cliente no CRM tem VGV = Valor Aprovado do lead
// (fonte única). Gêmeo de sincronizarVgvDoLead da Prospecta
// (server/obra-financeiro-router.ts).

type Tx = Pick<typeof prisma, "lead" | "obra">;

/** Ao mudar os valores do lead, o VGV da obra acompanha o aprovado e a comissão usa o VGV simulado. */
export async function sincronizarVgvDoLead(leadId: string, tx: Tx = prisma) {
  const lead = await tx.lead.findUnique({
    where: { id: leadId },
    select: { valorAprovado: true, orcamento: true, corretor: { select: { id: true, nome: true, regraComissao: { select: { percentual: true } } } } },
  });
  if (!lead) return;
  const vgv = lead.valorAprovado?.toString() ?? null;
  const c = lead.corretor;
  const corretor = c ? { id: c.id, nome: c.nome, percentualPadrao: c.regraComissao?.percentual.toString() ?? null } : null;
  const obras = await tx.obra.findMany({ where: { leadId }, select: { id: true, comissaoPercentual: true } });
  for (const o of obras) {
    const calculada = calcularComissaoObra({ corretor, vgvCentavos: centavosDe(lead.orcamento?.toString() ?? null), percentualObra: o.comissaoPercentual?.toString() ?? null, pagoCentavos: 0 });
    await tx.obra.update({
      where: { id: o.id },
      data: {
        vgv,
        ...(corretor ? { comissaoValor: calculada.valorCentavos !== null ? reaisDeCentavos(calculada.valorCentavos) : null } : {}),
      },
    });
  }
}
