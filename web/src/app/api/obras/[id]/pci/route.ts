import { NextRequest, NextResponse } from "next/server";
import { exigirObraOuEmpreiteiro } from "@/lib/obras/acesso-empreiteiro";
import { gravarPci, obterPci, LIMITE_PCI, PciInvalida } from "@/lib/obras/pci";
import { arquivoResposta, erroAcesso } from "@/lib/obras/medicao-arquivo";
export const runtime = "nodejs";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const usuarioId = await exigirObraOuEmpreiteiro(id);
    if (!usuarioId) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    const body = await req.json().catch(() => null);
    const b64 = typeof body?.arquivo === "string" ? body.arquivo.replace(/^data:[^,]*,/, "") : "";
    if (!b64 || b64.length > Math.ceil(LIMITE_PCI / 3) * 4 + 16 || !/^[A-Za-z0-9+/=\s]+$/.test(b64)) return NextResponse.json({ error: "PCI inválida ou maior que 3 MiB." }, { status: 400 });
    const nome = typeof body?.nome === "string" ? body.nome.slice(0, 255) : "pci.xls";
    let gravada;
    try { gravada = await gravarPci(id, nome, new Uint8Array(Buffer.from(b64, "base64")), usuarioId); }
    catch (e) { if (e instanceof PciInvalida) return NextResponse.json({ error: e.message }, { status: 400 }); throw e; }
    const { parsed, drive } = gravada;
    return NextResponse.json({ arquivo: nome, formato: parsed.formato, proponente: parsed.identificacao.proponente, drive });
  } catch (e) { return erroAcesso(e); }
}
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await exigirObraOuEmpreiteiro(id);
    const pci = await obterPci(id);
    if (!pci) return NextResponse.json({ error: "PCI não encontrada." }, { status: 404 });
    return arquivoResposta(pci.versao.dados, pci.versao.nome, "application/octet-stream");
  } catch (e) { return erroAcesso(e); }
}
