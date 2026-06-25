import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const user = session.user as { id?: string; role?: string };
  const usuarioId = user.id;
  const role = user.role;

  if (!usuarioId || role === "cliente") return NextResponse.json({ notificacoes: [], total: 0 });

  // Stored notifications for this user
  const stored = await prisma.notificacao.findMany({
    where: { usuarioId, lida: false },
    orderBy: { criadoEm: "desc" },
    take: 20,
  });

  // Computed: approaching deadlines (only for admin/colaborador)
  const computed: {
    id: string;
    tipo: string;
    titulo: string;
    mensagem: string;
    link: string | null;
    lida: boolean;
    criadoEm: string;
  }[] = [];

  if (role === "admin" || role === "colaborador") {
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
          mensagem: `${c.cliente?.razaoSocial ?? c.clienteNomeLivre ?? "Cliente"} — R$ ${c.valor.toFixed(2)} vence em ${new Date(c.vencimento).toLocaleDateString("pt-BR")}`,
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
  }

  const all = [
    ...stored.map((n) => ({ ...n, criadoEm: n.criadoEm.toISOString() })),
    ...computed,
  ];

  return NextResponse.json({ notificacoes: all, total: all.length });
}
