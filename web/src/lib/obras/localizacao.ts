// Lote 23/10, etapa 3 — "Localização exata" da obra → imóvel vinculado → Mapa
// Operacional. Gêmeo de server/obra-localizacao.ts da Prospecta.
import { randomBytes } from "node:crypto";
import type { TransacaoCRM } from "@/lib/crm/vinculo-lead";
import { coordenadasSalvas, imovelDaObra, normalizarCoordenadas, type Coordenadas } from "@/lib/obra-localizacao";
import { prisma } from "@/lib/db";

/** Lê os campos do formulário; `undefined` = campo ausente (não mexe na localização). */
export function coordenadasDoFormulario(fd: FormData): Coordenadas | null | undefined {
  if (!fd.has("localizacaoPresente")) return undefined;
  const lat = String(fd.get("localizacaoLat") ?? "").trim();
  const lng = String(fd.get("localizacaoLng") ?? "").trim();
  if (!lat && !lng) return null;
  return normalizarCoordenadas({ lat, lng });
}

/** Cadastro administrativo da obra: vínculo estável, sem tornar o imóvel público. */
export async function sincronizarCatalogoObra(tx: TransacaoCRM, obraId: string, usuarioId: string | null) {
  await tx.$queryRaw`SELECT id FROM obras WHERE id = ${obraId} FOR UPDATE`;
  const obra = await tx.obra.findUnique({ where: { id: obraId }, select: {
    id: true, nome: true, endereco: true, area: true, vgv: true, imovelId: true,
    imovel: { select: { slug: true } },
  } });
  if (!obra?.endereco?.trim()) return { imovelId: obra?.imovelId ?? null, criado: false };
  const dados = imovelDaObra({ id: obra.id, titulo: obra.nome, endereco: obra.endereco, cidade: null, estado: null });
  const automatico = obra.imovel?.slug.startsWith(`obra-${obra.id}-`) ?? false;
  if (obra.imovelId) {
    if (automatico) await tx.imovel.update({ where: { id: obra.imovelId }, data: {
      titulo: dados.titulo, rua: dados.endereco ?? "", area: obra.area ?? 0,
      cidade: dados.cidade, ...(dados.estado ? { estado: dados.estado } : {}),
      ...(obra.vgv != null ? { preco: Number(obra.vgv) } : {}),
    } });
    return { imovelId: obra.imovelId, criado: false };
  }
  const imovel = await tx.imovel.create({ data: {
    titulo: dados.titulo, descricao: dados.descricao, rua: dados.endereco ?? "", bairro: "",
    cidade: dados.cidade, area: obra.area ?? 0, preco: obra.vgv == null ? 0 : Number(obra.vgv),
    ...(dados.estado ? { estado: dados.estado } : {}),
    slug: `obra-${obra.id}-${randomBytes(4).toString("hex")}`, tipo: "casa", status: "venda",
    publicadoSite: false, destaque: false, revisaoStatus: "aprovado", cadastradoPorId: usuarioId,
  }, select: { id: true } });
  await tx.obra.update({ where: { id: obra.id }, data: { imovelId: imovel.id } });
  return { imovelId: imovel.id, criado: true };
}

