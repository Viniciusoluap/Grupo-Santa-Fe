"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { obterPci, validarIncidenciasPci } from "@/lib/obras/pci";
import { dadosMedicaoPadrao, dadosPlsPadrao, ehTipoMedicao, normalizarDadosMedicao, validarDadosMedicao, type TipoMedicao } from "@/lib/medicao-caixa";
import type { DadosPci } from "@/lib/caixa/pci";
import { calcularProgresso, mesclarComPadrao } from "@/lib/financeiro/progresso";
import { LIMITE_LEGENDA } from "@/lib/obras/fotos";
import { carregarProgressoObra } from "@/lib/obras/progresso-dados";
import { carregarResumoObra } from "@/lib/financeiro/obra-dados";
import { tipoProjetoObra } from "@/lib/types/obra";
import { exigirObraOuEmpreiteiro } from "@/lib/obras/acesso-empreiteiro";
import { copiarMedicaoParaDrive, type ResultadoDrive } from "@/lib/obras/medicao-gerar";

// EPIC-020 Lote 4 — progresso por incidência (27), fotos (28) e dados do
// relatório executivo (29), com as mesmas regras da API `obraProgresso` da
// Prospecta. O Progresso Geral nunca é digitado: é sempre calculado.

export type Resultado<T = object> = ({ ok: true } & T) | { ok: false; erro: string };

/**
 * Recusa de regra de negócio dentro de uma transação. Em produção o Next esconde
 * a mensagem de erros lançados em server actions; esta é devolvida como
 * { ok: false, erro } para o usuário ver o motivo (igual ao TRPCError da Prospecta).
 */
class RecusaMedicao extends Error {}
async function comRecusa<T>(fn: () => Promise<T>): Promise<{ ok: true; valor: T } | { ok: false; erro: string }> {
  try { return { ok: true, valor: await fn() }; }
  catch (e) { if (e instanceof RecusaMedicao) return { ok: false, erro: e.message }; throw e; }
}

