import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { usuarioAtual } from "@/lib/auth/modulos";
import { prisma } from "@/lib/db";
import { tentarUploadDrive, uploadDocumentoCliente } from "@/lib/incorporacao/registro-drive";

export const runtime = "nodejs";
export const maxDuration = 60;

const TIPOS: Record<string, (b: Buffer) => boolean> = {
  "application/pdf": (b) => b.subarray(0, 4).toString() === "%PDF",
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b.subarray(0, 4).equals(Buffer.from([137, 80, 78, 71])),
};

// Pedido de 18/10 (item 15): o cliente envia ou substitui, pelo Portal, o
// documento de um item do checklist do próprio financiamento. O servidor confere
// a conta de cliente e o lead dono do financiamento; item aprovado não muda.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioAtual();
  if (!u?.ativo || u.perfil !== "cliente") return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  // O vínculo da conta com o lead vem do banco, não da sessão.
  const conta = await prisma.usuario.findUnique({ where: { id: u.id }, select: { leadId: true } });
  const leadId = conta?.leadId;
  if (!leadId) return NextResponse.json({ error: "Conta sem cliente vinculado." }, { status: 403 });
  const { id } = await params;
  const item = await prisma.checklistItem.findUnique({
    where: { id },
    select: { id: true, item: true, concluido: true, arquivoId: true, financiamento: { select: { leadId: true } } },
  });
  if (!item || item.financiamento.leadId !== leadId) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  if (item.concluido) return NextResponse.json({ error: "Este documento já foi aprovado pela equipe." }, { status: 409 });

  const dados = await req.formData();
  const arquivo = dados.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return NextResponse.json({ error: "Escolha o arquivo." }, { status: 400 });
  const confere = TIPOS[arquivo.type];
  if (!confere || arquivo.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Envie PDF, JPG ou PNG de até 10 MB." }, { status: 400 });
  const bytes = Buffer.from(await arquivo.arrayBuffer());
  if (!confere(bytes)) return NextResponse.json({ error: "O arquivo não corresponde ao tipo informado." }, { status: 400 });

  const nome = arquivo.name.slice(0, 200) || item.item;
  const { fileId } = await tentarUploadDrive(() =>
    uploadDocumentoCliente({ leadId, area: "financiamento", rotulo: item.item, nomeOriginal: nome, mime: arquivo.type, bytes })
  );
  await prisma.$transaction(async (tx) => {
    const novo = await tx.arquivo.create({
      data: { nome, mime: arquivo.type, tamanho: bytes.length, ...(fileId ? { driveFileId: fileId } : { dados: bytes }) },
      select: { id: true },
    });
    await tx.checklistItem.update({ where: { id: item.id }, data: { arquivoId: novo.id, enviadoEm: new Date() } });
    // Substituição: o arquivo anterior deixa de existir no sistema.
    if (item.arquivoId) await tx.arquivo.delete({ where: { id: item.arquivoId } }).catch(() => undefined);
  });
  revalidatePath("/portal/financiamento");
  revalidatePath("/admin/financiamentos");
  return NextResponse.json({ ok: true });
}
