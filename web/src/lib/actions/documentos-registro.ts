"use server";

import { exigirModuloAcao } from "@/lib/auth/modulos";
import { capturarErroAcao } from "@/lib/acao-resultado";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { diagnosticarDrive, driveRegistroConfigurado, hashDocumento, tentarUploadDrive, uploadDocumentoRegistro } from "@/lib/incorporacao/registro-drive";
import { itemRegistroValido, LIMITE_DOCUMENTO_REGISTRO, mimeConferidoRegistro } from "@/lib/incorporacao/registro-documento-validacao";
import { LIMITE_ANEXO_BYTES, PARTE_ANEXO_BYTES, mimeAnexoValido, mimeDoAnexo, nomeAnexoSeguro, partesDoAnexo } from "@/lib/incorporacao/anexos";

async function administrador() {
  const session = await auth();
  await exigirModuloAcao("incorporacao");
  const id = (session!.user as { id?: string }).id;
  if (!id) throw new Error("Não autorizado.");
  return id;
}

const select = { id: true, itemId: true, nome: true, mime: true, tamanho: true, enviadoEm: true, enviadoPorId: true, armazenamento: true, notaArmazenamento: true } as const;

async function listarDocumentosRegistroImpl(estudoId: string) {
  await administrador();
  if (!estudoId || estudoId.length > 100) throw new Error("Estudo inválido.");
  const estudo = await prisma.estudoIncorporacao.findUnique({ where: { id: estudoId }, select: { id: true } });
  if (!estudo) throw new Error("Estudo não encontrado.");
  const documentos = await prisma.estudoDocumentoRegistro.findMany({ where: { estudoId, ativo: true }, select, orderBy: { enviadoEm: "desc" } });
  // Sem Drive (ou com o Drive recusando) o arquivo fica no banco: o envio sempre funciona.
  return { configurado: true, drive: await driveRegistroConfigurado(), documentos: documentos.map((doc) => ({ ...doc, enviadoEm: doc.enviadoEm.toISOString() })) };
}

async function itemDoEstudo(estudoId: string, itemId: string) {
  if (!estudoId || estudoId.length > 100) throw new Error("Estudo inválido.");
  const estudo = await prisma.estudoIncorporacao.findUnique({ where: { id: estudoId }, select: { id: true, registroIncorporacaoJson: true, dueDiligenceJson: true } });
  if (!estudo || !itemRegistroValido(itemId, estudo.registroIncorporacaoJson, estudo.dueDiligenceJson)) throw new Error("Item do checklist inválido.");
}

/** Grava o arquivo (Drive; recusando, banco) e o vínculo ao item. Comum ao envio direto e ao envio em partes. */
async function gravarDocumentoRegistro(estudoId: string, itemId: string, usuarioId: string, nomeOriginal: string, mimeDeclarado: string, bytes: Buffer) {
  const nome = nomeAnexoSeguro(nomeOriginal);
  const mime = mimeConferidoRegistro(mimeDeclarado, bytes);
  const sha256 = hashDocumento(bytes);
  const atual = await prisma.estudoDocumentoRegistro.findFirst({ where: { estudoId, itemId, ativo: true }, select: { sha256: true } });
  if (atual?.sha256 === sha256) return listarDocumentosRegistroImpl(estudoId);

  const { fileId, nota } = await tentarUploadDrive(() => uploadDocumentoRegistro(estudoId, itemId, nome, mime, bytes));
  // Serializa alterações concorrentes ao mesmo item; a versão antiga continua
  // auditável, sem excluir ou publicar seu arquivo no Drive.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${estudoId}), hashtext(${itemId}))`;
    await tx.estudoDocumentoRegistro.updateMany({ where: { estudoId, itemId, ativo: true }, data: { ativo: false, desvinculadoEm: new Date(), desvinculadoPorId: usuarioId } });
    if (fileId) {
      await tx.estudoDocumentoRegistro.create({ data: { estudoId, itemId, nome, mime, tamanho: bytes.length, sha256, driveFileId: fileId, enviadoPorId: usuarioId } });
    } else {
      const arquivo = await tx.arquivo.create({ data: { nome, mime, tamanho: bytes.length, dados: new Uint8Array(bytes) }, select: { id: true } });
      await tx.estudoDocumentoRegistro.create({ data: { estudoId, itemId, nome, mime, tamanho: bytes.length, sha256, armazenamento: "banco", notaArmazenamento: nota, arquivoId: arquivo.id, enviadoPorId: usuarioId } });
    }
  }, { timeout: 30_000 });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
  const lista = await listarDocumentosRegistroImpl(estudoId);
  return { ...lista, armazenamento: fileId ? "drive" : "banco", notaArmazenamento: nota };
}

