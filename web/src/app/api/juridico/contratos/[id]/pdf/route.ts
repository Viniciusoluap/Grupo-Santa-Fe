import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { exigirModuloAcao } from "@/lib/auth/modulos";
import { prisma } from "@/lib/db";
import { MODELOS_CONTRATO, modeloNovo } from "@/lib/contratos/modelos";
import { gerarPdfModelo } from "@/lib/contratos/pdf";
import { salvarContratoCliente } from "@/lib/blob";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await exigirModuloAcao("juridico", { somenteEquipe: true });
  } catch {
    return NextResponse.json({ error: "Sem permissão para o Jurídico." }, { status: 403 });
  }
  const { id } = await params;
  const contrato = await prisma.contrato.findUnique({
    where: { id },
    select: { tipo: true, numero: true, dataAssinatura: true, clausulas: true, assinantes: true },
  });
  if (!contrato || !modeloNovo(contrato.tipo) || !contrato.dataAssinatura ||
      !Array.isArray(contrato.assinantes) || !contrato.assinantes.every((v) => typeof v === "string")) {
    return NextResponse.json({ error: "Contrato ou modelo não encontrado." }, { status: 404 });
  }
  const pdf = gerarPdfModelo({
    numero: contrato.numero, titulo: MODELOS_CONTRATO[contrato.tipo],
    data: contrato.dataAssinatura, clausulas: contrato.clausulas, assinaturas: contrato.assinantes,
  });
  return new Response(pdf.output("arraybuffer"), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${contrato.numero.replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

// Item 11 (18/10): anexar o PDF do contrato a partir do lead — envio com progresso
// real (rota em vez de ação do servidor) e o arquivo gravado como no Jurídico.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await exigirModuloAcao("juridico");
  } catch {
    return NextResponse.json({ error: "Sem permissão para o Jurídico." }, { status: 403 });
  }
  const { id } = await params;
  const contrato = await prisma.contrato.findUnique({ where: { id }, select: { id: true, numero: true, leadId: true } });
  if (!contrato) return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 });
  const dados = await req.formData();
  const arquivo = dados.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return NextResponse.json({ error: "Escolha o PDF." }, { status: 400 });
  // A Vercel recusa corpos acima de 4,5 MB antes de chegar aqui: o limite fica abaixo.
  if (arquivo.type !== "application/pdf" || arquivo.size > 4 * 1024 * 1024)
    return NextResponse.json({ error: "Envie um PDF de até 4 MB." }, { status: 400 });
  const bytes = Buffer.from(await arquivo.arrayBuffer());
  if (bytes.subarray(0, 4).toString() !== "%PDF") return NextResponse.json({ error: "O arquivo não é um PDF válido." }, { status: 400 });
  const salvo = await salvarContratoCliente({ leadId: contrato.leadId, rotulo: `Contrato ${contrato.numero}`, nome: `${contrato.numero}-${Date.now()}.pdf`, bytes });
  if (!salvo.url) return NextResponse.json({ error: salvo.erro ?? "Falha ao gravar o PDF." }, { status: 502 });
  await prisma.contratoDocumento.create({ data: { contratoId: contrato.id, nome: arquivo.name.slice(0, 200) || `Contrato ${contrato.numero}`, url: salvo.url, tipo: "contrato_gerado" } });
  revalidatePath("/admin/juridico");
  if (contrato.leadId) revalidatePath(`/admin/leads/${contrato.leadId}`);
  return NextResponse.json({ ok: true });
}
