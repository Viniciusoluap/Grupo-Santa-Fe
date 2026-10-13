import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth/modulos";
import { podeAcessarModulo } from "@/lib/perfis-acesso";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

interface Documento {
  id: string;
  nome: string;
  url: string;
  tipo: string;
  tamanho: number;
}

function parseDocumentos(raw: string): Documento[] {
  try {
    return JSON.parse(raw) as Documento[];
  } catch {
    return [];
  }
}

// Serve o conteúdo do documento de avaliação por dentro do servidor — a URL
// pública do Vercel Blob fica só no banco, nunca é enviada ao navegador.
// Fecha a pendência registrada na S-05: antes, a tela linkava direto para a
// URL pública do Blob, que qualquer um com o link conseguia abrir sem sessão.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  // Item 06: mesma permissão das telas de Avaliações (módulo liberado, conta ativa).
  const usuario = await usuarioAtual();
  if (!usuario?.ativo) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!podeAcessarModulo(usuario, "avaliacao")) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const { id, docId } = await params;
  const avaliacao = await prisma.avaliacao.findUnique({
    where: { id },
    select: { documentos: true },
  });
  if (!avaliacao) return NextResponse.json({ error: "Avaliação não encontrada" }, { status: 404 });

  const doc = parseDocumentos(avaliacao.documentos).find((d) => d.id === docId);
  if (!doc) return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });

  const upstream = await fetch(doc.url);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Falha ao buscar o arquivo" }, { status: 502 });
  }

  const inline = request.nextUrl.searchParams.get("download") !== "1";
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": doc.tipo || "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(doc.nome)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
