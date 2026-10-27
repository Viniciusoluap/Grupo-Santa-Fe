// Lote 2, correção 07 (AD-07): Incorporação › Projeto Aprovado ↔ módulo Projetos.
// Regras puras e mapeamento documentado em ./incorporacao/projeto-sincronizacao.ts.
// Mesmo comportamento no Prospecta (server/projeto-incorporacao-sync.ts).
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { ProcessoAprovacao } from "@/lib/incorporacao/aprovacao-projeto";
import {
  STATUS_INTERNO_INICIAL,
  STATUS_INTERNO_PROCESSO_EXCLUIDO,
  TIPOS_POR_ORGAO,
  lerProcessosAprovacao,
  nomeProjetoDoProcesso,
  normalizarProcessos,
  notaProcessoExcluido,
  planejarSincronizacao,
  processoComDadosDoProjeto,
  statusInternoAposSituacaoExterna,
} from "@/lib/incorporacao/projeto-sincronizacao";
import { projectChecklist } from "@/lib/projeto-documentos";
import { diaPrazoProjeto, persistirDiaPrazoProjeto } from "@/lib/projetos-prazo";
import { PROJETO_TIPO_CONFIG } from "@/lib/types/projeto";

type Db = Prisma.TransactionClient | typeof prisma;
const ROTULOS_TIPO = Object.fromEntries(Object.entries(PROJETO_TIPO_CONFIG).map(([k, v]) => [k, v.label]));

/** Engenheiro escolhido no processo = colaborador/admin ativo; o nome exibido vem do cadastro. */
async function resolverEngenheiros(db: Db, processos: ProcessoAprovacao[]): Promise<ProcessoAprovacao[]> {
  const ids = Array.from(new Set(processos.flatMap((p) => (p.engenheiroId ? [p.engenheiroId] : []))));
  const validos = new Map<string, string>();
  if (ids.length) {
    const linhas = await db.usuario.findMany({ where: { id: { in: ids } }, select: { id: true, nome: true, papel: true, ativo: true } });
    for (const u of linhas) if (u.ativo && ["colaborador", "admin"].includes(u.papel)) validos.set(u.id, u.nome ?? "");
  }
  return processos.map((p) => {
    if (!p.engenheiroId) return { ...p, engenheiro: undefined };
    const nome = validos.get(p.engenheiroId);
    if (nome === undefined) throw new Error("Escolha um colaborador ativo como engenheiro do processo.");
    return { ...p, engenheiro: nome || undefined };
  });
}

function camposCompartilhados(p: ProcessoAprovacao) {
  return {
    aprovacaoOrgao: p.orgao,
    aprovacaoProtocolo: p.numeroProtocolo ?? null,
    aprovacaoStatus: p.status,
    aprovacaoObservacoes: p.observacoes ?? null,
    prazoEntrega: p.prazoPrevisto ? persistirDiaPrazoProjeto(p.prazoPrevisto) : null,
    engenheiroId: p.engenheiroId ?? null,
    engenheiro: p.engenheiro ?? null,
    engenheiroRegistro: p.engenheiroRegistro ?? null,
  };
}

export type VinculoProcesso = { processoId: string; projetoId: string; status: string };

/**
 * Salva a aba Projeto Aprovado e sincroniza o módulo Projetos: cria o projeto do
 * processo novo, atualiza o existente (upsert pela chave estudo+processo, nunca
 * duplica) e arquiva como cancelado o projeto do processo excluído.
 */
export async function salvarAprovacaoProjetoSincronizado(estudoId: string, dadosJson: string): Promise<{ vinculos: VinculoProcesso[] }> {
  let bruto: unknown;
  try { bruto = JSON.parse(dadosJson); } catch { throw new Error("Dados do Projeto Aprovado inválidos."); }
  const lista = (bruto as { processos?: unknown })?.processos;
  if (!Array.isArray(lista)) throw new Error("Dados do Projeto Aprovado inválidos.");
  if (lista.length > 100) throw new Error("Cadastre no máximo 100 processos.");

  await prisma.$transaction(async (tx) => {
    const processos = await resolverEngenheiros(tx, normalizarProcessos(lista));
    const estudo = await tx.estudoIncorporacao.findUnique({ where: { id: estudoId }, select: { id: true, nome: true } });
    if (!estudo) throw new Error("Estudo não encontrado.");
    await tx.estudoIncorporacao.update({ where: { id: estudoId }, data: { aprovacaoProjetoJson: JSON.stringify({ ...(bruto as object), processos }) } });

    const vinculados = await tx.projeto.findMany({ where: { estudoIncorporacaoId: estudoId, processoAprovacaoId: { not: null } } });
    const plano = planejarSincronizacao(processos, vinculados);
    const agora = new Date();

    for (const { processo: p, projeto } of plano.atualizar) {
      const nomeAnterior = nomeProjetoDoProcesso(projeto.aprovacaoOrgao ?? "", projeto.clienteNome);
      await tx.projeto.update({
        where: { id: projeto.id },
        data: {
          ...camposCompartilhados(p),
          // Nome e cliente acompanham o estudo/órgão enquanto não forem editados em Projetos.
          ...(projeto.nome === nomeAnterior ? { nome: nomeProjetoDoProcesso(p.orgao, estudo.nome) } : {}),
          clienteNome: estudo.nome,
          status: statusInternoAposSituacaoExterna(projeto.status, projeto.aprovacaoStatus, p.status),
        },
      });
    }
    for (const p of plano.criar) {
      const tipos = TIPOS_POR_ORGAO[p.orgao] ?? [];
      const checklist = projectChecklist(tipos, [], ROTULOS_TIPO).map((c) => ({ id: c.id, type: c.type, texto: c.text, feito: c.done }));
      await tx.projeto.create({
        data: {
          ...camposCompartilhados(p),
          nome: nomeProjetoDoProcesso(p.orgao, estudo.nome),
          tipo: tipos.length ? JSON.stringify(tipos) : null,
          status: STATUS_INTERNO_INICIAL,
          clienteNome: estudo.nome,
          clienteTel: "",
          valorPago: 0,
          descricao: "",
          checklist: JSON.stringify(checklist),
          arquivos: "[]",
          estudoIncorporacaoId: estudoId,
          processoAprovacaoId: p.id,
        },
      });
    }
    for (const projeto of plano.desvincular) {
      await tx.projeto.update({
        where: { id: projeto.id },
        data: {
          processoAprovacaoId: null,
          status: STATUS_INTERNO_PROCESSO_EXCLUIDO,
          aprovacaoObservacoes: notaProcessoExcluido(projeto.aprovacaoObservacoes, agora),
        },
      });
    }
  }, { maxWait: 10000, timeout: 20000 });
  return { vinculos: await vinculosDoEstudo(estudoId) };
}

