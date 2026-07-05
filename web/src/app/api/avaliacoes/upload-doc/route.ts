import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { uploadPublico } from "@/lib/blob";

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
    const blob = await uploadPublico(file.name, Buffer.from(arrayBuffer), file.type);
    if (!blob.url) return NextResponse.json({ error: blob.erro }, { status: 500 });

    return NextResponse.json({ url: blob.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