/** Envio direto (até 3 MB): qualquer tipo de arquivo — foto, DWG, Word, Excel, ZIP... */
async function enviarDocumentoRegistroImpl(estudoId: string, itemId: string, arquivo: File) {
  const usuarioId = await administrador();
  await itemDoEstudo(estudoId, itemId);
  if (!arquivo || typeof arquivo.arrayBuffer !== "function" || arquivo.size < 1 || arquivo.size > LIMITE_DOCUMENTO_REGISTRO)
    throw new Error("Arquivo vazio ou acima de 3 MB (arquivos maiores vão em partes).");
  if (!nomeAnexoSeguro(arquivo.name)) throw new Error("Nome de arquivo inválido.");
  const bytes = Buffer.from(await arquivo.arrayBuffer());
  return gravarDocumentoRegistro(estudoId, itemId, usuarioId, arquivo.name, mimeDoAnexo(arquivo.name, arquivo.type), bytes);
}

const UPLOAD_ID = /^[A-Za-z0-9_-]{16,64}$/;

/** Envio em partes (até 50 MB): cada parte de até 2 MiB fica na área temporária até a finalização. */
async function enviarParteDocumentoRegistroImpl(estudoId: string, itemId: string, uploadId: string, parte: number, pedaco: File) {
  const usuarioId = await administrador();
  await itemDoEstudo(estudoId, itemId);
  if (!UPLOAD_ID.test(uploadId) || !Number.isInteger(parte) || parte < 0 || parte >= partesDoAnexo(LIMITE_ANEXO_BYTES))
    throw new Error("Envio inválido.");
  if (!pedaco || typeof pedaco.arrayBuffer !== "function" || pedaco.size < 1 || pedaco.size > PARTE_ANEXO_BYTES)
    throw new Error("Parte do arquivo inválida.");
  const dados = Buffer.from(await pedaco.arrayBuffer());
  // envios abandonados há mais de um dia são descartados
  await prisma.estudoDocumentoParte.deleteMany({ where: { criadoEm: { lt: new Date(Date.now() - 86_400_000) } } });
  const existente = await prisma.estudoDocumentoParte.findUnique({ where: { uploadId_parte: { uploadId, parte } }, select: { usuarioId: true, estudoId: true, itemId: true } });
  if (existente && (existente.usuarioId !== usuarioId || existente.estudoId !== estudoId || existente.itemId !== itemId)) throw new Error("Envio inválido.");
  await prisma.estudoDocumentoParte.upsert({
    where: { uploadId_parte: { uploadId, parte } },
    create: { uploadId, parte, estudoId, itemId, usuarioId, dados },
    update: { dados, criadoEm: new Date() },
  });
  return { ok: true };
}

