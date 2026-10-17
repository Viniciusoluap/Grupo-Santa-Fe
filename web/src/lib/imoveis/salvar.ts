// Gravação do cadastro de imóveis, usada pelas ações do formulário e pela rota
// /api/imoveis/salvar — esta informa o progresso real do envio das fotos
// (pedido de 18/10, item 4). As regras de acesso são as mesmas nos dois caminhos.
import { exigirModuloAcao } from "@/lib/auth/modulos";
import { prisma } from "@/lib/db";
import { notificarAdmins } from "@/lib/notificacoes";
import { revalidatePath } from "next/cache";
import { tiposDoCadastro } from "@/lib/portal-corretor";
import { aplicarFotosImovel, lerFotos } from "@/lib/imovel-fotos";

const SITUACOES_REVISAO = ["pendente", "aprovado", "recusado"] as const;

/** Situação da revisão escolhida pela equipe no formulário (ausente = mantém). */
function revisaoDoFormulario(formData: FormData): (typeof SITUACOES_REVISAO)[number] | null {
  const v = formData.get("revisaoStatus");
  return typeof v === "string" && (SITUACOES_REVISAO as readonly string[]).includes(v) ? (v as (typeof SITUACOES_REVISAO)[number]) : null;
}

/**
 * Itens 3 e 8 (18/10), igual à Prospecta: o corretor edita e exclui só o imóvel
 * que ele cadastrou.
 */
export async function imovelDoCorretor(id: string, usuarioId: string) {
  const imovel = await prisma.imovel.findFirst({ where: { id, cadastradoPorId: usuarioId }, select: { id: true, tipo: true } });
  if (!imovel) throw new Error("Imóvel não encontrado entre os seus cadastros.");
  return imovel;
}

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
  const ehCorretor = u.perfil === "corretor";
  // O formulário do Portal do Corretor não tem "Situação": entra como venda.
  const status = (formData.get("status") as string) || "venda";
  const preco = parseFloat(formData.get("preco") as string);
  if (!(preco > 0)) throw new Error("Informe o preço do imóvel.");
  const area = parseFloat(formData.get("area") as string) || 0;
  const bairro = (formData.get("bairro") as string) || "";
  const cidade = (formData.get("cidade") as string) || "Canaã dos Carajás";
  const estado = ((formData.get("estado") as string) || "PA").trim().toUpperCase().slice(0, 2) || "PA";
  const rua = (formData.get("rua") as string) || "";
  const descricao = (formData.get("descricao") as string) || "";
  const quartos = parseInt(formData.get("quartos") as string) || null;
  const banheiros = parseInt(formData.get("banheiros") as string) || null;
  const vagas = parseInt(formData.get("vagas") as string) || null;
  const suites = parseInt(formData.get("suites") as string) || null;
  const corretorId = ehCorretor ? u.corretorId : ((formData.get("corretorId") as string) || null);
  const imagens = (formData.get("imagens") as string) || "[]";
  const latRaw = formData.get("latitude") as string;
  const lngRaw = formData.get("longitude") as string;
  const latitude = latRaw ? parseFloat(latRaw) : null;
  const longitude = lngRaw ? parseFloat(lngRaw) : null;
  // Itens 3 e 8 (18/10): cadastro do corretor entra pendente e fora do site até
  // a equipe aprovar; a equipe escolhe a situação no próprio formulário.
  const revisao = ehCorretor ? "pendente" : (revisaoDoFormulario(formData) ?? "aprovado");

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
      estado,
      rua,
      descricao,
      quartos,
      banheiros,
      vagas,
      suites,
      imagens: "[]",
      latitude,
      longitude,
      corretorId: corretorId || undefined,
      revisaoStatus: revisao,
      revisadoEm: ehCorretor ? null : new Date(),
      ...(ehCorretor ? { cadastradoPorId: u.id, publicadoSite: false } : {}),
    },
  });
  // Pedido de 15/10: fotos vão para o Google Drive (Imóveis/<Título (nº)>/01 - Fotos).
  await aplicarFotosImovel(criado.id, lerFotos(imagens), u.id);

  await notificarAdmins(
    "novo_imovel",
    ehCorretor ? "Imóvel enviado para revisão" : "Novo imóvel cadastrado",
    `${titulo}${bairro ? ` — ${bairro}` : ""}`,
    ehCorretor ? `/admin/imoveis/${criado.id}/editar` : "/admin/imoveis",
  ).catch(() => {});

  revalidatePath("/admin/imoveis");
  revalidatePath("/corretor/imoveis");
}

