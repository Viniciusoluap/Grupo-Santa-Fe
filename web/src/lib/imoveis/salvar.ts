// Gravação do cadastro de imóveis, usada pelas ações do formulário e pela rota
// /api/imoveis/salvar — esta informa o progresso real do envio das fotos
// (pedido de 18/10, item 4). As regras de acesso são as mesmas nos dois caminhos.
import { exigirModuloAcao } from "@/lib/auth/modulos";
import { prisma } from "@/lib/db";
import { notificarAdmins } from "@/lib/notificacoes";
import { revalidatePath } from "next/cache";
import { tiposDoCadastro } from "@/lib/portal-corretor";
import { aplicarFotosImovel, lerFotos } from "@/lib/imovel-fotos";

/** Pedido de 15/10: o tipo vem só da lista (o corretor tem 5 opções). */
function tipoValido(perfil: string | null | undefined, tipo: string, atual?: string | null) {
  if (tipo && (tipo === atual || tiposDoCadastro(perfil).some((t) => t.value === tipo))) return;
  throw new Error("Escolha o tipo do imóvel na lista.");
}

export async function criarImovelCore(formData: FormData) {
  const u = await exigirModuloAcao("imoveis");
  const titulo = formData.get("titulo") as string;
  const tipo = formData.get("tipo") as string;
  tipoValido(u.perfil, tipo);
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
  const corretorId = u.perfil === "corretor" ? u.corretorId : ((formData.get("corretorId") as string) || null);
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

  const criado = await prisma.imovel.create({
    select: { id: true },
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
      imagens: "[]",
      latitude,
      longitude,
      corretorId: corretorId || undefined,
    },
  });
  // Pedido de 15/10: fotos vão para o Google Drive (Imóveis/<Título (nº)>/01 - Fotos).
  await aplicarFotosImovel(criado.id, lerFotos(imagens), u.id);

  await notificarAdmins("novo_imovel", "Novo imóvel cadastrado", `${titulo} — ${bairro}`, "/admin/imoveis").catch(() => {});

  revalidatePath("/admin/imoveis");
}

export async function editarImovelCore(formData: FormData) {
  const u = await exigirModuloAcao("imoveis");
  const id = formData.get("id") as string;
  // Item 06: corretor só edita os próprios imóveis e não troca o responsável.
  if (u.perfil === "corretor") {
    const atual = await prisma.imovel.findUnique({ where: { id }, select: { corretorId: true } });
    if (!atual || !u.corretorId || atual.corretorId !== u.corretorId) throw new Error("Imóvel não encontrado ou acesso não autorizado.");
  }
  const titulo = formData.get("titulo") as string;
  const tipo = formData.get("tipo") as string;
  tipoValido(u.perfil, tipo, (await prisma.imovel.findUnique({ where: { id }, select: { tipo: true } }))?.tipo);
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
  const corretorId = u.perfil === "corretor" ? u.corretorId : ((formData.get("corretorId") as string) || null);
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
      destaque, publicadoSite, latitude, longitude,
    },
  });
  await aplicarFotosImovel(id, lerFotos(imagens), u.id);

  revalidatePath("/admin/imoveis");
  revalidatePath(`/admin/imoveis/${id}/editar`);
}

