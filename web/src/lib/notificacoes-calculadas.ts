import "server-only";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";

export type AlertaCalculado = {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  link: string | null;
  lida: boolean;
  criadoEm: string;
};

/**
 * Alertas que não ficam gravados (cobranças do BPO e prazos de obra nos próximos
 * 3 dias). Usado pelo sino (/api/notificacoes) e pela página "Ver todas" (H4).
 * Só para admin/colaborador — quem chama decide.
 */
export async function alertasCalculados(): Promise<AlertaCalculado[]> {
  const computed: AlertaCalculado[] = [];
  const hoje = new Date();
  const em3dias = new Date(hoje.getTime() + 3 * 24 * 60 * 60 * 1000);

  try {
    // BPO cobranças vencendo em 3 dias
    const cobrancas = await prisma.bpoLancamento.findMany({
      where: { pago: false, vencimento: { lte: em3dias, gte: hoje } },
      include: { cliente: { select: { razaoSocial: true } } },
      take: 5,
    });
    for (const c of cobrancas) {
      computed.push({
        id: `cobranca-${c.id}`,
        tipo: "cobranca_vencendo",
        titulo: "Cobrança vencendo",
        mensagem: `${c.cliente?.razaoSocial ?? c.clienteNomeLivre ?? "Cliente"} — ${formatCurrency(c.valor)} vence em ${new Date(c.vencimento).toLocaleDateString("pt-BR")}`,
        link: "/admin/bpo",
        lida: false,
        criadoEm: new Date().toISOString(),
      });
    }
  } catch {
    // Table may not exist yet — ignore
  }

  try {
    // Obras com prazo próximo
    const obras = await prisma.obra.findMany({
      where: {
        status: { notIn: ["concluida", "cancelada"] },
        dataPrevisaoFim: { lte: em3dias, gte: hoje },
      },
      select: { id: true, nome: true, dataPrevisaoFim: true },
      take: 5,
    });
    for (const o of obras) {
      computed.push({
        id: `obra-${o.id}`,
        tipo: "prazo_obra",
        titulo: "Prazo de obra próximo",
        mensagem: `${o.nome} vence em ${new Date(o.dataPrevisaoFim!).toLocaleDateString("pt-BR")}`,
        link: "/admin/obras",
        lida: false,
        criadoEm: new Date().toISOString(),
      });
    }
  } catch {
    // Ignore
  }

  return computed;
}
