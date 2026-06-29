"use server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { notificarAdmins } from "@/lib/notificacoes";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function criarImovel(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const titulo = formData.get("titulo") as string;
  const tipo = formData.get("tipo") as string;
  const status = formData.get("status") as string;
  const preco = parseFloat(formData.get("preco") as string);
  const area = parseFloat(formData.get("area") as string) || 0;
  const bairro = formData.get("bairro") as string;
  const cidade = (formData.get("cidade") as string) || "Canaã dos Carajás";
  const descricao = (formData.get("descricao") as string) || "";
  const quartos = parseInt(formData.get("quartos") as string) || null;
  const banheiros = parseInt(formData.get("banheiros") as string) || null;
  const vagas = parseInt(formData.get("vagas") as string) || null;
  const suites = parseInt(formData.get("suites") as string) || null;
  const corretorId = (formData.get("corretorId") as string) || null;
  const imagens = (formData.get("imagens") as string) || "[]";
  const latRaw = formData.get("latitude") as string;
  const lngRaw = formData.get("longitude") as string;
  const latitude = latRaw ? parseFloat(latRaw) : null;
  const longitude = lngRaw ? parseFloat(lngRaw) : null;

  // Generate slug from titulo
  const slug =
    titulo
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
      titulo,
      tipo,
      status,
      preco,
      area,
      bairro,
      cidade,
      descricao,
      quartos,
      banheiros,
      vagas,
      suites,
      imagens,
      latitude,
      longitude,
      corretorId: corretorId || undefined,
    },
  });

  await notificarAdmins("novo_imovel", "Novo imóvel cadastrado", `${titulo} — ${bairro}`, "/admin/imoveis").catch(() => {});

  revalidatePath("/admin/imoveis");
  redirect("/admin/imoveis");
}

export async function editarImovel(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const id = formData.get("id") as string;
  const titulo = formData.get("titulo") as string;
  const tipo = formData.get("tipo") as string;
  const status = formData.get("status") as string;
  const preco = parseFloat(formData.get("preco") as string);
  const area = parseFloat(formData.get("area") as string) || 0;
  const bairro = formData.get("bairro") as string;
  const cidade = (formData.get("cidade") as string) || "Canaã dos Carajás";
  const descricao = (formData.get("descricao") as string) || "";
  const quartos = parseInt(formData.get("quartos") as string) || null;
  const banheiros = parseInt(formData.get("banheiros") as string) || null;
  const vagas = parseInt(formData.get("vagas") as string) || null;
  const suites = parseInt(formData.get("suites") as string) || null;
  const corretorId = (formData.get("corretorId") as string) || null;
  const destaque = formData.get("destaque") === "on";
  const publicadoSite = formData.get("publicadoSite") === "on";
  const imagens = (formData.get("imagens") as string) || "[]";
  const latRaw = formData.get("latitude") as string;
  const lngRaw = formData.get("longitude") as string;
  const latitude = latRaw ? parseFloat(latRaw) : null;
  const longitude = lngRaw ? parseFloat(lngRaw) : null;

  await prisma.imovel.update({
    where: { id },
    data: {
      titulo, tipo, status, preco, area, bairro, cidade, descricao,
      quartos, banheiros, vagas, suites, corretorId: corretorId || undefined,
      destaque, publicadoSite, imagens, latitude, longitude,
    },
  });

  revalidatePath("/admin/imoveis");
  revalidatePath(`/admin/imoveis/${id}/editar`);
  redirect("/admin/imoveis");
}

export async function excluirImovel(id: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.imovel.delete({ where: { id } });
  revalidatePath("/admin/imoveis");
}