async function finalizarDocumentoRegistroImpl(estudoId: string, itemId: string, uploadId: string, nome: string, mimeDeclarado: string, tamanho: number) {
  const usuarioId = await administrador();
  await itemDoEstudo(estudoId, itemId);
  if (!UPLOAD_ID.test(uploadId) || !Number.isInteger(tamanho) || tamanho < 1 || tamanho > LIMITE_ANEXO_BYTES) throw new Error("Envio inválido.");
  if (!nomeAnexoSeguro(nome)) throw new Error("Nome de arquivo inválido.");
  try {
    const total = partesDoAnexo(tamanho);
    const partes = await prisma.estudoDocumentoParte.findMany({ where: { uploadId, usuarioId, estudoId, itemId }, orderBy: { parte: "asc" }, select: { parte: true, dados: true } });
    const outras = await prisma.estudoDocumentoParte.count({ where: { uploadId } });
    if (partes.length !== total || outras !== total || partes.some((p, i) => p.parte !== i)) throw new Error("Envio incompleto: tente novamente.");
    const bytes = Buffer.concat(partes.map((p) => Buffer.from(p.dados)));
    if (bytes.length !== tamanho) throw new Error("Envio incompleto: tente novamente.");
    return await gravarDocumentoRegistro(estudoId, itemId, usuarioId, nome, mimeAnexoValido(mimeDeclarado) ? mimeDeclarado : mimeDoAnexo(nome, null), bytes);
  } finally {
    await prisma.estudoDocumentoParte.deleteMany({ where: { uploadId, usuarioId } });
  }
}

async function desvincularDocumentoRegistroImpl(estudoId: string, itemId: string, documentoId: string) {
  const usuarioId = await administrador();
  await prisma.estudoDocumentoRegistro.updateMany({
    where: { id: documentoId, estudoId, itemId, ativo: true },
    data: { ativo: false, desvinculadoEm: new Date(), desvinculadoPorId: usuarioId },
  });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
  return listarDocumentosRegistroImpl(estudoId);
}

async function diagnosticarDriveImpl() {
  await administrador();
  const r = await diagnosticarDrive();
  // Pedido de 15/10: com o Drive funcionando, envia as fotos de imóveis pendentes.
  if (!r.configurado || !r.etapas.some((e) => e.etapa === "Gravação de arquivo de teste" && e.ok)) return r;
  const { enviarFotosPendentesAoDrive } = await import("@/lib/imovel-fotos");
  // Com prazo (a função tem tempo limitado): o restante segue no "Organizar Drive".
  const fotos = await enviarFotosPendentesAoDrive({ prazo: Date.now() + 30_000 });
  if (fotos.enviadas || fotos.falhas || !fotos.concluido) {
    r.etapas.push({
      etapa: `Fotos de imóveis enviadas ao Drive: ${fotos.enviadas}${fotos.falhas ? `, ${fotos.falhas} pendente(s) — será tentado de novo` : ""}${fotos.concluido ? "" : " (o restante segue no Organizar Drive)"}`,
      ok: fotos.falhas === 0,
    });
  }
  return r;
}

/** Teste real do Google Drive (admin): mostra em que etapa e por que falha. */
export async function testarGoogleDrive() {
  return capturarErroAcao(() => diagnosticarDriveImpl());
}

export async function listarDocumentosRegistro(estudoId: string) {
  return capturarErroAcao(() => listarDocumentosRegistroImpl(estudoId));
}

export async function enviarDocumentoRegistro(estudoId: string, itemId: string, arquivo: File) {
  return capturarErroAcao(() => enviarDocumentoRegistroImpl(estudoId, itemId, arquivo));
}

export async function enviarParteDocumentoRegistro(estudoId: string, itemId: string, uploadId: string, parte: number, pedaco: File) {
  return capturarErroAcao(() => enviarParteDocumentoRegistroImpl(estudoId, itemId, uploadId, parte, pedaco));
}

export async function finalizarDocumentoRegistro(estudoId: string, itemId: string, uploadId: string, nome: string, mime: string, tamanho: number) {
  return capturarErroAcao(() => finalizarDocumentoRegistroImpl(estudoId, itemId, uploadId, nome, mime, tamanho));
}

export async function desvincularDocumentoRegistro(estudoId: string, itemId: string, documentoId: string) {
  return capturarErroAcao(() => desvincularDocumentoRegistroImpl(estudoId, itemId, documentoId));
}
