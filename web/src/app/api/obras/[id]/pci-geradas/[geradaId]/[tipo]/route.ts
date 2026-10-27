// Lote 2, correção 03: download da PCI gerada (planilha .xls/.xlsm ou PDF).
// Admin ou colaborador com Obras (o empreiteiro não usa o gerador).
import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth/modulos";
import { MIME_MODELO_PCI, type FormatoModeloPci } from "@/lib/pci-gerador";
import { arquivoPciGerada, podeUsarGeradorPci } from "@/lib/obras/pci-gerador-dados";
import { respostaArquivoEmPartes } from "@/lib/obras/pci-gerador-resposta";
export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; geradaId: string; tipo: string }> }) {
  try {
    const u = await usuarioAtual();
    if (!u || !u.ativo) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
    if (!podeUsarGeradorPci(u)) return NextResponse.json({ error: "Sem permissão nesta obra." }, { status: 403 });
    const { id, geradaId, tipo } = await params;
    if (tipo !== "planilha" && tipo !== "pdf") return NextResponse.json({ error: "PCI gerada não encontrada." }, { status: 404 });
    const a = await arquivoPciGerada(id, geradaId, tipo);
    if (!a) return NextResponse.json({ error: "PCI gerada não encontrada." }, { status: 404 });
    const mime = tipo === "pdf" ? "application/pdf" : MIME_MODELO_PCI[a.formato as FormatoModeloPci] ?? "application/octet-stream";
    return respostaArquivoEmPartes(req, a.bytes, a.nome, mime);
  } catch (e) {
    console.error("[pci-gerador] download:", e instanceof Error ? e.message : "erro");
    return NextResponse.json({ error: "Erro ao baixar a PCI gerada." }, { status: 500 });
  }
}
