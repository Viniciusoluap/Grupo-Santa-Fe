import { prisma } from "@/lib/db";
import { ComissoesClient } from "./_components/comissoes-client";

export default async function ComissoesPage() {
  const [comissoes, corretores, imoveis, obras, projetos, financiamentos, regularizacoes, avaliacoes, bpoClientes] = await Promise.all([
    prisma.comissao.findMany({
      orderBy: { vencimento: "desc" },
      include: { corretor: true, contrato: true },
    }),
    prisma.corretor.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    prisma.imovel.findMany({ select: { id: true, titulo: true }, orderBy: { titulo: "asc" } }),
    prisma.obra.findMany({ select: { id: true, nome: true, clienteNome: true }, orderBy: { nome: "asc" } }),
    prisma.projeto.findMany({ select: { id: true, nome: true, clienteNome: true }, orderBy: { nome: "asc" } }),
    prisma.financiamento.findMany({ select: { id: true, clienteNome: true }, orderBy: { clienteNome: "asc" } }),
    prisma.regularizacao.findMany({ select: { id: true, nome: true, clienteNome: true }, orderBy: { nome: "asc" } }),
    prisma.avaliacao.findMany({ select: { id: true, numero: true, clienteNome: true }, orderBy: { criadoEm: "desc" } }),
    prisma.bpoCliente.findMany({ select: { id: true, razaoSocial: true }, orderBy: { razaoSocial: "asc" } }),
  ]);

  const negociosPorTipo = {
    imovel: imoveis.map((i) => ({ id: i.id, label: i.titulo })),
    obra: obras.map((o) => ({ id: o.id, label: `${o.nome} — ${o.clienteNome}` })),
    projeto: projetos.map((p) => ({ id: p.id, label: `${p.nome} — ${p.clienteNome}` })),
    financiamento: financiamentos.map((f) => ({ id: f.id, label: f.clienteNome })),
    regularizacao: regularizacoes.map((r) => ({ id: r.id, label: `${r.nome} — ${r.clienteNome}` })),
    avaliacao: avaliacoes.map((a) => ({ id: a.id, label: `${a.numero} — ${a.clienteNome}` })),
    bpo: bpoClientes.map((b) => ({ id: b.id, label: b.razaoSocial })),
  };

  return <ComissoesClient comissoes={comissoes} corretores={corretores} negociosPorTipo={negociosPorTipo} />;
}
