// Lote 2, correção 03: download do arquivo original de uma versão do modelo da PCI. Só admin.
import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth/modulos";
import { MIME_MODELO_PCI, type FormatoModeloPci } from "@/lib/pci-gerador";
import { arquivoDoModeloPci, podeGerenciarModelosPci } from "@/lib/obras/pci-gerador-dados";
import { respostaArquivoEmPartes } from "@/lib/obras/pci-gerador-resposta";
export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const u = await usuarioAtual();
    if (!u || !u.ativo) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
    if (!podeGerenciarModelosPci(u)) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    const { id } = await params;
    const m = await arquivoDoModeloPci(id);
    if (!m) return NextResponse.json({ error: "Modelo não encontrado." }, { status: 404 });
    return respostaArquivoEmPartes(req, new Uint8Array(m.dados), m.nome, MIME_MODELO_PCI[m.formato as FormatoModeloPci] ?? "application/octet-stream");
  } catch (e) {
    console.error("[pci-gerador] download do modelo:", e instanceof Error ? e.message : "erro");
    return NextResponse.json({ error: "Erro ao baixar o modelo." }, { status: 500 });
  }
}
