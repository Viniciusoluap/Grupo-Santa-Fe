"use server";

import { auth } from "@/auth";
import { requireActionRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { driveRegistroConfigurado, hashDocumento, uploadDocumentoRegistro } from "@/lib/incorporacao/registro-drive";
import { itemRegistroValido, LIMITE_DOCUMENTO_REGISTRO, mimeDocumentoRegistro } from "@/lib/incorporacao/registro-documento-validacao";

async function administrador() {
  const session = await auth();
  requireActionRole(session, "admin");
  const id = (session!.user as { id?: string }).id;
  if (!id) throw new Error("Não autorizado.");
  return id;
}

const select = { id: true, itemId: true, nome: true, mime: true, tamanho: true, enviadoEm: true, enviadoPorId: true } as const;

export async function listarDocumentosRegistro(estudoId: string) {
  await administrador();
  if (!estudoId || estudoId.length > 100) throw new Error("Estudo inválido.");
  const estudo = await prisma.estudoIncorporacao.findUnique({ where: { id: estudoId }, select: { id: true } });
  if (!estudo) throw new Error("Estudo não encontrado.");
  const documentos = await prisma.estudoDocumentoRegistro.findMany({ where: { estudoId, ativo: true }, select, orderBy: { enviadoEm: "desc" } });
  return { configurado: driveRegistroConfigurado(), documentos: documentos.map((doc) => ({ ...doc, enviadoEm: doc.enviadoEm.toISOString() })) };
}

export async function enviarDocumentoRegistro(estudoId: string, itemId: string, arquivo: File) {
  const usuarioId = await administrador();
  if (!driveRegistroConfigurado()) throw new Error("Google Drive do Grupo Santa Fé não configurado.");
  const estudo = await prisma.estudoIncorporacao.findUnique({ where: { id: estudoId }, select: { id: true, registroIncorporacaoJson: true } });
  if (!estudo || !itemRegistroValido(itemId, estudo.registroIncorporacaoJson)) throw new Error("Item do checklist inválido.");
  if (!arquivo || typeof arquivo.arrayBuffer !== "function" || arquivo.size < 1 || arquivo.size > LIMITE_DOCUMENTO_REGISTRO)
    throw new Error("Selecione PDF ou imagem de até 10 MB.");
  const nome = arquivo.name.replace(/[\\/\x00-\x1f\x7f]/g, "_").trim().slice(0, 255);
  if (!nome) throw new Error("Nome de arquivo inválido.");
  const bytes = Buffer.from(await arquivo.arrayBuffer());
  const mime = mimeDocumentoRegistro(bytes);
  if (!mime || (arquivo.type && arquivo.type !== "application/octet-stream" && arquivo.type !== mime))
    throw new Error("Arquivo inválido. Use PDF, JPEG, PNG ou WebP.");
  const sha256 = hashDocumento(bytes);
  const atual = await prisma.estudoDocumentoRegistro.findFirst({ where: { estudoId, itemId, ativo: true }, select: { sha256: true } });
  if (atual?.sha256 === sha256) return listarDocumentosRegistro(estudoId);

  const fileId = await uploadDocumentoRegistro(estudoId, itemId, nome, mime, bytes);
  // Serializa alterações concorrentes ao mesmo item; a versão antiga continua
  // auditável, sem excluir ou publicar seu arquivo no Drive.
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${estudoId}), hashtext(${itemId}))`;
    await tx.estudoDocumentoRegistro.updateMany({ where: { estudoId, itemId, ativo: true }, data: { ativo: false, desvinculadoEm: new Date(), desvinculadoPorId: usuarioId } });
    await tx.estudoDocumentoRegistro.create({ data: { estudoId, itemId, nome, mime, tamanho: bytes.length, sha256, driveFileId: fileId, enviadoPorId: usuarioId } });
  });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
  return listarDocumentosRegistro(estudoId);
}

export async function desvincularDocumentoRegistro(estudoId: string, itemId: string, documentoId: string) {
  const usuarioId = await administrador();
  await prisma.estudoDocumentoRegistro.updateMany({
    where: { id: documentoId, estudoId, itemId, ativo: true },
    data: { ativo: false, desvinculadoEm: new Date(), desvinculadoPorId: usuarioId },
  });
  revalidatePath(`/admin/incorporacao/${estudoId}`);
  return listarDocumentosRegistro(estudoId);
}
