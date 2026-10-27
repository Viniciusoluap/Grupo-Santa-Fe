import { prisma } from "@/lib/db";
import type { CatalogoBpo, VinculoBpo } from "@/lib/bpo-operacional";

export async function catalogoOperacionalBpo(): Promise<CatalogoBpo> {
  const [obras, regularizacoes, comissoes, projetos, avaliacoes, imoveis, incorporacao, financiamentos, tarefas] = await Promise.all([
    prisma.obra.findMany({ select: { id: true, nome: true, clienteNome: true, leadId: true } }),
    prisma.regularizacao.findMany({ select: { id: true, nome: true, clienteNome: true, leadId: true } }),
    prisma.comissao.findMany({ select: { id: true, imovel: true } }),
    prisma.projeto.findMany({ select: { id: true, nome: true, clienteNome: true, leadId: true } }),
    prisma.avaliacao.findMany({ select: { id: true, numero: true, clienteNome: true, leadId: true } }),
    prisma.imovel.findMany({ select: { id: true, titulo: true } }),
    prisma.estudoIncorporacao.findMany({ select: { id: true, nome: true } }),
    prisma.financiamento.findMany({ select: { id: true, clienteNome: true, leadId: true } }),
    prisma.tarefaCrm.findMany({ select: { id: true, titulo: true, leadId: true, lead: { select: { nome: true } } } }),
  ]);
  const map = (rows: { id: string; nome?: string; titulo?: string; imovel?: string; numero?: string; clienteNome?: string; leadId?: string | null }[], rota: string): VinculoBpo[] => rows.map((r) => ({ id: r.id, rotulo: r.nome ?? r.titulo ?? r.imovel ?? r.numero ?? r.clienteNome ?? r.id, clienteNome: r.clienteNome ?? null, leadId: r.leadId ?? null, href: `${rota}/${r.id}` }));
  return { obras: map(obras, "/admin/obras"), regularizacoes: map(regularizacoes, "/admin/regularizacao"), comissoes: map(comissoes, "/admin/comissoes"), projetos: map(projetos, "/admin/projetos"), avaliacoes: map(avaliacoes, "/admin/avaliacoes"), imoveis: map(imoveis, "/admin/imoveis"), incorporacao: map(incorporacao, "/admin/incorporacao"), financiamentos: map(financiamentos, "/admin/financiamentos"), tarefas_agenda: tarefas.map((t) => ({ id: t.id, rotulo: t.titulo, clienteNome: t.lead.nome, leadId: t.leadId, href: `/admin/leads/${t.leadId}` })) };
}

export async function resolverVinculoBpo(tipo: string, categoria: string, id: string) {
  const catalogo = await catalogoOperacionalBpo();
  const chave = tipo === "despesa" && categoria === "comissoes" ? "imoveis" : categoria;
  const registro = catalogo[chave]?.find((r) => r.id === id);
  if (!registro) throw new Error("O registro operacional não existe mais. Atualize a lista.");
  return registro;
}