export async function vinculosDoEstudo(estudoId: string, db: Db = prisma): Promise<VinculoProcesso[]> {
  const linhas = await db.projeto.findMany({
    where: { estudoIncorporacaoId: estudoId, processoAprovacaoId: { not: null } },
    select: { id: true, processoAprovacaoId: true, status: true },
  });
  return linhas.map((l) => ({ processoId: l.processoAprovacaoId!, projetoId: l.id, status: l.status }));
}

/** Edição feita em Projetos → processo correspondente no estudo (dados compartilhados). */
export async function refletirProjetoNoEstudo(projetoId: string, db: Db = prisma): Promise<void> {
  const projeto = await db.projeto.findUnique({ where: { id: projetoId } });
  if (!projeto?.estudoIncorporacaoId || !projeto.processoAprovacaoId) return;
  const estudo = await db.estudoIncorporacao.findUnique({ where: { id: projeto.estudoIncorporacaoId }, select: { aprovacaoProjetoJson: true } });
  if (!estudo) return;
  const processos = lerProcessosAprovacao(estudo.aprovacaoProjetoJson);
  if (!processos.some((p) => p.id === projeto.processoAprovacaoId)) return;
  const atualizados = processos.map((p) => p.id !== projeto.processoAprovacaoId ? p : processoComDadosDoProjeto(p, {
    aprovacaoOrgao: projeto.aprovacaoOrgao,
    aprovacaoProtocolo: projeto.aprovacaoProtocolo,
    aprovacaoStatus: projeto.aprovacaoStatus,
    aprovacaoObservacoes: projeto.aprovacaoObservacoes,
    prazoDia: diaPrazoProjeto(projeto.prazoEntrega),
    engenheiroId: projeto.engenheiroId,
    engenheiro: projeto.engenheiro,
    engenheiroRegistro: projeto.engenheiroRegistro,
  }));
  await gravarProcessos(db, projeto.estudoIncorporacaoId, estudo.aprovacaoProjetoJson, atualizados);
}

/** Projeto excluído em Projetos → o processo sai do Projeto Aprovado (não renasce no próximo salvamento). */
export async function removerProcessoDoEstudo(vinculo: { estudoIncorporacaoId: string | null; processoAprovacaoId: string | null }, db: Db = prisma): Promise<void> {
  if (!vinculo.estudoIncorporacaoId || !vinculo.processoAprovacaoId) return;
  const estudo = await db.estudoIncorporacao.findUnique({ where: { id: vinculo.estudoIncorporacaoId }, select: { aprovacaoProjetoJson: true } });
  if (!estudo) return;
  const processos = lerProcessosAprovacao(estudo.aprovacaoProjetoJson);
  if (!processos.some((p) => p.id === vinculo.processoAprovacaoId)) return;
  await gravarProcessos(db, vinculo.estudoIncorporacaoId, estudo.aprovacaoProjetoJson, processos.filter((p) => p.id !== vinculo.processoAprovacaoId));
}

async function gravarProcessos(db: Db, estudoId: string, jsonAnterior: string | null, processos: ProcessoAprovacao[]) {
  let base: object = {};
  try { const v = jsonAnterior ? JSON.parse(jsonAnterior) : {}; if (v && typeof v === "object") base = v; } catch { /* corrompido → só processos */ }
  await db.estudoIncorporacao.update({ where: { id: estudoId }, data: { aprovacaoProjetoJson: JSON.stringify({ ...base, processos }) } });
}

/** Dados do vínculo antes de excluir um projeto (para remover o processo depois). */
export async function vinculoDoProjeto(projetoId: string, db: Db = prisma) {
  return db.projeto.findUnique({ where: { id: projetoId }, select: { estudoIncorporacaoId: true, processoAprovacaoId: true } });
}
