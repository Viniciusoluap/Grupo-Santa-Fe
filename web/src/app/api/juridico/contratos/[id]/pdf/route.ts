import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { exigirModuloAcao } from "@/lib/auth/modulos";
import { prisma } from "@/lib/db";
import { salvarContratoCliente } from "@/lib/blob";

export const runtime = "nodejs";
export const maxDuration = 60;

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
