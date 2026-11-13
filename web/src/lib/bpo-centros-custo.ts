// Paridade BPO (13/11): cadastro de centros de custo do BPO (listar, criar, renomear, ativar/desativar).
// Gêmeo de Prospecta/server/bpo-centros-custo.ts. O lançamento continua guardando o nome em texto
// (bpo_lancamentos."centroCustos"; "A / B" = dois centros), então renomear também atualiza os lançamentos — só a
// parte correspondente nos combinados. Regras em src/lib/financeiro/centros-custo.ts.
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { centrosDoLancamento, chaveCentro, normalizarNomeCentro, renomearCentroNoTexto } from "@/lib/financeiro/centros-custo";

/** Centros com quantos lançamentos usam cada um. */
export async function listarCentrosCusto() {
  const [centros, usados] = await Promise.all([
    prisma.bpoCentroCusto.findMany({ orderBy: { nome: "asc" } }),
    prisma.bpoLancamento.groupBy({ by: ["centroCustos"], where: { centroCustos: { not: null } }, _count: { _all: true } }),
  ]);
  const uso = new Map<string, number>();
  for (const u of usados) for (const c of centrosDoLancamento(u.centroCustos)) uso.set(chaveCentro(c), (uso.get(chaveCentro(c)) ?? 0) + u._count._all);
  return centros.map((c) => ({ id: c.id, nome: c.nome, ativo: c.ativo, lancamentos: uso.get(chaveCentro(c.nome)) ?? 0 }));
}

function validarNome(nome: string) {
  const n = normalizarNomeCentro(nome);
  if (n.length < 2) throw new Error("Informe o nome do centro de custo.");
  if (n.includes("/")) throw new Error("O nome não pode ter \"/\" (é o separador de dois centros no mesmo lançamento).");
  return n;
}

const unico = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
  || /unique|duplicate|23505/i.test(e instanceof Error ? e.message : String(e));

export async function criarCentroCusto(nome: string) {
  const n = validarNome(nome);
  const todos = await prisma.bpoCentroCusto.findMany({ select: { nome: true } });
  const igual = todos.find((c) => chaveCentro(c.nome) === chaveCentro(n));
  if (igual) throw new Error(`Já existe o centro de custo "${igual.nome}".`);
  try {
    return await prisma.bpoCentroCusto.create({ data: { nome: n } });
  } catch (e) {
    // O índice único (sem maiúsculas/acentos) barra a corrida entre dois cadastros iguais.
    if (unico(e)) throw new Error(`Já existe um centro de custo com o nome "${n}".`);
    throw e;
  }
}

export async function ativarCentroCusto(id: string, ativo: boolean) {
  const r = await prisma.bpoCentroCusto.updateMany({ where: { id }, data: { ativo } });
  if (!r.count) throw new Error("Centro de custo não encontrado.");
  return prisma.bpoCentroCusto.findUniqueOrThrow({ where: { id } });
}

/** Renomeia o centro e os lançamentos que o usam (inclusive arquivados e combinados "A / B"), numa transação. */
export async function renomearCentroCusto(id: string, novoNome: string) {
  const n = validarNome(novoNome);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1::int AS locked FROM pg_advisory_xact_lock(hashtext('bpo_centros_custo'))`;
    const c = await tx.bpoCentroCusto.findUnique({ where: { id } });
    if (!c) throw new Error("Centro de custo não encontrado.");
    const todos = await tx.bpoCentroCusto.findMany({ select: { id: true, nome: true } });
    const igual = todos.find((x) => x.id !== id && chaveCentro(x.nome) === chaveCentro(n));
    if (igual) throw new Error(`Já existe o centro de custo "${igual.nome}".`);
    if (c.nome === n) return { centro: c, lancamentos: 0 };
    const comTexto = await tx.bpoLancamento.findMany({ where: { centroCustos: { not: null } }, select: { id: true, centroCustos: true } });
    const porTexto = new Map<string, string[]>();
    for (const l of comTexto) {
      const novo = renomearCentroNoTexto(l.centroCustos, c.nome, n);
      if (novo !== null && novo !== l.centroCustos) porTexto.set(novo, [...(porTexto.get(novo) ?? []), l.id]);
    }
    let lancamentos = 0;
    for (const [texto, ids] of porTexto) {
      for (let i = 0; i < ids.length; i += 500) {
        const r = await tx.bpoLancamento.updateMany({ where: { id: { in: ids.slice(i, i + 500) } }, data: { centroCustos: texto } });
        lancamentos += r.count;
      }
    }
    const atualizado = await tx.bpoCentroCusto.update({ where: { id }, data: { nome: n } });
    return { centro: atualizado, lancamentos };
  }, { timeout: 60_000 });
}
