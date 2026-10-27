import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth/modulos";
import { prisma } from "@/lib/db";
import { acessoDocumentosUsuario, contentDisposition, PARTE_DOCUMENTO_USUARIO_BYTES, podeVisualizarNoNavegador } from "@/lib/engenheiro";

export const runtime = "nodejs";

/**
 * Lote 2, correção 04: arquivo original de um documento do usuário, com o nome original.
 * `?offset=N` devolve 1 MB a partir de N (X-Document-Size = tamanho total): a tela baixa
 * em partes por causa do limite de 4,5 MB de resposta da Vercel. `?inline=1` abre no
 * navegador (só PDF e imagem). Acesso: admin e o próprio usuário.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; documentoId: string }> }) {
  try {
    const u = await usuarioAtual();
    if (!u || !u.ativo) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
    const { id: usuarioId, documentoId } = await params;
    const naoEncontrado = NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
    if (!acessoDocumentosUsuario({ id: u.id, papel: u.perfil, ativo: u.ativo }, usuarioId).ver) return naoEncontrado;
    const temOffset = req.nextUrl.searchParams.has("offset");
    const offset = temOffset ? Number(req.nextUrl.searchParams.get("offset")) : 0;
    if (!Number.isSafeInteger(offset) || offset < 0) return NextResponse.json({ error: "Parte inválida." }, { status: 400 });
    const rows = await prisma.$queryRaw<{ nomeOriginal: string; mime: string; tamanho: number; dados: Uint8Array }[]>`
      SELECT "nomeOriginal", mime, tamanho,
        substring(conteudo FROM ${temOffset ? offset + 1 : 1}::int FOR ${temOffset ? PARTE_DOCUMENTO_USUARIO_BYTES : 2147483647}::int) AS dados
      FROM documentos_usuario WHERE id = ${documentoId} AND "usuarioId" = ${usuarioId}`;
    const linha = rows[0];
    if (!linha) return naoEncontrado;
    if (temOffset && offset >= linha.tamanho) return NextResponse.json({ error: "Parte inválida." }, { status: 400 });
    const inline = req.nextUrl.searchParams.get("inline") === "1" && podeVisualizarNoNavegador(linha.mime);
    return new NextResponse(new Uint8Array(linha.dados), {
      headers: {
        "Content-Type": inline || !temOffset ? linha.mime : "application/octet-stream",
        "Content-Disposition": contentDisposition(linha.nomeOriginal, inline),
        "X-Document-Size": String(linha.tamanho),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Erro ao carregar o documento." }, { status: 500 });
  }
}
