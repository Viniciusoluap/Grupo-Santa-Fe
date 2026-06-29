import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { list } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export const runtime = "nodejs";

// iOS Safari fallback: after progress=100% the SDK completion callback sometimes hangs.
// Client calls GET with the known blob path to retrieve the URL directly from storage.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const path = request.nextUrl.searchParams.get("path");
  if (!path || !path.startsWith("docs-avaliacao/")) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }
  try {
    const { blobs } = await list({ prefix: path, limit: 1 });
    if (blobs.length > 0) return NextResponse.json({ url: blobs[0].url });
    return NextResponse.json({ error: "not found yet" }, { status: 404 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// Token generation for client-side Vercel Blob upload
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "image/jpeg",
          "image/png",
          "image/webp",
        ],
        maximumSizeInBytes: 50 * 1024 * 1024,
        // addRandomSuffix:false makes retentativas converge no mesmo path (sem blobs órfãos)
        addRandomSuffix: false,
        // allowOverwrite é opção de put() server-side, não de onBeforeGenerateToken — removido
      }),
      onUploadCompleted: async () => {
        // URL is saved client-side after upload completes
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
