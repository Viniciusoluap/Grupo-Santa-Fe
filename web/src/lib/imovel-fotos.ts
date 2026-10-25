import "server-only";
import { prisma } from "@/lib/db";
import { createHash } from "node:crypto";
import { driveRegistroConfigurado, enviarParaLixeira, organizarFotosImovel, uploadFotosImovel } from "@/lib/incorporacao/registro-drive";
import { MAX_FOTOS_IMOVEL } from "@/lib/imovel-fotos-limites";

// Pedido de 15/10: fotos de imóveis ficam no Google Drive em
// Imóveis/<Título (nº)>/01 - Fotos. O anúncio guarda só /api/imovel-foto/<id>.
// Sem Drive (ou com falha), a foto fica no banco e o "Testar Google Drive" envia
// as pendentes depois — o envio nunca se perde. Gêmeo de server/imovel-fotos.ts
// da Prospecta.

export { MAX_FOTOS_IMOVEL };
const URL_FOTO = /^\/api\/imovel-foto\/([a-z0-9]{1,40})$/;
export const urlFotoImovel = (id: string) => `/api/imovel-foto/${id}`;

type FotoNova = { mime: string; bytes: Buffer };

function lerDataUrl(valor: string): FotoNova | null {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+=*)$/.exec(valor);
  if (!m || valor.length > 12 * 1024 * 1024) return null;
  const bytes = Buffer.from(m[2], "base64");
  const ok =
    (m[1] === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8) ||
    (m[1] === "image/png" && bytes.subarray(0, 4).equals(Buffer.from([137, 80, 78, 71]))) ||
    (m[1] === "image/webp" && bytes.subarray(8, 12).toString() === "WEBP");
  return ok && bytes.length > 0 && bytes.length <= 8 * 1024 * 1024 ? { mime: m[1], bytes } : null;
}