export async function editarImovelCore(formData: FormData) {
  const u = await exigirModuloAcao("imoveis");
  const id = formData.get("id") as string;
  const ehCorretor = u.perfil === "corretor";
  // Item 3 (18/10): corretor só edita o próprio cadastro e não troca o responsável.
  const atual = ehCorretor
    ? await imovelDoCorretor(id, u.id).then(() => prisma.imovel.findUniqueOrThrow({ where: { id }, select: { tipo: true, status: true, revisaoStatus: true, estado: true, rua: true, suites: true, latitude: true, longitude: true } }))
    : await prisma.imovel.findUnique({ where: { id }, select: { tipo: true, status: true, revisaoStatus: true, estado: true, rua: true, suites: true, latitude: true, longitude: true } });
  if (!atual) throw new Error("Imóvel não encontrado.");
  const titulo = formData.get("titulo") as string;
  const tipo = formData.get("tipo") as string;
  tipoValido(u.perfil, tipo, atual.tipo);
  const status = (formData.get("status") as string) || atual.status;
  const preco = parseFloat(formData.get("preco") as string);
  const area = parseFloat(formData.get("area") as string) || 0;
  if (!(preco > 0)) throw new Error("Informe o preço do imóvel.");
  const bairro = (formData.get("bairro") as string) || "";
  const cidade = (formData.get("cidade") as string) || "Canaã dos Carajás";
  const estado = formData.has("estado") ? ((formData.get("estado") as string) || "PA").trim().toUpperCase().slice(0, 2) || "PA" : atual.estado;
  const rua = formData.has("rua") ? (formData.get("rua") as string) || "" : atual.rua;
  const descricao = (formData.get("descricao") as string) || "";
  const quartos = parseInt(formData.get("quartos") as string) || null;
  const banheiros = parseInt(formData.get("banheiros") as string) || null;
  const vagas = parseInt(formData.get("vagas") as string) || null;
  // Campos que o formulário do corretor não tem ficam como estão.
  const suites = formData.has("suites") ? parseInt(formData.get("suites") as string) || null : atual.suites;
  const corretorId = ehCorretor ? u.corretorId : ((formData.get("corretorId") as string) || null);
  const destaque = formData.get("destaque") === "on";
  const publicadoSite = formData.get("publicadoSite") === "on";
  const imagens = (formData.get("imagens") as string) || "[]";
  const latRaw = formData.get("latitude") as string;
  const lngRaw = formData.get("longitude") as string;
  const latitude = formData.has("latitude") ? (latRaw ? parseFloat(latRaw) : null) : atual.latitude;
  const longitude = formData.has("longitude") ? (lngRaw ? parseFloat(lngRaw) : null) : atual.longitude;

  // Item 3 (18/10): a edição do corretor volta para a revisão da equipe e sai do
  // site até ser aprovada de novo. A equipe decide a situação no formulário; a
  // data da decisão só muda quando a situação muda.
  const revisao = ehCorretor ? "pendente" : (revisaoDoFormulario(formData) ?? atual.revisaoStatus);
  await prisma.imovel.update({
    where: { id },
    data: {
      titulo, tipo, status, preco, area, bairro, cidade, estado, rua, descricao,
      quartos, banheiros, vagas, suites, corretorId: corretorId || undefined,
      latitude, longitude,
      revisaoStatus: revisao,
      ...(ehCorretor
        ? { revisadoEm: null, publicadoSite: false }
        : { destaque, publicadoSite, ...(revisao !== atual.revisaoStatus ? { revisadoEm: new Date() } : {}) }),
    },
  });
  await aplicarFotosImovel(id, lerFotos(imagens), u.id);

  revalidatePath("/admin/imoveis");
  revalidatePath(`/admin/imoveis/${id}/editar`);
  revalidatePath("/corretor/imoveis");
}

