"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { calcularProgresso } from "@/lib/financeiro/progresso";
import { LIMITE_LEGENDA } from "@/lib/obras/fotos";
import { carregarProgressoObra } from "@/lib/obras/progresso-dados";
import { carregarResumoObra } from "@/lib/financeiro/obra-dados";
import { tipoProjetoObra } from "@/lib/types/obra";
import { exigirObraOuEmpreiteiro } from "@/lib/obras/acesso-empreiteiro";

// EPIC-020 Lote 4 — progresso por incidência (27), fotos (28) e dados do
// relatório executivo (29), com as mesmas regras da API `obraProgresso` da
// Prospecta. O Progresso Geral nunca é digitado: é sempre calculado.

export type Resultado<T = object> = ({ ok: true } & T) | { ok: false; erro: string };

const PERCENTUAL4 = /^\d{1,3}(\.\d{1,4})?$/;

function revalidar(obraId: string) {
  revalidatePath(`/admin/obras/${obraId}`);
  revalidatePath(`/admin/obras/${obraId}/editar`);
  revalidatePath("/admin/obras");
  // Portal do Empreiteiro (15/10): mesmas telas em /empreiteiro.
  revalidatePath(`/empreiteiro/obras/${obraId}`);
  revalidatePath(`/empreiteiro/obras/${obraId}/editar`);
  revalidatePath("/empreiteiro");
}

/** Obra da foto, para conferir o vínculo do empreiteiro. */
async function obraDaFoto(fotoId: string) {
  return (await prisma.obraFoto.findUnique({ where: { id: fotoId }, select: { obraId: true } }))?.obraId ?? null;
}

