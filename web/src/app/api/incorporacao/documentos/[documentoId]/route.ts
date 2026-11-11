import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth/modulos";
import { podeAcessarModulo } from "@/lib/perfis-acesso";
import { prisma } from "@/lib/db";
import { lerDocumentoRegistro, lerTrechoDocumentoRegistro } from "@/lib/incorporacao/registro-drive";
import { anexoVisualizavel, PARTE_ANEXO_BYTES, partesDoAnexo } from "@/lib/incorporacao/anexos";

/** A resposta de uma Vercel Function também é limitada (~4,5 MB): acima disso o arquivo é lido em partes (`?parte=N`). */
const LIMITE_RESPOSTA = 4 * 1024 * 1024;

export async function GET(request: Request, { params }: { params: Promise<{ documentoId: string }> }) {
  // Item 06: mesma permissão das telas/actions do registro (módulo Incorporação).
  const usuario = await usuarioAtual();
  if (!usuario?.ativo) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!podeAcessarModulo(usuario, "incorporacao")) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  const { documentoId } = await params;
  if (!documentoId || documentoId.length > 100) return NextResponse.json({ error: "Documento inválido." }, { status: 400 });
  const documento = await prisma.estudoDocumentoRegistro.findUnique({
    where: { id: documentoId }, select: { ativo: true, driveFileId: true, mime: true, nome: true, tamanho: true, arquivoId: true },
  });
  if (!documento?.ativo) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  const parteTexto = new URL(request.url).searchParams.get("parte");
  const partes = partesDoAnexo(documento.tamanho);
  try {
    if (parteTexto !== null) {
      // Leitura em partes de 2 MiB (anexos grandes): bytes crus, o navegador junta.
      const parte = Number(parteTexto);
      if (!Number.isInteger(parte) || parte < 0 || parte >= partes) return NextResponse.json({ error: "Parte inválida." }, { status: 400 });
      const inicio = parte * PARTE_ANEXO_BYTES, fim = Math.min(documento.tamanho, inicio + PARTE_ANEXO_BYTES);
      let data: Buffer | null = null;
      if (documento.arquivoId) {
        const linhas = await prisma.$queryRaw<{ trecho: Uint8Array | null }[]>`SELECT substring("dados" from ${inicio + 1}::int for ${fim - inicio}::int) AS trecho FROM "arquivos" WHERE "id" = ${documento.arquivoId}`;
        data = linhas[0]?.trecho ? Buffer.from(linhas[0].trecho) : null;
      }
      if (!data && documento.driveFileId) data = await lerTrechoDocumentoRegistro(documento.driveFileId, inicio, fim);
      if (!data || data.length !== fim - inicio) throw new Error("Documento sem arquivo.");
      return new NextResponse(new Uint8Array(data), {
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Anexo-Partes": String(partes), "X-Anexo-Tamanho": String(documento.tamanho),
          "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (documento.tamanho > LIMITE_RESPOSTA)
      return NextResponse.json({ error: "Arquivo grande: leia em partes.", partes }, { status: 413, headers: { "Cache-Control": "no-store" } });
    // Arquivo guardado no banco quando o Drive recusou a gravação; senão, no Drive.
    const completo = await prisma.estudoDocumentoRegistro.findUnique({ where: { id: documentoId }, select: { arquivo: { select: { dados: true } } } });
    const data = completo?.arquivo?.dados ? Buffer.from(completo.arquivo.dados)
      : documento.driveFileId ? await lerDocumentoRegistro(documento.driveFileId) : null;
    if (!data) throw new Error("Documento sem arquivo.");
    // PDF/foto/texto abrem na aba; os demais (DWG, Word...) são baixados com o nome original.
    const disposicao = anexoVisualizavel(documento.mime) ? "inline" : "attachment";
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": documento.mime,
        "Content-Disposition": `${disposicao}; filename*=UTF-8''${encodeURIComponent(documento.nome)}`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return NextResponse.json({ error: "Documento indisponível no armazenamento privado." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
