import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { usuarioAtual } from "@/lib/auth/modulos";
import { podeAcessarModulo } from "@/lib/perfis-acesso";
import { prisma } from "@/lib/db";
import { lerDataUrl, podeGerenciarFotos, validarFotoObra } from "@/lib/obras/fotos";

export const runtime = "nodejs";

// EPIC-020 Lote 4 (item 28) — envio de foto da obra (admin ou equipe com o módulo Obras). Os bytes
// vão para a tabela "arquivos" (banco próprio) e os metadados para
// "obra_fotos", na mesma transação. Mesmas regras da Prospecta.

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await usuarioAtual();
    if (!user?.ativo) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
    const { id: obraId } = await params;
    // Pedido de 15/10: o empreiteiro vinculado também envia fotos da própria obra.
    const dona = await prisma.obra.findUnique({ where: { id: obraId }, select: { empreiteiroId: true } });
    if (!podeGerenciarFotos({ id: user.id, papel: user.perfil ?? "", acessoObras: podeAcessarModulo(user, "obras") }, { empreiteiroId: dona?.empreiteiroId ?? null }))
      return NextResponse.json({ error: "Sem permissão para enviar fotos desta obra." }, { status: 403 });

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const base64 = lerDataUrl(body?.image);
    if (!base64) return NextResponse.json({ error: "Imagem ausente ou em formato inválido." }, { status: 400 });
    const bytes = Buffer.from(base64, "base64");
    const legenda = typeof body?.caption === "string" && body.caption.trim() ? body.caption.trim() : null;
    const validacao = validarFotoObra(bytes, legenda);
    if (!validacao.ok) return NextResponse.json({ error: validacao.erro }, { status: 400 });
    const tiradaEm = typeof body?.takenAt === "string" && !Number.isNaN(Date.parse(body.takenAt)) ? new Date(body.takenAt) : new Date();
    if (tiradaEm.getTime() > Date.now() + 86_400_000) return NextResponse.json({ error: "Data da foto no futuro." }, { status: 400 });

    const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { id: true } });
    if (!obra) return NextResponse.json({ error: "Obra não encontrada." }, { status: 404 });

    const medicaoId = typeof body?.medicaoId === "string" ? body.medicaoId : null;
    if (medicaoId && !(await prisma.obraProgressoHistorico.findFirst({ where: { id: medicaoId, obraId }, select: { id: true } }))) return NextResponse.json({ error: "Medição não pertence a esta obra." }, { status: 400 });

    const dados = new Uint8Array(new ArrayBuffer(bytes.byteLength));
    dados.set(bytes);
    const extensao = validacao.mime.split("/")[1];
    const foto = await prisma.$transaction(async (tx) => {
      const arquivo = await tx.arquivo.create({
        data: { nome: `obra-${obraId}-${Date.now()}.${extensao}`, mime: validacao.mime, tamanho: bytes.length, dados },
        select: { id: true },
      });
      return tx.obraFoto.create({
        data: { medicaoId, obraId, arquivoId: arquivo.id, legenda, tiradaEm, incluirNoRelatorio: body?.includeInReport !== false, enviadoPorId: user.id },
        select: { id: true, legenda: true, tiradaEm: true, incluirNoRelatorio: true },
      });
    });
    revalidatePath(`/admin/obras/${obraId}/editar`);
    revalidatePath(`/empreiteiro/obras/${obraId}/editar`);
    return NextResponse.json({ ...foto, url: `/api/obras/fotos/${foto.id}` });
  } catch (error) {
    console.error("[obra-fotos] envio:", error);
    return NextResponse.json({ error: "Erro ao gravar a foto. Tente novamente." }, { status: 500 });
  }
}