const INCIDENCIA = /^\d{1,3}(\.\d{1,15})?$/;
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
  itens: { chave: string; incidencia: string; execucao: string }[],
  tipo: TipoMedicao = "pls", dadosCaixa?: unknown
): Promise<Resultado<{ progresso: number; avisos: string[]; medicaoId: string }>> {
  const usuarioId = await exigirObraOuEmpreiteiro(obraId);
  if (!ehTipoMedicao(tipo)) return { ok: false, erro: "Tipo de medição inválido." };
  if (!usuarioId) return { ok: false, erro: "Sem permissão." };
  if (!Array.isArray(itens) || itens.length !== 20) return { ok: false, erro: "Envie os 20 serviços." };
  for (const i of itens) {
    if (typeof i?.chave !== "string" || !INCIDENCIA.test(String(i.incidencia)) || !PERCENTUAL4.test(String(i.execucao)))
      return { ok: false, erro: "Percentual inválido (até 4 casas decimais)." };
  }
  const calculo = calcularProgresso(itens);
  if (calculo.erros.length) return { ok: false, erro: calculo.erros.join(" ") };
  const existe = await prisma.obra.findUnique({ where: { id: obraId }, select: { id: true } });
  if (!existe) return { ok: false, erro: "Obra não encontrada." };
  const dados = normalizarDadosMedicao(tipo, dadosCaixa ?? dadosMedicaoPadrao(tipo, dadosPlsPadrao()));
  const erros = validarDadosMedicao(tipo, dados);
  if (erros.length) return { ok: false, erro: erros.join(" ") };
  const gravacao = await comRecusa(() => prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM obras WHERE id = ${obraId} FOR UPDATE`;
    const gravadoEm = new Date();
    const pci = await obterPci(obraId, tx);
    if (pci && (!pci.vinculadaEm || !validarIncidenciasPci(itens, pci.versao.parsed as unknown as DadosPci))) throw new RecusaMedicao("Vincule a PCI e use as incidências da planilha antes de salvar.");
    await aplicarMedicaoVigente(tx, obraId, itens, usuarioId, gravadoEm);
    const medicao = await tx.obraProgressoHistorico.create({ data: {
      obraId, progresso: calculo.progresso.toFixed(6), somaIncidencia: calculo.somaIncidencia.toFixed(15),
      itens, criadoPorId: usuarioId, criadoEm: gravadoEm, tipo, dadosCaixa: dados as unknown as Prisma.InputJsonValue,
      pciVersaoId: pci?.versaoId ?? null,
    }, select: { id: true } });
    return medicao.id;
  }));
  if (!gravacao.ok) return gravacao;
  const medicaoId = gravacao.valor;
  revalidar(obraId);
  return { ok: true, progresso: calculo.progresso, avisos: calculo.avisos, medicaoId };
}

/** Obra da medição, para conferir o vínculo do empreiteiro. */
async function obraDaMedicao(medicaoId: string) {
  return (await prisma.obraProgressoHistorico.findUnique({ where: { id: medicaoId }, select: { obraId: true } }))?.obraId ?? null;
}

async function ehUltimaMedicao(obraId: string, medicaoId: string, db: Prisma.TransactionClient = prisma) {
  const ultima = await db.obraProgressoHistorico.findFirst({ where: { obraId }, orderBy: [{ criadoEm: "desc" }, { id: "desc" }], select: { id: true } });
  return ultima?.id === medicaoId;
}

type ItemMedicao = { chave: string; incidencia: string; execucao: string };

/** Grava a medição vigente da obra (itens + progresso). `null` = obra sem medição. */
async function aplicarMedicaoVigente(db: Prisma.TransactionClient, obraId: string, itens: ItemMedicao[] | null, usuarioId: string, agora: Date) {
  await db.obraProgressoItem.deleteMany({ where: { obraId } });
  if (!itens) {
    await db.obra.update({ where: { id: obraId }, data: { progressoMedido: null, progresso: 0 } });
    return;
  }
  const calculo = calcularProgresso(itens);
  await db.obraProgressoItem.createMany({
    data: itens.map((i) => ({ obraId, chave: i.chave, incidencia: i.incidencia, execucao: i.execucao, atualizadoPorId: usuarioId, atualizadoEm: agora })),
  });
  await db.obra.update({ where: { id: obraId }, data: { progressoMedido: calculo.progresso.toFixed(6), progresso: Math.round(calculo.progresso) } });
}

function itensValidos(itens: ItemMedicao[]): string | null {
  if (!Array.isArray(itens) || itens.length !== 20) return "Envie os 20 serviços.";
  for (const i of itens) {
    if (typeof i?.chave !== "string" || !INCIDENCIA.test(String(i.incidencia)) || !PERCENTUAL4.test(String(i.execucao)))
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

export async function editarMedicao(medicaoId: string, itens: ItemMedicao[], tipo?: TipoMedicao, dadosCaixa?: unknown): Promise<Resultado<{ progresso: number }>> {
  const obraId = await obraDaMedicao(medicaoId);
  const usuarioId = await exigirObraOuEmpreiteiro(obraId);
  if (!obraId || !usuarioId) return { ok: false, erro: "Medição não encontrada." };
  if (tipo !== undefined && !ehTipoMedicao(tipo)) return { ok: false, erro: "Tipo de medição inválido." };
  const invalido = itensValidos(itens);
  if (invalido) return { ok: false, erro: invalido };
  const calculo = calcularProgresso(itens);
  if (calculo.erros.length) return { ok: false, erro: calculo.erros.join(" ") };
  const agora = new Date();
  const edicao = await comRecusa(() => prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM obras WHERE id = ${obraId} FOR UPDATE`;
    const campos = dadosCaixa === undefined ? undefined : normalizarDadosMedicao(tipo ?? "pls", dadosCaixa);
    if (campos) { const erros = validarDadosMedicao(tipo ?? "pls", campos); if (erros.length) throw new RecusaMedicao(erros.join(" ")); }
    const medicao = await tx.obraProgressoHistorico.findUniqueOrThrow({ where: { id: medicaoId }, include: { pciVersao: true } });
    // Uma medição existente mantém sua versão; a versão atual só é adotada em revisão de legado.
    const pciAtual = medicao.pciVersao ? null : await obterPci(obraId, tx);
    // Mesma regra da Prospecta (versaoPciParaMedicao): com PCI enviada, a revisão
    // de uma medição sem versão exige a PCI vinculada.
    if (!medicao.pciVersao && pciAtual && !pciAtual.vinculadaEm) throw new RecusaMedicao("Vincule a PCI e use as incidências da planilha antes de salvar.");
    const versao = medicao.pciVersao ?? (pciAtual ? pciAtual.versao : null);
    if (versao && !validarIncidenciasPci(itens, versao.parsed as unknown as DadosPci)) throw new RecusaMedicao("As incidências devem corresponder à PCI desta medição.");
    await tx.obraProgressoHistorico.update({
      where: { id: medicaoId },
      data: {
        progresso: calculo.progresso.toFixed(6),
        somaIncidencia: calculo.somaIncidencia.toFixed(15),
        itens: itens.map((i) => ({ chave: i.chave, incidencia: String(i.incidencia), execucao: String(i.execucao) })),
        ...(tipo ? { tipo } : {}),
        ...(campos ? { dadosCaixa: campos as unknown as Prisma.InputJsonValue } : {}),
        pciVersaoId: versao?.id ?? null,
        editadaEm: agora,
        editadaPorId: usuarioId,
      },
    });
    // A mais recente é a medição vigente: o progresso da obra acompanha.
    if (await ehUltimaMedicao(obraId, medicaoId, tx)) await aplicarMedicaoVigente(tx, obraId, itens, usuarioId, agora);
  }));
  if (!edicao.ok) return edicao;
  revalidar(obraId);
  return { ok: true, progresso: calculo.progresso };
}

