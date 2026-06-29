import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export const runtime = "nodejs";

// 4 MB — Vercel serverless body is 4.5 MB; leave headroom for multipart overhead
const MAX_FILE_BYTES = 4 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Arquivo não encontrado na requisição." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: `Tipo de arquivo não permitido: ${file.type}` }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Limite: 4 MB por arquivo.` },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const blob = await put(file.name, Buffer.from(arrayBuffer), {
      access: "public",
      contentType: file.type,
    });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes("BLOB_READ_WRITE_TOKEN") ||
      message.toLowerCase().includes("token") ||
      message.includes("Unauthorized")
    ) {
      return NextResponse.json(
        { error: "Blob Storage não configurado. Adicione BLOB_READ_WRITE_TOKEN nas variáveis de ambiente do Vercel." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
