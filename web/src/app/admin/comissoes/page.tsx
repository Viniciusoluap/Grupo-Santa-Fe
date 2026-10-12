import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { ComissoesClient } from "./_components/comissoes-client";
import type { NegocioItem } from "@/lib/comissoes/calculo";
import { listarComissoesDeObras } from "@/lib/comissoes/obras";
import { ComissoesDeObras } from "./_components/comissoes-de-obras";

type SessionUser = { role?: string; corretorId?: string };

export default async function ComissoesPage() {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  const isAdmin = user?.role === "admin";
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
    prisma.obra.findMany({ select: { id: true, nome: true, clienteNome: true, vgv: true }, orderBy: { nome: "asc" } }),
  ]);
  const comissoesDeObras = isAdmin ? await listarComissoesDeObras() : [];

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
    obra: obras.map((o) => ({ id: o.id, label: `${o.nome} — ${o.clienteNome}`, valorBase: o.vgv == null ? null : Number(o.vgv) })),
    extra: [],
  };

  return (
    <div className="space-y-5">
      <ComissoesClient comissoes={comissoes} corretores={corretores} negociosPorTipo={negociosPorTipo} isAdmin={isAdmin} />
      {isAdmin && <ComissoesDeObras linhas={comissoesDeObras} />}
    </div>
  );
}