/** Prévia idempotente dos imóveis automáticos antigos que ainda precisam de endereço/cidade/UF/VGV. */
export async function previaReconciliacaoImoveisObras() {
  const obras = await prisma.obra.findMany({
    where: { imovelId: { not: null } },
    select: { id: true, nome: true, endereco: true, vgv: true, imovelId: true, imovel: { select: { id: true, slug: true, titulo: true, rua: true, cidade: true, estado: true, preco: true } } },
  });
  return obras.flatMap((o) => {
    const im = o.imovel;
    if (!im || !im.slug.startsWith(`obra-${o.id}-`)) return [];
    const dados = imovelDaObra({ id: o.id, titulo: o.nome, endereco: o.endereco, cidade: null, estado: null });
    const depois: Record<string, string | number> = {};
    if (!im.rua.trim() && dados.endereco) depois.rua = dados.endereco;
    if ((!im.cidade.trim() || im.cidade === "Não informada") && dados.cidade !== "Não informada") depois.cidade = dados.cidade;
    if (!im.estado.trim() && dados.estado) depois.estado = dados.estado;
    if (!(im.preco > 0) && o.vgv != null && Number(o.vgv) > 0) depois.preco = Number(o.vgv);
    return Object.keys(depois).length ? [{ imovelId: im.id, obraId: o.id, titulo: im.titulo, antes: { rua: im.rua, cidade: im.cidade, estado: im.estado, preco: im.preco }, depois }] : [];
  });
}

/** Aplica a prévia somente nos imóveis gerados pela própria obra; anúncios manuais não são tocados. */
export async function reconciliarImoveisGeradosDeObras() {
  const mudancas = await previaReconciliacaoImoveisObras();
  for (const m of mudancas) {
    const im = await prisma.imovel.findUnique({ where: { id: m.imovelId }, select: { slug: true } });
    if (im?.slug.startsWith(`obra-${m.obraId}-`)) await prisma.imovel.update({ where: { id: m.imovelId }, data: m.depois });
  }
  return { atualizados: mudancas.length, mudancas };
}

/**
 * Grava o ponto da obra dentro da transação (obra travada com FOR UPDATE). Com
 * imóvel vinculado, só atualiza latitude/longitude dele; sem vínculo, cria um
 * imóvel não publicado e o vincula (no máximo um por obra). `null` tira o ponto
 * do mapa e mantém o vínculo. Ponto igual ao salvo não grava nada.
 */
export async function salvarLocalizacaoObra(tx: TransacaoCRM, obraId: string, entrada: Coordenadas | null, usuarioId: string | null) {
  const coords = entrada ? normalizarCoordenadas(entrada) : null;
  await tx.$queryRaw`SELECT id FROM obras WHERE id = ${obraId} FOR UPDATE`;
  const obra = await tx.obra.findUnique({ where: { id: obraId }, select: { id: true, nome: true, endereco: true, area: true, imovelId: true, imovel: { select: { latitude: true, longitude: true } } } });
  if (!obra) throw new Error("Obra não encontrada.");
  if (obra.imovelId) {
    const atual = coordenadasSalvas(obra.imovel?.latitude, obra.imovel?.longitude);
    if (JSON.stringify(atual) !== JSON.stringify(coords))
      await tx.imovel.update({ where: { id: obra.imovelId }, data: { latitude: coords?.lat ?? null, longitude: coords?.lng ?? null } });
    return { imovelId: obra.imovelId, criado: false, coords };
  }
  if (!coords) return { imovelId: null, criado: false, coords: null };
  const dados = imovelDaObra({ id: obra.id, titulo: obra.nome, endereco: obra.endereco, cidade: null, estado: null });
  const imovel = await tx.imovel.create({
    data: {
      titulo: dados.titulo,
      descricao: dados.descricao,
      rua: dados.endereco ?? "",
      bairro: "",
      area: obra.area ?? 0,
      cidade: dados.cidade,
      ...(dados.estado ? { estado: dados.estado } : {}),
      latitude: coords.lat,
      longitude: coords.lng,
      slug: `obra-${obra.id}-${randomBytes(4).toString("hex")}`,
      tipo: "casa",
      // Santa Fé não tem o estado "reservado": fica no padrão, mas fora do site e dos portais.
      status: "venda",
      preco: 0,
      destaque: false,
      publicadoSite: false,
      revisaoStatus: "aprovado",
      cadastradoPorId: usuarioId,
    },
    select: { id: true },
  });
  await tx.obra.update({ where: { id: obraId }, data: { imovelId: imovel.id } });
  return { imovelId: imovel.id, criado: true, coords };
}