export async function excluirMedicao(medicaoId: string): Promise<Resultado> {
  const obraId = await obraDaMedicao(medicaoId);
  const usuarioId = await exigirObraOuEmpreiteiro(obraId);
  if (!obraId || !usuarioId) return { ok: false, erro: "Medição não encontrada." };
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM obras WHERE id = ${obraId} FOR UPDATE`;
    const eraUltima = await ehUltimaMedicao(obraId, medicaoId, tx);
    await tx.obraProgressoHistorico.delete({ where: { id: medicaoId } });
    if (eraUltima) {
      const anterior = await tx.obraProgressoHistorico.findFirst({ where: { obraId }, orderBy: [{ criadoEm: "desc" }, { id: "desc" }], select: { itens: true } });
      await aplicarMedicaoVigente(tx, obraId, anterior ? (anterior.itens as ItemMedicao[]) : null, usuarioId, new Date());
    }
  });
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

export async function vincularPciObra(obraId: string): Promise<Resultado<{ somaIncidencia: number }>> {
  const usuarioId = await exigirObraOuEmpreiteiro(obraId);
  const vinculo = await comRecusa(() => prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM obras WHERE id = ${obraId} FOR UPDATE`;
    const pci = await obterPci(obraId, tx);
    if (!pci) throw new RecusaMedicao("Envie a PCI antes de vincular.");
    const parsed = pci.versao.parsed as unknown as DadosPci;
    const atuais = await tx.obraProgressoItem.findMany({ where: { obraId } });
    const itens = mesclarComPadrao(atuais.map(i => ({ chave: i.chave, incidencia: String(i.incidencia), execucao: String(i.execucao) }))).map((i, k) => ({ chave: i.chave, incidencia: String(parsed.incidencias[k] ?? 0), execucao: String(i.execucao) }));
    const calculo = calcularProgresso(itens);
    if (calculo.erros.length) throw new RecusaMedicao(calculo.erros.join(" "));
    await tx.obraProgressoItem.deleteMany({ where: { obraId } });
    await tx.obraProgressoItem.createMany({ data: itens.map(i => ({ obraId, ...i, atualizadoPorId: usuarioId })) });
    await tx.obraPci.update({ where: { obraId }, data: { vinculadaEm: new Date(), vinculadaPorId: usuarioId } });
    // O vínculo prepara a próxima medição; não modifica uma medição já gravada.
    return calculo.somaIncidencia;
  }));
  if (!vinculo.ok) return vinculo;
  revalidar(obraId);
  return { ok: true, somaIncidencia: vinculo.valor };
}

/**
 * Pedido de 18/10: depois de salvar a medição (e enviar as fotos), guarda o .xls
 * e o .pdf preenchidos no Google Drive da obra. A medição já está salva; isto
 * nunca a desfaz.
 */
export async function copiarMedicaoNoDrive(medicaoId: string): Promise<Resultado<ResultadoDrive>> {
  const ref = await prisma.obraProgressoHistorico.findUnique({ where: { id: medicaoId }, select: { obraId: true } });
  if (!ref) return { ok: false, erro: "Medição não encontrada." };
  await exigirObraOuEmpreiteiro(ref.obraId);
  return { ok: true, ...(await copiarMedicaoParaDrive(medicaoId)) };
}