export function lerFotos(json: string | null | undefined): string[] {
  try {
    const v = JSON.parse(json || "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Lista do formulário (fotos novas em data URL + endereços já gravados) → lista final, gravada no anúncio. */
export async function aplicarFotosImovel(imovelId: string, fotos: string[], usuarioId: string | null): Promise<string[]> {
  if (fotos.length > MAX_FOTOS_IMOVEL) throw new Error(`Máximo de ${MAX_FOTOS_IMOVEL} fotos por imóvel.`);
  const imovel = await prisma.imovel.findUnique({ where: { id: imovelId }, select: { id: true, titulo: true } });
  if (!imovel) throw new Error("Imóvel não encontrado.");
  const existentes = await prisma.imovelFoto.findMany({ where: { imovelId }, select: { id: true, driveFileId: true } });
  const doImovel = new Set(existentes.map((f) => f.id));

  const itens: ({ tipo: "gravada"; id: string } | { tipo: "nova"; foto: FotoNova } | { tipo: "externa"; url: string })[] = [];
  for (const valor of fotos) {
    const gravada = URL_FOTO.exec(valor);
    if (gravada) {
      if (doImovel.has(gravada[1])) itens.push({ tipo: "gravada", id: gravada[1] });
      continue; // foto de outro imóvel não é aceita
    }
    if (valor.startsWith("data:")) {
      const foto = lerDataUrl(valor);
      if (!foto) throw new Error("Envie fotos JPG, PNG ou WebP de até 8 MiB.");
      itens.push({ tipo: "nova", foto });
      continue;
    }
    if (/^https?:\/\//.test(valor) || valor.startsWith("/")) itens.push({ tipo: "externa", url: valor });
  }

  const novas = itens.flatMap((it, i) => (it.tipo === "nova" ? [{ ordem: i + 1, ...it.foto }] : []));
  let driveIds: string[] | null = null;
  if (novas.length && (await driveRegistroConfigurado())) {
    try {
      driveIds = await uploadFotosImovel(imovel, novas);
    } catch (erro) {
      console.error("[imovel-fotos] Drive indisponível; fotos guardadas no banco:", erro instanceof Error ? erro.message : "erro");
    }
  }
  const idsNovos: string[] = [];
  for (let k = 0; k < novas.length; k++) {
    const driveFileId = driveIds?.[k] ?? null;
    const criada = await prisma.imovelFoto.create({
      data: { imovelId, mime: novas[k].mime, tamanho: novas[k].bytes.length, driveFileId, dados: driveFileId ? null : new Uint8Array(novas[k].bytes), criadoPorId: usuarioId },
      select: { id: true },
    });
    idsNovos.push(criada.id);
  }
  let k = 0;
  const final = itens.map((it) => (it.tipo === "gravada" ? urlFotoImovel(it.id) : it.tipo === "nova" ? urlFotoImovel(idsNovos[k++]) : it.url));

  // Foto retirada do anúncio: sai do banco e vai para a lixeira do Drive.
  const mantidas = new Set(itens.flatMap((it) => (it.tipo === "gravada" ? [it.id] : [])));
  const removidas = existentes.filter((f) => !mantidas.has(f.id));
  if (removidas.length) {
    await prisma.imovelFoto.deleteMany({ where: { id: { in: removidas.map((f) => f.id) } } });
    for (const f of removidas) if (f.driveFileId) await enviarParaLixeira(f.driveFileId).catch(() => undefined);
  }
  await prisma.imovel.update({ where: { id: imovelId }, data: { imagens: JSON.stringify(final) } });
  await organizarFotos(imovelId).catch((erro) => console.error("[imovel-fotos] organização:", erro instanceof Error ? erro.message : "erro"));
  return final;
}

/** Acrescenta uma foto de modo atômico; uma repetição do mesmo envio devolve a URL anterior. */
export async function acrescentarFotoImovel(imovelId: string, dataUrl: string, usuarioId: string): Promise<string> {
  const foto = lerDataUrl(dataUrl);
  if (!foto || foto.bytes.length > 2_500_000) throw new Error("Envie uma foto JPG, PNG ou WebP de até 2,5 MB por vez.");
  const hash = createHash("sha256").update(foto.bytes).digest("hex");
  const resultado = await prisma.$transaction(async (tx) => {
    // Serializa uploads simultâneos e a verificação do limite por imóvel.
    await tx.$executeRaw`SELECT id FROM imoveis WHERE id = ${imovelId} FOR UPDATE`;
    const imovel = await tx.imovel.findUnique({ where: { id: imovelId }, select: { imagens: true } });
    if (!imovel) throw new Error("Imóvel não encontrado.");
    const anterior = await tx.imovelFoto.findUnique({ where: { imovelId_sha256: { imovelId, sha256: hash } }, select: { id: true } });
    if (anterior) return { url: urlFotoImovel(anterior.id), nova: false };
    const imagens = lerFotos(imovel.imagens);
    if (imagens.length >= MAX_FOTOS_IMOVEL) throw new Error(`Máximo de ${MAX_FOTOS_IMOVEL} fotos por imóvel.`);
    const criada = await tx.imovelFoto.create({ data: { imovelId, mime: foto.mime, tamanho: foto.bytes.length, sha256: hash, dados: new Uint8Array(foto.bytes), criadoPorId: usuarioId }, select: { id: true } });
    const url = urlFotoImovel(criada.id);
    await tx.imovel.update({ where: { id: imovelId }, data: { imagens: JSON.stringify([...imagens, url]) } });
    return { url, nova: true };
  });
  if (resultado.nova) {
    // Primeiro persistimos os bytes; falha no Drive preserva a foto no banco.
    if (await driveRegistroConfigurado()) {
      try {
        const imovel = await prisma.imovel.findUniqueOrThrow({ where: { id: imovelId }, select: { id: true, titulo: true, imagens: true } });
        const [driveFileId] = await uploadFotosImovel(imovel, [{ ordem: lerFotos(imovel.imagens).length, mime: foto.mime, bytes: foto.bytes }]);
        await prisma.imovelFoto.update({ where: { id: resultado.url.split("/").pop()! }, data: { driveFileId, dados: null } });
      } catch (erro) {
        console.error("[imovel-fotos] Drive indisponível; foto preservada no banco:", erro instanceof Error ? erro.message : "erro");
      }
    }
    await organizarFotos(imovelId).catch(() => undefined);
  }
  return resultado.url;
}

/** Numeração "Foto 01, 02…" na ordem do anúncio e pasta com o título atual. */
async function organizarFotos(imovelId: string) {
  if (!(await driveRegistroConfigurado())) return;
  const imovel = await prisma.imovel.findUnique({ where: { id: imovelId }, select: { id: true, titulo: true, imagens: true } });
  if (!imovel) return;
  const rows = await prisma.imovelFoto.findMany({ where: { imovelId, driveFileId: { not: null } }, select: { id: true, driveFileId: true, mime: true, criadoEm: true } });
  const porId = new Map(rows.map((r) => [r.id, r]));
  const ordem = lerFotos(imovel.imagens).flatMap((u) => {
    const m = URL_FOTO.exec(u);
    const r = m ? porId.get(m[1]) : undefined;
    return r ? [{ driveFileId: r.driveFileId!, mime: r.mime, criadaEm: r.criadoEm }] : [];
  });
  await organizarFotosImovel({ id: imovel.id, titulo: imovel.titulo }, ordem);
}

/**
 * "Testar Google Drive": envia ao Drive as fotos que ficaram no banco (Drive
 * fora do ar no envio ou cadastros antigos com a foto dentro do anúncio).
 */
export async function enviarFotosPendentesAoDrive(): Promise<{ enviadas: number; falhas: number }> {
  let enviadas = 0;
  let falhas = 0;
  const antigos = await prisma.imovel.findMany({ where: { imagens: { contains: "data:image/" } }, select: { id: true, imagens: true } });
  for (const im of antigos) {
    try {
      const fotos = lerFotos(im.imagens);
      await aplicarFotosImovel(im.id, fotos, null);
      enviadas += fotos.filter((u) => u.startsWith("data:")).length;
    } catch (erro) {
      falhas += 1;
      console.error("[imovel-fotos] cadastro antigo não migrado:", erro instanceof Error ? erro.message : "erro");
    }
  }
  const pendentes = await prisma.imovelFoto.findMany({
    where: { driveFileId: null, dados: { not: null } },
    select: { id: true, imovelId: true, mime: true, dados: true, imovel: { select: { titulo: true } } },
  });
  for (const p of pendentes) {
    try {
      const [fileId] = await uploadFotosImovel({ id: p.imovelId, titulo: p.imovel.titulo }, [{ ordem: 1, mime: p.mime, bytes: Buffer.from(p.dados!) }]);
      await prisma.imovelFoto.update({ where: { id: p.id }, data: { driveFileId: fileId, dados: null } });
      await organizarFotos(p.imovelId).catch(() => undefined);
      enviadas += 1;
    } catch (erro) {
      falhas += 1;
      console.error("[imovel-fotos] foto pendente não enviada:", erro instanceof Error ? erro.message : "erro");
    }
  }
  return { enviadas, falhas };
}
