import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exigirObraOuEmpreiteiro } from "@/lib/obras/acesso-empreiteiro";
import { arquivoResposta, erroAcesso } from "@/lib/obras/medicao-arquivo";
import { gerarArquivoMedicao } from "@/lib/obras/medicao-gerar";
export const runtime = "nodejs";
export async function GET(_req: NextRequest, { params }: { params: Promise<{ medicaoId: string; arquivo: string }> }) {
  try {
    const { medicaoId, arquivo } = await params;
    if (arquivo !== "arquivo.xls" && arquivo !== "arquivo.pdf") return NextResponse.json({ error: "Formato inválido." }, { status: 404 });
    // Ler somente a obra antes de autorizar; bytes privados só após a autorização.
    const referencia = await prisma.obraProgressoHistorico.findUnique({ where: { id: medicaoId }, select: { obraId: true } });
    if (!referencia) return NextResponse.json({ error: "Medição não encontrada." }, { status: 404 });
    await exigirObraOuEmpreiteiro(referencia.obraId);
    const r = await gerarArquivoMedicao(medicaoId, arquivo === "arquivo.xls" ? "xls" : "pdf");
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return arquivoResposta(r.bytes, r.nome, r.mime);
  } catch (e) { return erroAcesso(e); }
}
