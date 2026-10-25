import { NextRequest, NextResponse } from "next/server";
import { exigirModuloAcao } from "@/lib/auth/modulos";
import { imovelDoCorretor } from "@/lib/imoveis/salvar";
import { acrescentarFotoImovel, aplicarFotosImovel, lerFotos } from "@/lib/imovel-fotos";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";
export const maxDuration = 60;

async function autorizado(id: string) {
  const usuario = await exigirModuloAcao("imoveis");
  if (usuario.perfil === "corretor") await imovelDoCorretor(id, usuario.id);
  else if (!await prisma.imovel.findUnique({ where: { id }, select: { id: true } })) throw new Error("Imóvel não encontrado.");
  return usuario;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const usuario = await autorizado(id);
    const dados = await req.formData();
    const imagem = dados.get("imagem");
    if (typeof imagem !== "string") throw new Error("Foto não informada.");
    const url = await acrescentarFotoImovel(id, imagem, usuario.id);
    revalidatePath("/admin/imoveis");
    revalidatePath("/corretor/imoveis");
    return NextResponse.json({ url });
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Falha ao enviar foto.";
    return NextResponse.json({ error: mensagem }, { status: /permiss|autoriza|seus cadastros/i.test(mensagem) ? 403 : 400 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const usuario = await autorizado(id);
    const dados = await req.formData();
    const lista = lerFotos(String(dados.get("imagens") ?? "[]"));
    if (lista.some(url => !url.startsWith("/api/imovel-foto/"))) throw new Error("Lista de fotos inválida.");
    await aplicarFotosImovel(id, lista, usuario.id);
    revalidatePath("/admin/imoveis");
    revalidatePath("/corretor/imoveis");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "Falha ao ordenar fotos.";
    return NextResponse.json({ error: mensagem }, { status: /permiss|autoriza|seus cadastros/i.test(mensagem) ? 403 : 400 });
  }
}
