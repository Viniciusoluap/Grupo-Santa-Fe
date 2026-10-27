import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth/modulos";
import { prisma } from "@/lib/db";
import { guardarParte, limparPartes, montarPartes } from "@/lib/documentos-upload-partes";
import { acessoDocumentosUsuario, ehCategoriaDocumento, validarArquivoDocumento } from "@/lib/engenheiro";

export const runtime = "nodejs";
export const maxDuration = 60;

// Lote 2, correção 04: envio de documentos do usuário (perfil Engenheiro) em partes
// de 1 MB (limite de 4,5 MB da Vercel), reaproveitando documento_upload_partes.
// Corpo JSON: { acao: "parte", categoria, uploadId, parte, total, nome, chunk }
//          ou { acao: "finalizar", categoria, uploadId, substituirId? }.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const u = await usuarioAtual();
    if (!u || !u.ativo) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
    const { id: usuarioId } = await params;
    if (!acessoDocumentosUsuario({ id: u.id, papel: u.perfil, ativo: u.ativo }, usuarioId).gerenciar)
      return NextResponse.json({ error: "Sem permissão para os documentos deste usuário." }, { status: 403 });
    const b = (await req.json()) as Record<string, unknown>;
    if (!ehCategoriaDocumento(b.categoria)) throw new Error("Categoria inválida.");
    const itemId = `${usuarioId}:${b.categoria}`;
    if (b.acao === "parte") {
      await guardarParte(b, u.id, "usuario", itemId);
      return NextResponse.json({ ok: true });
    }
    if (b.acao !== "finalizar") throw new Error("Ação inválida.");
    const alvo = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { id: true } });
    if (!alvo) throw new Error("Usuário não encontrado.");
    const uploadId = String(b.uploadId ?? "");
    const arquivo = await montarPartes(uploadId, u.id, "usuario", itemId);
    const v = validarArquivoDocumento(arquivo.nome, arquivo.bytes);
    if (!v.ok) throw new Error(v.erro);
    const dados = { categoria: b.categoria, nomeOriginal: v.nome, mime: v.mime, tamanho: arquivo.bytes.length, conteudo: new Uint8Array(arquivo.bytes), enviadoPorId: u.id, enviadoEm: new Date() };
    let id: string;
    if (typeof b.substituirId === "string" && b.substituirId) {
      const r = await prisma.documentoUsuario.updateMany({ where: { id: b.substituirId, usuarioId }, data: dados });
      if (!r.count) throw new Error("Documento a substituir não encontrado.");
      id = b.substituirId;
    } else {
      id = (await prisma.documentoUsuario.create({ data: { usuarioId, ...dados }, select: { id: true } })).id;
    }
    await limparPartes(uploadId, u.id, "usuario", itemId);
    return NextResponse.json({ ok: true, id, nome: v.nome });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha no envio." }, { status: 400 });
  }
}
