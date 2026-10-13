"use server";

import { capturarErroAcao } from "@/lib/acao-resultado";
import { auth } from "@/auth";
import { requireActionRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { diagnosticarDrive, driveRegistroConfigurado, hashDocumento, tentarUploadDrive, uploadDocumentoRegistro } from "@/lib/incorporacao/registro-drive";
import { itemRegistroValido, LIMITE_DOCUMENTO_REGISTRO, mimeDocumentoRegistro } from "@/lib/incorporacao/registro-documento-validacao";

async function administrador() {
  const session = await auth();
  requireActionRole(session, "admin");
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
  return { configurado: true, drive: driveRegistroConfigurado(), documentos: documentos.map((doc) => ({ ...doc, enviadoEm: doc.enviadoEm.toISOString() })) };
}

async function enviarDocumentoRegistroImpl(estudoId: string, itemId: string, arquivo: File) {
  const usuarioId = await administrador();
  const estudo = await prisma.estudoIncorporacao.findUnique({ where: { id: estudoId }, select: { id: true, registroIncorporacaoJson: true, dueDiligenceJson: true } });
  if (!estudo || !itemRegistroValido(itemId, estudo.registroIncorporacaoJson, estudo.dueDiligenceJson)) throw new Error("Item do checklist inválido.");
  if (!arquivo || typeof arquivo.arrayBuffer !== "function" || arquivo.size < 1 || arquivo.size > LIMITE_DOCUMENTO_REGISTRO)
    throw new Error("Selecione PDF ou imagem de até 3 MB.");
  const nome = arquivo.name.replace(/[\\/\x00-\x1f\x7f]/g, "_").trim().slice(0, 255);
  if (!nome) throw new Error("Nome de arquivo inválido.");
  const bytes = Buffer.from(await arquivo.arrayBuffer());
  const mime = mimeDocumentoRegistro(bytes);
  if (!mime || (arquivo.type && arquivo.type !== "application/octet-stream" && arquivo.type !== mime))
    throw new Error("Arquivo inválido. Use PDF, JPEG, PNG ou WebP.");
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
      const arquivo = await tx.arquivo.create({ data: { nome, mime, tamanho: bytes.length, dados: bytes }, select: { id: true } });
      await tx.estudoDocumentoRegistro.create({ data: { estudoId, itemId, nome, mime, tamanho: bytes.length, sha256, armazenamento: "banco", notaArmazenamento: nota, arquivoId: arquivo.id, enviadoPorId: usuarioId } });
    }
  });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
  const lista = await listarDocumentosRegistroImpl(estudoId);
  return { ...lista, armazenamento: fileId ? "drive" : "banco", notaArmazenamento: nota };
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
  return diagnosticarDrive();
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

export async function desvincularDocumentoRegistro(estudoId: string, itemId: string, documentoId: string) {
  return capturarErroAcao(() => desvincularDocumentoRegistroImpl(estudoId, itemId, documentoId));
}
