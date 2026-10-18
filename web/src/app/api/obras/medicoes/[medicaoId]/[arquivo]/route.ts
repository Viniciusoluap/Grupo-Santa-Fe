import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exigirObraOuEmpreiteiro } from "@/lib/obras/acesso-empreiteiro";
import { arquivoResposta, erroAcesso } from "@/lib/obras/medicao-arquivo";
import { validarIncidenciasPci } from "@/lib/obras/pci";
import { ehTipoMedicao, normalizarDadosMedicao, QUADROS_FOTO } from "@/lib/medicao-caixa";
import type { DadosPci } from "@/lib/caixa/pci";
import { gerarXlsMedicao, type MedicaoHistorica } from "@/lib/caixa/medicao-xls";
import { gerarPdfMedicao } from "@/lib/caixa/medicao-pdf";
import { SERVICOS_PROGRESSO } from "@/lib/financeiro/progresso";
export const runtime = "nodejs";
const dataIso = (d: Date) => new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
export async function GET(_req: NextRequest, { params }: { params: Promise<{ medicaoId: string; arquivo: string }> }) {
  try {
    const { medicaoId, arquivo } = await params;
    if (arquivo !== "arquivo.xls" && arquivo !== "arquivo.pdf") return NextResponse.json({ error: "Formato inválido." }, { status: 404 });
    // Ler somente a obra antes de autorizar; bytes privados só após a autorização.
    const referencia = await prisma.obraProgressoHistorico.findUnique({ where: { id: medicaoId }, select: { obraId: true } });
    if (!referencia) return NextResponse.json({ error: "Medição não encontrada." }, { status: 404 });
    await exigirObraOuEmpreiteiro(referencia.obraId);
    const m = await prisma.obraProgressoHistorico.findUniqueOrThrow({ where: { id: medicaoId }, include: { pciVersao: true, obra: { select: { nome: true } }, fotos: { orderBy: [{ criadoEm: "asc" }, { id: "asc" }], include: { arquivo: true } } } });
    if (!m.pciVersao) return NextResponse.json({ error: "Esta medição não possui uma versão da PCI vinculada. Revise a medição antes de gerar os arquivos." }, { status: 409 });
    const pci = m.pciVersao.parsed as unknown as DadosPci;
    const itens = m.itens as { chave: string; incidencia: string; execucao: string }[];
    if (!validarIncidenciasPci(itens, pci)) return NextResponse.json({ error: "As incidências salvas diferem da PCI desta medição. Revise a medição." }, { status: 409 });
    if (arquivo === "arquivo.xls" && pci.formato !== "xls") return NextResponse.json({ error: "Para gerar .xls, vincule uma PCI original em .xls." }, { status: 400 });
    const tipo = ehTipoMedicao(m.tipo) ? m.tipo : "pls";
    const dados = normalizarDadosMedicao(tipo, m.dadosCaixa);
    const anterioresBrutas = await prisma.obraProgressoHistorico.findMany({ where: { obraId: m.obraId, OR: [{ criadoEm: { lt: m.criadoEm } }, { criadoEm: m.criadoEm, id: { lt: m.id } }] }, orderBy: [{ criadoEm: "asc" }, { id: "asc" }], select: { progresso: true, criadoEm: true, dadosCaixa: true } });
    const anteriores: MedicaoHistorica[] = anterioresBrutas.map(a => ({ data: (a.dadosCaixa as { pls?: { dataLevantamento?: string } } | null)?.pls?.dataLevantamento || dataIso(a.criadoEm), progresso: Number(a.progresso) }));
    const porChave = new Map(itens.map(i => [i.chave, Number(i.execucao)]));
    const fotos = m.fotos.slice(0, QUADROS_FOTO[tipo]).filter(f => f.arquivo.dados && ["image/jpeg", "image/png"].includes(f.arquivo.mime)).map(f => ({ dados: f.arquivo.dados!, tipo: f.arquivo.mime === "image/png" ? "png" as const : "jpeg" as const, legenda: f.legenda }));
    const entrada = { tipo, pci, execucoes: SERVICOS_PROGRESSO.map(s => porChave.get(s.chave) ?? 0), progresso: Number(m.progresso), anteriores, dados, fotos };
    const formato = arquivo.endsWith(".xls") ? "xls" : "pdf";
    const bytes = formato === "xls" ? gerarXlsMedicao(m.pciVersao.dados, entrada) : gerarPdfMedicao(m.pciVersao.dados, entrada);
    return arquivoResposta(bytes, `${tipo}_${m.obra.nome}_${dados.pls.dataLevantamento}.${formato}`, formato === "xls" ? "application/vnd.ms-excel" : "application/pdf");
  } catch (e) { return erroAcesso(e); }
}