export async function salvarProgressoObra(
  obraId: string,
  itens: { chave: string; incidencia: string; execucao: string }[]
): Promise<Resultado<{ progresso: number; avisos: string[] }>> {
  const usuarioId = await exigirObraOuEmpreiteiro(obraId);
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

/** Obra da medição, para conferir o vínculo do empreiteiro. */
async function obraDaMedicao(medicaoId: string) {
  return (await prisma.obraProgressoHistorico.findUnique({ where: { id: medicaoId }, select: { obraId: true } }))?.obraId ?? null;
}

async function ehUltimaMedicao(obraId: string, medicaoId: string) {
  const ultima = await prisma.obraProgressoHistorico.findFirst({ where: { obraId }, orderBy: [{ criadoEm: "desc" }, { id: "desc" }], select: { id: true } });
  return ultima?.id === medicaoId;
}

type ItemMedicao = { chave: string; incidencia: string; execucao: string };

/** Grava a medição vigente da obra (itens + progresso). `null` = obra sem medição. */
async function aplicarMedicaoVigente(obraId: string, itens: ItemMedicao[] | null, usuarioId: string, agora: Date) {
  if (!itens) {
    await prisma.$transaction([
      prisma.obraProgressoItem.deleteMany({ where: { obraId } }),
      prisma.obra.update({ where: { id: obraId }, data: { progressoMedido: null, progresso: 0 } }),
    ]);
    return;
  }
  const calculo = calcularProgresso(itens);
  await prisma.$transaction([
    prisma.obraProgressoItem.deleteMany({ where: { obraId } }),
    prisma.obraProgressoItem.createMany({
      data: itens.map((i) => ({ obraId, chave: i.chave, incidencia: i.incidencia, execucao: i.execucao, atualizadoPorId: usuarioId, atualizadoEm: agora })),
    }),
    prisma.obra.update({ where: { id: obraId }, data: { progressoMedido: calculo.progresso.toFixed(6), progresso: Math.round(calculo.progresso) } }),
  ]);
}

function itensValidos(itens: ItemMedicao[]): string | null {
  if (!Array.isArray(itens) || itens.length !== 20) return "Envie os 20 serviços.";
  for (const i of itens) {
    if (typeof i?.chave !== "string" || !PERCENTUAL4.test(String(i.incidencia)) || !PERCENTUAL4.test(String(i.execucao)))
      return "Percentual inválido (até 4 casas decimais).";
  }
  return null;
}

// Pedido de 18/10: ciclo da medição (solicitar ao banco, confirmar recebimento),
// edição e exclusão — admin, colaborador com Obras e o empreiteiro da obra.
// Mesmas regras de `obraProgresso.*Medicao` da Prospecta.

export async function solicitarMedicao(medicaoId: string): Promise<Resultado> {
  const obraId = await obraDaMedicao(medicaoId);
  const usuarioId = await exigirObraOuEmpreiteiro(obraId);
  if (!obraId || !usuarioId) return { ok: false, erro: "Medição não encontrada." };
  const r = await prisma.obraProgressoHistorico.updateMany({ where: { id: medicaoId, solicitadaEm: null }, data: { solicitadaEm: new Date(), solicitadaPorId: usuarioId } });
  if (!r.count) return { ok: false, erro: "Esta medição já foi solicitada." };
  revalidar(obraId);
  return { ok: true };
}

export async function confirmarRecebimentoMedicao(medicaoId: string): Promise<Resultado> {
  const obraId = await obraDaMedicao(medicaoId);
  const usuarioId = await exigirObraOuEmpreiteiro(obraId);
  if (!obraId || !usuarioId) return { ok: false, erro: "Medição não encontrada." };
  const atual = await prisma.obraProgressoHistorico.findUnique({ where: { id: medicaoId }, select: { solicitadaEm: true } });
  if (!atual?.solicitadaEm) return { ok: false, erro: "Solicite a medição antes de confirmar o recebimento." };
  const r = await prisma.obraProgressoHistorico.updateMany({ where: { id: medicaoId, recebidaEm: null }, data: { recebidaEm: new Date(), recebidaPorId: usuarioId } });
  if (!r.count) return { ok: false, erro: "O recebimento desta medição já foi confirmado." };
  revalidar(obraId);
  return { ok: true };
}

export async function editarMedicao(medicaoId: string, itens: ItemMedicao[]): Promise<Resultado<{ progresso: number }>> {
  const obraId = await obraDaMedicao(medicaoId);
  const usuarioId = await exigirObraOuEmpreiteiro(obraId);
  if (!obraId || !usuarioId) return { ok: false, erro: "Medição não encontrada." };
  const invalido = itensValidos(itens);
  if (invalido) return { ok: false, erro: invalido };
  const calculo = calcularProgresso(itens);
  if (calculo.erros.length) return { ok: false, erro: calculo.erros.join(" ") };
  const agora = new Date();
  await prisma.obraProgressoHistorico.update({
    where: { id: medicaoId },
    data: {
      progresso: calculo.progresso.toFixed(6),
      somaIncidencia: calculo.somaIncidencia.toFixed(4),
      itens: itens.map((i) => ({ chave: i.chave, incidencia: String(i.incidencia), execucao: String(i.execucao) })),
      editadaEm: agora,
      editadaPorId: usuarioId,
    },
  });
  // A mais recente é a medição vigente: o progresso da obra acompanha.
  if (await ehUltimaMedicao(obraId, medicaoId)) await aplicarMedicaoVigente(obraId, itens, usuarioId, agora);
  revalidar(obraId);
  return { ok: true, progresso: calculo.progresso };
}

export async function excluirMedicao(medicaoId: string): Promise<Resultado> {
  const obraId = await obraDaMedicao(medicaoId);
  const usuarioId = await exigirObraOuEmpreiteiro(obraId);
  if (!obraId || !usuarioId) return { ok: false, erro: "Medição não encontrada." };
  const eraUltima = await ehUltimaMedicao(obraId, medicaoId);
  await prisma.obraProgressoHistorico.delete({ where: { id: medicaoId } });
  if (eraUltima) {
    // A obra volta para a medição anterior (ou fica sem medição).
    const anterior = await prisma.obraProgressoHistorico.findFirst({ where: { obraId: obraId }, orderBy: [{ criadoEm: "desc" }, { id: "desc" }], select: { itens: true } });
    await aplicarMedicaoVigente(obraId, anterior ? (anterior.itens as ItemMedicao[]) : null, usuarioId, new Date());
  }
  revalidar(obraId);
  return { ok: true };
}

export async function atualizarFotoObra(fotoId: string, legenda: string | null, incluirNoRelatorio: boolean): Promise<Resultado> {
  await exigirObraOuEmpreiteiro(await obraDaFoto(fotoId));
  const texto = legenda?.trim() || null;
  if (texto && texto.length > LIMITE_LEGENDA) return { ok: false, erro: `A legenda pode ter até ${LIMITE_LEGENDA} caracteres.` };
  const r = await prisma.obraFoto.updateMany({ where: { id: fotoId }, data: { legenda: texto, incluirNoRelatorio: !!incluirNoRelatorio } });
  if (!r.count) return { ok: false, erro: "Foto não encontrada." };
  const f = await prisma.obraFoto.findUnique({ where: { id: fotoId }, select: { obraId: true } });
  if (f) revalidar(f.obraId);
  return { ok: true };
}

export async function excluirFotoObra(fotoId: string): Promise<Resultado> {
  await exigirObraOuEmpreiteiro(await obraDaFoto(fotoId));
  const foto = await prisma.obraFoto.findUnique({ where: { id: fotoId }, select: { arquivoId: true, obraId: true } });
  if (!foto) return { ok: false, erro: "Foto não encontrada." };
  // Apagar o arquivo apaga a foto (ON DELETE CASCADE em obra_fotos.arquivoId).
  await prisma.arquivo.delete({ where: { id: foto.arquivoId } });
  revalidar(foto.obraId);
  return { ok: true };
}

/** Tudo o que o relatório executivo (item 29) precisa, numa leitura só (admin ou empreiteiro da obra). */
export async function dadosRelatorioObra(obraId: string) {
  await exigirObraOuEmpreiteiro(obraId);
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
