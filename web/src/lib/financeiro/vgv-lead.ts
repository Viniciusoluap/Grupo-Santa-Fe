import { prisma } from "@/lib/db";
import { calcularComissaoObra } from "@/lib/financeiro/comissao";
import { centavosDe, reaisDeCentavos } from "@/lib/financeiro/obra";

// Obra com cliente no CRM tem VGV = VGV simulado do lead (campo `orcamento`),
// fonte única e base da comissão. O valor financiado aprovado é outro dado
// (financiamento), não o VGV — correção de 22/10. Gêmeo de sincronizarVgvDoLead da Prospecta
// (server/obra-financeiro-router.ts).

type Tx = Pick<typeof prisma, "lead" | "obra">;

/** Valor do VGV simulado do lead em texto decimal (R$ com 2 casas) ou null. */
export function vgvSimuladoDoLead(lead: { orcamento: number | string | null } | null | undefined): string | null {
  if (lead?.orcamento == null || lead.orcamento === "") return null;
  const n = Number(lead.orcamento);
  return Number.isFinite(n) ? n.toFixed(2) : null;
}

/** Ao mudar os valores do lead, o VGV da obra e a comissão acompanham o VGV simulado. */
export async function sincronizarVgvDoLead(leadId: string, tx: Tx = prisma) {
  const lead = await tx.lead.findUnique({
    where: { id: leadId },
    select: { orcamento: true, corretor: { select: { id: true, nome: true, regraComissao: { select: { percentual: true } } } } },
  });
  if (!lead) return;
  const vgv = vgvSimuladoDoLead(lead);
  const c = lead.corretor;
  const corretor = c ? { id: c.id, nome: c.nome, percentualPadrao: c.regraComissao?.percentual.toString() ?? null } : null;
  const obras = await tx.obra.findMany({ where: { leadId }, select: { id: true, comissaoPercentual: true } });
  for (const o of obras) {
    const calculada = calcularComissaoObra({ corretor, vgvCentavos: centavosDe(vgv), percentualObra: o.comissaoPercentual?.toString() ?? null, pagoCentavos: 0 });
    await tx.obra.update({
      where: { id: o.id },
      data: {
        vgv,
        ...(corretor ? { comissaoValor: calculada.valorCentavos !== null ? reaisDeCentavos(calculada.valorCentavos) : null } : {}),
      },
    });
  }
}
