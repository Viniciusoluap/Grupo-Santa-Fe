import { exigirModuloPagina } from "@/lib/auth/modulos";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ComissoesClient } from "./_components/comissoes-client";
import type { NegocioItem } from "@/lib/comissoes/calculo";
import { listarComissoesDeObras } from "@/lib/comissoes/obras";
import { ComissoesDeObras } from "./_components/comissoes-de-obras";

type SessionUser = { role?: string; corretorId?: string };

export default async function ComissoesPage() {
  const usuario = await exigirModuloPagina("comissoes");
  // O corretor vê as comissões no Portal do Corretor (igual à Prospecta).
  if (usuario.perfil === "corretor") redirect("/corretor/comissoes");
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  // Pedido de 17/10/2026: o colaborador com Comissões faz o mesmo que o admin.
  const isAdmin = user?.role === "admin" || user?.role === "colaborador";
  const isCorretor = user?.role === "corretor";
  const corretorId = user?.corretorId;

  const [comissoes, corretores, imoveis, financiamentos, obras] = await Promise.all([
    prisma.comissao.findMany({
      where: isCorretor && corretorId ? { corretorId } : {},
      orderBy: { vencimento: "desc" },
      include: { corretor: true, contrato: true },
    }),
    prisma.corretor.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    prisma.imovel.findMany({ select: { id: true, titulo: true, status: true, preco: true }, orderBy: { titulo: "asc" } }),
    prisma.financiamento.findMany({ select: { id: true, clienteNome: true, imovel: true, valorImovel: true }, orderBy: { clienteNome: "asc" } }),
    prisma.obra.findMany({ select: { id: true, nome: true, clienteNome: true, vgv: true, leadId: true, leadVinculado: { select: { valorAprovado: true } } }, orderBy: { nome: "asc" } }),
  ]);
  // Pedido de 15/10: o corretor também vê as comissões das obras dos leads dele.
  const comissoesDeObras = isAdmin ? await listarComissoesDeObras() : isCorretor && corretorId ? await listarComissoesDeObras(corretorId) : [];

  // Negócios pré-cadastrados por tipo de comissão (EPIC-008): o "Imóvel/negócio"
  // é sempre um registro real; `valorBase` alimenta o cálculo automático.
  const negociosPorTipo: Record<string, NegocioItem[]> = {
    venda: imoveis
      .filter((i) => ["venda", "lancamento", "vendido"].includes(i.status))
      .map((i) => ({ id: i.id, label: i.titulo, valorBase: i.preco })),
    aluguel: imoveis
      .filter((i) => ["locacao", "locado"].includes(i.status))
      .map((i) => ({ id: i.id, label: i.titulo, valorBase: i.preco })),
    financiamento: financiamentos.map((f) => ({
      id: f.id,
      label: f.imovel && f.imovel !== "A definir" ? `${f.clienteNome} — ${f.imovel}` : f.clienteNome,
      valorBase: f.valorImovel,
    })),
    // Base da comissão de obra é o VGV (item 32), não o valor total legado.
    obra: obras.map((o) => ({ id: o.id, label: `${o.nome} — ${o.clienteNome}`, valorBase: (() => { const v = o.leadId ? o.leadVinculado?.valorAprovado : o.vgv; return v == null ? null : Number(v); })() })),
    extra: [],
  };

  return (
    <div className="space-y-5">
      <ComissoesClient comissoes={comissoes} corretores={corretores} negociosPorTipo={negociosPorTipo} isAdmin={isAdmin} />
      {(isAdmin || isCorretor) && <ComissoesDeObras linhas={comissoesDeObras} somenteLeitura={!isAdmin} />}
    </div>
  );
}
