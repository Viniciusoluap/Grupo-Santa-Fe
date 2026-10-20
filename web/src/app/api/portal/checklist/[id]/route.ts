import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { usuarioAtual } from "@/lib/auth/modulos";
import { prisma } from "@/lib/db";
import { enviarParaLixeira, tentarUploadDrive, uploadDocumentoCliente } from "@/lib/incorporacao/registro-drive";

export const runtime = "nodejs";
export const maxDuration = 60;
// A Vercel recusa corpos acima de 4,5 MB antes de chegar aqui: o limite fica abaixo.
const LIMITE = 4 * 1024 * 1024;

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
    select: { id: true, item: true, concluido: true, arquivoId: true, visivelCliente: true, solicitadoEm: true, legado: true, financiamento: { select: { leadId: true } } },
  });
  if (!item || !item.visivelCliente || !item.solicitadoEm || item.legado || item.financiamento.leadId !== leadId) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  if (item.concluido) return NextResponse.json({ error: "Este documento já foi aprovado pela equipe." }, { status: 409 });

  const dados = await req.formData();
  const arquivo = dados.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return NextResponse.json({ error: "Escolha o arquivo." }, { status: 400 });
  const confere = TIPOS[arquivo.type];
  if (!confere || arquivo.size > LIMITE) return NextResponse.json({ error: "Envie PDF, JPG ou PNG de até 4 MB." }, { status: 400 });
  const bytes = Buffer.from(await arquivo.arrayBuffer());
  if (!confere(bytes)) return NextResponse.json({ error: "O arquivo não corresponde ao tipo informado." }, { status: 400 });

  const nome = arquivo.name.slice(0, 200) || item.item;
  const { fileId } = await tentarUploadDrive(() =>
    uploadDocumentoCliente({ leadId, area: "financiamento", rotulo: item.item, nomeOriginal: nome, mime: arquivo.type, bytes })
  );
  // A troca só vale se o item continua sem aprovação e com o mesmo arquivo de
  // quando o envio começou (a equipe pode ter aprovado durante o upload).
  const trocou = await prisma.$transaction(async (tx) => {
    const novo = await tx.arquivo.create({
      data: { nome, mime: arquivo.type, tamanho: bytes.length, ...(fileId ? { driveFileId: fileId } : { dados: bytes }) },
      select: { id: true },
    });
    const { count } = await tx.checklistItem.updateMany({
      where: { id: item.id, concluido: false, arquivoId: item.arquivoId },
      data: { arquivoId: novo.id, enviadoEm: new Date() },
    });
    if (count === 0) {
      await tx.arquivo.delete({ where: { id: novo.id } });
      return false;
    }
    // Substituição: o arquivo anterior deixa de existir no sistema.
    if (item.arquivoId) await tx.arquivo.delete({ where: { id: item.arquivoId } }).catch(() => undefined);
    return true;
  });
  if (!trocou) {
    if (fileId) await enviarParaLixeira(fileId).catch(() => undefined);
    return NextResponse.json({ error: "Este documento foi aprovado ou alterado pela equipe durante o envio. Atualize a página." }, { status: 409 });
  }
  revalidatePath("/portal/financiamento");
  revalidatePath("/admin/financiamentos");
  return NextResponse.json({ ok: true });
}
