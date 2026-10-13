"use server";
import { exigirModuloAcao } from "@/lib/auth/modulos";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { calcularProgresso } from "@/lib/financeiro/progresso";
import { LIMITE_LEGENDA } from "@/lib/obras/fotos";
import { carregarProgressoObra } from "@/lib/obras/progresso-dados";
import { carregarResumoObra } from "@/lib/financeiro/obra-dados";
import { tipoProjetoObra } from "@/lib/types/obra";

// EPIC-020 Lote 4 — progresso por incidência (27), fotos (28) e dados do
// relatório executivo (29), com as mesmas regras da API `obraProgresso` da
// Prospecta. O Progresso Geral nunca é digitado: é sempre calculado.

export type Resultado<T = object> = ({ ok: true } & T) | { ok: false; erro: string };

const PERCENTUAL4 = /^\d{1,3}(\.\d{1,4})?$/;

async function exigirAdmin() {
  const session = await auth();
  await exigirModuloAcao("obras");
  return (session!.user as { id?: string }).id ?? null;
}

function revalidar(obraId: string) {
  revalidatePath(`/admin/obras/${obraId}`);
  revalidatePath(`/admin/obras/${obraId}/editar`);
  revalidatePath("/admin/obras");
}

export async function salvarProgressoObra(
  obraId: string,
  itens: { chave: string; incidencia: string; execucao: string }[]
): Promise<Resultado<{ progresso: number; avisos: string[] }>> {
  const usuarioId = await exigirAdmin();
  if (!Array.isArray(itens) || itens.length !== 20) return { ok: false, erro: "Envie os 20 serviços." };
  for (const i of itens) {
    if (typeof i?.chave !== "string" || !PERCENTUAL4.test(String(i.incidencia)) || !PERCENTUAL4.test(String(i.execucao)))
      return { ok: false, erro: "Percentual inválido (até 4 casas decimais)." };
  }
  const calculo = calcularProgresso(itens);
  if (calculo.erros.length) return { ok: false, erro: calculo.erros.join(" ") };
  const existe = await prisma.obra.findUnique({ where: { id: obraId }, select: { id: true } });
  if (!existe) return { ok: false, erro: "Obra não encontrada." };
  const agora = new Date();
  await prisma.$transaction([
    prisma.obraProgressoItem.deleteMany({ where: { obraId } }),
    prisma.obraProgressoItem.createMany({
      data: itens.map((i) => ({ obraId, chave: i.chave, incidencia: i.incidencia, execucao: i.execucao, atualizadoPorId: usuarioId, atualizadoEm: agora })),
    }),
    prisma.obra.update({
      where: { id: obraId },
      data: { progressoMedido: calculo.progresso.toFixed(6), progresso: Math.round(calculo.progresso) },
    }),
    prisma.obraProgressoHistorico.create({
      data: {
        obraId,
        progresso: calculo.progresso.toFixed(6),
        somaIncidencia: calculo.somaIncidencia.toFixed(4),
        itens: itens.map((i) => ({ chave: i.chave, incidencia: String(i.incidencia), execucao: String(i.execucao) })),
        criadoPorId: usuarioId,
        criadoEm: agora,
      },
    }),
  ]);
  revalidar(obraId);
  return { ok: true, progresso: calculo.progresso, avisos: calculo.avisos };
}

export async function atualizarFotoObra(fotoId: string, legenda: string | null, incluirNoRelatorio: boolean): Promise<Resultado> {
  await exigirAdmin();
  const texto = legenda?.trim() || null;
  if (texto && texto.length > LIMITE_LEGENDA) return { ok: false, erro: `A legenda pode ter até ${LIMITE_LEGENDA} caracteres.` };
  const r = await prisma.obraFoto.updateMany({ where: { id: fotoId }, data: { legenda: texto, incluirNoRelatorio: !!incluirNoRelatorio } });
  if (!r.count) return { ok: false, erro: "Foto não encontrada." };
  const f = await prisma.obraFoto.findUnique({ where: { id: fotoId }, select: { obraId: true } });
  if (f) revalidar(f.obraId);
  return { ok: true };
}

export async function excluirFotoObra(fotoId: string): Promise<Resultado> {
  await exigirAdmin();
  const foto = await prisma.obraFoto.findUnique({ where: { id: fotoId }, select: { arquivoId: true, obraId: true } });
  if (!foto) return { ok: false, erro: "Foto não encontrada." };
  // Apagar o arquivo apaga a foto (ON DELETE CASCADE em obra_fotos.arquivoId).
  await prisma.arquivo.delete({ where: { id: foto.arquivoId } });
  revalidar(foto.obraId);
  return { ok: true };
}

/** Tudo o que o relatório executivo (item 29) precisa, numa leitura só (admin). */
export async function dadosRelatorioObra(obraId: string) {
  await exigirAdmin();
  const [o, resumo, progresso, fotos] = await Promise.all([
    prisma.obra.findUnique({
      where: { id: obraId },
      include: {
        leadVinculado: { select: { nome: true, telefone: true, email: true, corretor: { select: { nome: true } } } },
        servicoLead: { select: { servico: true } },
      },
    }),
    carregarResumoObra(obraId),
    carregarProgressoObra(obraId),
    prisma.obraFoto.findMany({
      where: { obraId, incluirNoRelatorio: true },
      orderBy: [{ tiradaEm: "asc" }, { criadoEm: "asc" }],
      select: { id: true, legenda: true, tiradaEm: true },
    }),
  ]);
  if (!o || !resumo || !progresso) throw new Error("Obra não encontrada.");
  return {
    info: {
      titulo: o.nome,
      tipo: tipoProjetoObra(o).label,
      cliente: o.leadVinculado?.nome ?? o.clienteNome,
      telefoneCliente: o.leadVinculado?.telefone ?? o.clienteTel ?? null,
      emailCliente: o.leadVinculado?.email ?? null,
      corretor: o.leadVinculado?.corretor?.nome ?? null,
      endereco: o.endereco,
      area: o.area,
      status: o.status,
      escritorioCef: o.escritorioCef,
      dataInicio: o.dataInicio?.toISOString() ?? null,
      previsaoTermino: o.dataPrevisaoFim?.toISOString() ?? null,
      terminoReal: o.dataConclusao?.toISOString() ?? null,
      observacoes: o.descricao?.trim() || null,
      engenheiro: o.engenheiroResp,
    },
    resumo,
    progresso,
    fotos: fotos.map((f) => ({ url: `/api/obras/fotos/${f.id}`, legenda: f.legenda, data: f.tiradaEm.toISOString() })),
  };
}
