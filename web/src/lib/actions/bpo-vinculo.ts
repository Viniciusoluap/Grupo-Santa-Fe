"use server";
// Lote 3, item 17 (29/10/2026): vincular lançamentos "Cadastro livre" a clientes do CRM.
// Regra pura em src/lib/bpo-vinculo-cliente.ts. Gêmeo da Prospecta: server/bpo-vinculo-cliente.ts.
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { exigirModuloAcao } from "@/lib/auth/modulos";
import { catalogoOperacionalBpo } from "@/lib/bpo-catalogo";
import { normalizarTitular } from "@/lib/bpo-categorias";
import { ehDespesa } from "@/lib/bpo-categorias";
import { montarCandidatos, sugerirClientesParaLancamento, type CandidatoCliente, type ResultadoSugestao } from "@/lib/bpo-vinculo-cliente";
import type { CatalogoBpo } from "@/lib/bpo-operacional";

type LancamentoLivre = Awaited<ReturnType<typeof lancamentosLivres>>[number];

async function carregarCandidatos(): Promise<CandidatoCliente[]> {
  const [clientes, leads] = await Promise.all([
    prisma.bpoCliente.findMany({ select: { id: true, razaoSocial: true, cpf: true, cnpj: true, telefone: true, leadId: true } }),
    prisma.lead.findMany({ where: { excluidoEm: null }, select: { id: true, nome: true, cpf: true, telefone: true } }),
  ]);
  return montarCandidatos(clientes, leads);
}

function lancamentosLivres(ids?: string[]) {
  return prisma.bpoLancamento.findMany({
    where: { clienteId: null, combinadaEmId: null, ...(ids ? { id: { in: ids } } : {}) },
    select: { id: true, version: true, clienteNomeLivre: true, descricao: true, tipo: true, categoriaOperacional: true, vinculoOperacionalId: true, transacao: { select: { titular: true, bpoClienteId: true } } },
  });
}

async function regrasPorTitular(titulares: (string | null | undefined)[]) {
  const nomes = Array.from(new Set(titulares.map(normalizarTitular).filter((n) => n.length >= 3)));
  if (!nomes.length) return new Map<string, string>();
  const r = await prisma.bpoRegraTitular.findMany({ where: { titularNormalizado: { in: nomes }, bpoClienteId: { not: null } }, select: { titularNormalizado: true, bpoClienteId: true } });
  return new Map(r.map((x) => [x.titularNormalizado, x.bpoClienteId!]));
}

function sugerir(l: LancamentoLivre, candidatos: CandidatoCliente[], catalogo: CatalogoBpo, regras: Map<string, string>): ResultadoSugestao {
  const chave = ehDespesa(l.tipo) && l.categoriaOperacional === "comissoes" ? "imoveis" : l.categoriaOperacional ?? "";
  const registro = catalogo[chave]?.find((r) => r.id === l.vinculoOperacionalId);
  const titular = l.transacao?.titular ?? null;
  return sugerirClientesParaLancamento({
    leadIds: [registro?.leadId],
    clienteIdsIntegracao: [l.transacao?.bpoClienteId, regras.get(normalizarTitular(titular))],
    nome: l.clienteNomeLivre || titular,
    textos: [l.clienteNomeLivre, l.descricao, titular],
  }, candidatos);
}

export async function sugestoesClienteLancamento(id: string) {
  await exigirModuloAcao("bpo");
  const [l] = await lancamentosLivres([id]);
  if (!l) return { lancamentoId: id, sugestoes: [], automatico: null, ambiguo: false };
  const [candidatos, catalogo, regras] = await Promise.all([carregarCandidatos(), catalogoOperacionalBpo(), regrasPorTitular([l.transacao?.titular])]);
  return { lancamentoId: id, ...sugerir(l, candidatos, catalogo, regras) };
}

export async function buscarClientesELeadsBpo(q: string) {
  await exigirModuloAcao("bpo");
  const termo = q.trim();
  if (termo.length < 2) return [];
  const digitos = termo.replace(/\D/g, "");
  const [clientes, leads] = await Promise.all([
    prisma.bpoCliente.findMany({ where: { razaoSocial: { contains: termo, mode: "insensitive" } }, select: { id: true, razaoSocial: true }, take: 10, orderBy: { razaoSocial: "asc" } }),
    prisma.lead.findMany({ where: { excluidoEm: null, OR: [{ nome: { contains: termo, mode: "insensitive" } }, ...(digitos.length >= 4 ? [{ telefone: { contains: digitos } }] : [])] }, select: { id: true, nome: true, telefone: true }, take: 20, orderBy: { nome: "asc" } }),
  ]);
  return [
    ...clientes.map((c) => ({ tipo: "cliente" as const, id: c.id, nome: c.razaoSocial, detalhe: "BPO" })),
    ...leads.map((l) => ({ tipo: "lead" as const, id: l.id, nome: l.nome, detalhe: `Lead · ${l.telefone}` })),
  ];
}

