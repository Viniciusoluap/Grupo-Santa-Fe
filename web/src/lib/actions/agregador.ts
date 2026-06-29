"use server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function atualizarStatusAgregador(id: string, status: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.agregadorImovel.update({
    where: { id },
    data: { status },
  });
  revalidatePath("/admin/agregador");
  revalidatePath("/mercado");
}

export async function criarAgregadorImovel(data: {
  titulo: string; descricao?: string; preco?: number; precoTexto?: string;
  area?: number; tipo?: string; bairro?: string; fonte: string; urlFonte?: string;
  imagens?: string[]; documentoTipo?: string; documentoObs?: string;
  contatoNome?: string; contatoTel?: string; notas?: string;
}) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.agregadorImovel.create({
    data: {
      titulo: data.titulo,
      descricao: data.descricao,
      preco: data.preco,
      precoTexto: data.precoTexto,
      area: data.area,
      tipo: data.tipo,
      bairro: data.bairro ?? "",
      fonte: data.fonte,
      urlFonte: data.urlFonte,
      imagens: JSON.stringify(data.imagens ?? []),
      documentoTipo: data.documentoTipo ?? "nenhum",
      documentoObs: data.documentoObs,
      contatoNome: data.contatoNome,
      contatoTel: data.contatoTel,
      notas: data.notas,
      status: "pendente",
    },
  });
  revalidatePath("/admin/agregador");
}

export async function importarParaCatalogo(id: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const ag = await prisma.agregadorImovel.findUnique({ where: { id } });
  if (!ag) return { error: "Imóvel não encontrado" };

  const slug =
    ag.titulo
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 80) +
    "-" +
    Date.now();

  await prisma.imovel.create({
    data: {
      slug,
      titulo: ag.titulo,
      descricao: ag.descricao ?? "",
      tipo: ag.tipo ?? "outro",
      status: "venda",
      preco: ag.preco ?? 0,
      area: ag.area ?? 0,
      bairro: ag.bairro ?? "",
      cidade: ag.cidade,
      estado: ag.estado,
      imagens: ag.imagens,
      publicadoSite: false,
    },
  });

  await prisma.agregadorImovel.update({
    where: { id },
    data: { status: "importado" },
  });

  revalidatePath("/admin/imoveis");
  revalidatePath("/admin/agregador");
}
