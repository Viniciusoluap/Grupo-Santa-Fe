"use server";
import { auth } from "@/auth";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

function extractXmlTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? m[1].trim() : "";
}

function slugify(text: string, id: string): string {
  const base = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
  return `${base}-${id.slice(-6)}`;
}

function mapListingCategory(cat: string): string {
  const c = cat.toLowerCase();
  if (c.includes("apartment") || c.includes("apartamento")) return "apartamento";
  if (c.includes("lot") || c.includes("land") || c.includes("lote") || c.includes("terreno")) return "lote";
  if (c.includes("commercial") || c.includes("comercial")) return "comercial";
  if (c.includes("farm") || c.includes("chacara") || c.includes("rural")) return "chacara";
  return "casa";
}

function mapTransactionType(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("rental") || t.includes("locacao") || t.includes("aluguel")) return "locacao";
  return "venda";
}

export async function executarAgregacao(): Promise<{ ok: boolean; importados: number; erros: number; msg: string }> {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const config = await prisma.configuracao.findUnique({ where: { chave: "agregador_feeds" } });
  if (!config?.valor) {
    return { ok: false, importados: 0, erros: 0, msg: "Nenhuma fonte XML configurada. Configure em Configurações." };
  }

  const urls: string[] = JSON.parse(config.valor).filter(Boolean);
  if (urls.length === 0) {
    return { ok: false, importados: 0, erros: 0, msg: "Nenhuma URL de feed configurada." };
  }

  let importados = 0;
  let erros = 0;
  const motivos: string[] = [];

  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) {
        erros++;
        motivos.push(`${url} → o servidor respondeu HTTP ${res.status}.`);
        continue;
      }
      const contentType = res.headers.get("content-type") ?? "";
      const xml = await res.text();

      // Split into individual Listing blocks
      const listingMatches = xml.match(/<Listing[\s\S]*?<\/Listing>/gi) ?? [];

      if (listingMatches.length === 0) {
        erros++;
        const pareceHtml = contentType.includes("html") || /^\s*<!doctype html/i.test(xml) || /<html[\s>]/i.test(xml);
        motivos.push(
          pareceHtml
            ? `${url} → essa URL retornou uma página HTML, não um feed XML. Configure a URL real do feed (gerada no painel do portal em Conta → Integração de Imóveis), não a URL do site.`
            : `${url} → nenhuma tag <Listing> encontrada. Confira se é o feed XML correto.`
        );
        continue;
      }

      for (const listing of listingMatches) {
        try {
          const externalId = extractXmlTag(listing, "ListingID") || extractXmlTag(listing, "ExternalID");
          if (!externalId) continue;

          // Skip if already imported (id is prefixed with "agr-" + first 20 chars of externalId)
          const exists = await prisma.imovel.findFirst({
            where: { id: { startsWith: `agr-${externalId.slice(0, 20)}` } },
            select: { id: true },
          });
          if (exists) continue;

          const titulo = extractXmlTag(listing, "Title") || extractXmlTag(listing, "ListingTitle") || "Imóvel Importado";
          const descricao = extractXmlTag(listing, "Description") || "";
          const precoStr = extractXmlTag(listing, "ListPrice") || extractXmlTag(listing, "Price") || "0";
          const preco = parseFloat(precoStr.replace(/[^\d.]/g, "")) || 0;
          const areaStr = extractXmlTag(listing, "LivingArea") || extractXmlTag(listing, "Area") || "0";
          const area = parseFloat(areaStr) || 0;
          const quartosStr = extractXmlTag(listing, "Bedrooms") || "0";
          const banheirosStr = extractXmlTag(listing, "Bathrooms") || "0";
          const bairro = extractXmlTag(listing, "Neighborhood") || extractXmlTag(listing, "SubLocality") || "Não informado";
          const cidade = extractXmlTag(listing, "City") || "Canaã dos Carajás";
          const estado = extractXmlTag(listing, "State") || "PA";
          const rua = extractXmlTag(listing, "StreetAddress") || extractXmlTag(listing, "Address") || "";
          const catRaw = extractXmlTag(listing, "ListingCategory") || extractXmlTag(listing, "PropertyType") || "Residential";
          const txRaw = extractXmlTag(listing, "TransactionType") || "For Sale";
          const latStr = extractXmlTag(listing, "Latitude") || "";
          const lngStr = extractXmlTag(listing, "Longitude") || "";

          // Extract images
          const imgMatches = listing.match(/<Url[^>]*>([^<]+)<\/Url>/gi) ?? [];
          const imagens: string[] = imgMatches
            .map((m) => m.replace(/<\/?Url[^>]*>/gi, "").trim())
            .filter((u) => u.startsWith("http"))
            .slice(0, 15);

          const id = `agr-${externalId.slice(0, 20)}-${Date.now().toString(36)}`;
          const slug = slugify(titulo, id);

          await prisma.imovel.create({
            data: {
              id,
              slug,
              titulo,
              descricao,
              tipo: mapListingCategory(catRaw),
              status: mapTransactionType(txRaw),
              preco,
              area: area || 1,
              quartos: parseInt(quartosStr) || null,
              banheiros: parseInt(banheirosStr) || null,
              bairro,
              cidade,
              estado,
              rua,
              latitude: latStr ? parseFloat(latStr) : null,
              longitude: lngStr ? parseFloat(lngStr) : null,
              imagens: JSON.stringify(imagens),
              badge: "Agregador",
              publicadoSite: false,
            },
          });
          importados++;
        } catch (e) {
          erros++;
          const detalhe = e instanceof Error ? e.message : String(e);
          motivos.push(`${url} → falha ao gravar um imóvel: ${detalhe}`);
        }
      }
    } catch (e) {
      erros++;
      const detalhe = e instanceof Error ? e.message : String(e);
      motivos.push(`${url} → falha ao buscar a URL: ${detalhe}`);
    }
  }

  revalidatePath("/admin/imoveis");
  const resumoErros = motivos.slice(0, 3).join(" | ");
  return {
    ok: true,
    importados,
    erros,
    msg: `${importados} imóvel(is) importado(s)${erros > 0 ? `, ${erros} erro(s)` : ""}.${resumoErros ? ` ${resumoErros}` : ""}`,
  };
}

export async function salvarFeedsAgregador(urls: string[]): Promise<void> {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await prisma.configuracao.upsert({
    where: { chave: "agregador_feeds" },
    create: { chave: "agregador_feeds", valor: JSON.stringify(urls), grupo: "agregador" },
    update: { valor: JSON.stringify(urls) },
  });
}

export async function getFeedsAgregador(): Promise<string[]> {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const config = await prisma.configuracao.findUnique({ where: { chave: "agregador_feeds" } });
  if (!config?.valor) return [];
  try { return JSON.parse(config.valor) as string[]; } catch { return []; }
}