export async function previaVinculosEmMassa() {
  await exigirModuloAcao("bpo");
  const livres = (await lancamentosLivres()).filter((l) => (l.clienteNomeLivre ?? l.transacao?.titular ?? "").trim() || l.vinculoOperacionalId);
  const [candidatos, catalogo, regras] = await Promise.all([carregarCandidatos(), catalogoOperacionalBpo(), regrasPorTitular(livres.map((l) => l.transacao?.titular))]);
  const itens = livres.map((l) => {
    const r = sugerir(l, candidatos, catalogo, regras);
    return { lancamentoId: l.id, version: l.version, nome: l.clienteNomeLivre || l.transacao?.titular || "—", descricao: l.descricao, automatico: r.automatico, ambiguo: r.ambiguo, sugestoes: r.sugestoes.slice(0, 3) };
  }).filter((i) => i.sugestoes.length);
  return { analisados: livres.length, comSugestao: itens.length, automaticos: itens.filter((i) => i.automatico).length, itens };
}

type Alvo = { clienteId?: string | null; leadId?: string | null };

async function vincular(input: { id: string; version: number; motivo: string } & Alvo, usuarioId: string | null) {
  if (!input.clienteId && !input.leadId) throw new Error("Escolha um cliente ou lead.");
  return prisma.$transaction(async (tx) => {
    const antes = await tx.bpoLancamento.findUnique({ where: { id: input.id } });
    if (!antes || antes.version !== input.version) throw new Error("O lançamento foi alterado por outra pessoa. Atualize a tela.");
    let clienteId = input.clienteId ?? null;
    let criado = false;
    if (clienteId) {
      if (!(await tx.bpoCliente.findUnique({ where: { id: clienteId }, select: { id: true } }))) throw new Error("Cliente BPO não encontrado.");
    } else {
      await tx.$queryRaw`SELECT 1::int AS locked FROM pg_advisory_xact_lock(hashtext('bpo_importacao_crm'))`;
      const lead = await tx.lead.findFirst({ where: { id: input.leadId!, excluidoEm: null }, select: { id: true, nome: true, cpf: true, telefone: true, email: true } });
      if (!lead) throw new Error("Lead não encontrado.");
      const doLead = await tx.bpoCliente.findUnique({ where: { leadId: lead.id }, select: { id: true } });
      if (doLead) clienteId = doLead.id;
      else {
        const doc = (lead.cpf ?? "").replace(/\D/g, "");
        const livres = doc.length >= 11 ? (await tx.bpoCliente.findMany({ where: { leadId: null }, select: { id: true, cpf: true, cnpj: true } }))
          .filter((c) => (c.cpf ?? "").replace(/\D/g, "") === doc || (c.cnpj ?? "").replace(/\D/g, "") === doc) : [];
        if (livres.length === 1) {
          clienteId = livres[0].id;
          await tx.bpoCliente.update({ where: { id: clienteId }, data: { leadId: lead.id } });
        } else {
          const novo = await tx.bpoCliente.create({ data: { leadId: lead.id, razaoSocial: lead.nome.slice(0, 255), responsavel: lead.nome.slice(0, 255), cpf: lead.cpf, email: lead.email, telefone: lead.telefone.slice(0, 30), honorarios: 0, diaVencimento: 10, dataInicio: new Date(), observacoes: "Criado ao vincular lançamento do BPO" }, select: { id: true } });
          clienteId = novo.id; criado = true;
        }
      }
    }
    const r = await tx.bpoLancamento.updateMany({ where: { id: antes.id, version: antes.version }, data: { clienteId, clienteNomeLivre: null, version: { increment: 1 } } });
    if (!r.count) throw new Error("O lançamento foi alterado por outra pessoa. Atualize a tela.");
    const depois = await tx.bpoLancamento.findUniqueOrThrow({ where: { id: antes.id } });
    await tx.bpoLancamentoHistorico.create({ data: { lancamentoId: antes.id, lancamentoReferencia: antes.id, versaoAnterior: antes.version, alteradoPorUsuarioId: usuarioId, motivo: `Vínculo com cliente do CRM: ${input.motivo}`.slice(0, 1000), antesJson: JSON.stringify(antes), depoisJson: JSON.stringify(depois) } });
    return { lancamentoId: antes.id, clienteId: clienteId!, clienteCriado: criado, version: depois.version };
  });
}

/** Confirmação manual na edição do lançamento. Retorna `{ erro }` em vez de lançar. */
export async function vincularClienteLancamento(input: { id: string; version: number; motivo?: string } & Alvo) {
  try {
    const u = await exigirModuloAcao("bpo");
    const r = await vincular({ ...input, motivo: input.motivo?.trim() || "confirmado na edição do lançamento" }, u.id);
    revalidatePath("/admin/bpo");
    return r;
  } catch (e) { return { erro: e instanceof Error ? e.message : "Falha ao vincular." }; }
}

export async function aplicarVinculosEmMassa(itens: ({ id: string; version: number } & Alvo)[]) {
  const u = await exigirModuloAcao("bpo");
  if (!Array.isArray(itens) || !itens.length || itens.length > 500) return { erro: "Selecione de 1 a 500 lançamentos." };
  let vinculados = 0;
  const falhas: { lancamentoId: string; motivo: string }[] = [];
  for (const item of itens) {
    try { await vincular({ ...item, motivo: "sugestão em massa confirmada" }, u.id); vinculados++; }
    catch (e) { falhas.push({ lancamentoId: item.id, motivo: e instanceof Error ? e.message : "Falha ao vincular." }); }
  }
  revalidatePath("/admin/bpo");
  return { vinculados, falhas };
}
