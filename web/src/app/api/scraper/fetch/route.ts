import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { auth } from "@/auth";

const PRIVATE_IP = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1|fc00:|fe80:)/i;

function isSsrfUrl(raw: string): boolean {
  try {
    const { hostname, protocol } = new URL(raw);
    if (protocol !== "http:" && protocol !== "https:") return true;
    return PRIVATE_IP.test(hostname);
  } catch {
    return true;
  }
}

export interface ScrapedData {
  title?: string;
  description?: string;
  image?: string;
  images: string[];
  price?: number;
  priceText?: string;
  url: string;
  siteName?: string;
  error?: string;
}

function extractPrice(text: string): number | undefined {
  const clean = text.replace(/[^\d,]/g, "").replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? undefined : n;
}

function detectSource(url: string): string {
  if (url.includes("olx.com.br")) return "olx";
  if (url.includes("zapimoveis.com.br")) return "zapimoveis";
  if (url.includes("vivareal.com.br")) return "vivareal";
  if (url.includes("facebook.com") || url.includes("fb.com")) return "facebook";
  if (url.includes("instagram.com")) return "instagram";
  return "outro";
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  let url: string;
  try {
    const body = await req.json();
    url = body.url?.trim();
    if (!url) throw new Error("URL obrigatória");
    new URL(url); // validate
  } catch {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 });
  }

  if (isSsrfUrl(url)) {
    return NextResponse.json({ error: "URL não permitida" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GrupoSantaFe-Bot/1.0; +https://gruposantafee.com.br)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json<ScrapedData>({
        url,
        images: [],
        error: `Servidor retornou ${res.status}. Preencha os dados manualmente.`,
      });
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const og = (prop: string) =>
      $(`meta[property="og:${prop}"]`).attr("content") ||
      $(`meta[name="og:${prop}"]`).attr("content");

    const meta = (name: string) =>
      $(`meta[name="${name}"]`).attr("content") ||
      $(`meta[property="${name}"]`).attr("content");

    const title =
      og("title") ||
      meta("twitter:title") ||
      $("title").text().trim() ||
      undefined;

    const description =
      og("description") ||
      meta("description") ||
      meta("twitter:description") ||
      undefined;

    // Collect all og:image tags
    const images: string[] = [];
    $('meta[property="og:image"], meta[name="og:image"]').each((_, el) => {
      const src = $(el).attr("content");
      if (src) images.push(src);
    });
    const twitterImg = meta("twitter:image");
    if (twitterImg && !images.includes(twitterImg)) images.push(twitterImg);

    // Price extraction — try structured data and OG price
    const priceText =
      og("price:amount") ||
      meta("product:price:amount") ||
      (() => {
        // Try to find price in the page text (heuristic for OLX/ZAP)
        const bodyText = $("body").text();
        const match = bodyText.match(/R\$\s?[\d.,]+/);
        return match ? match[0] : undefined;
      })();

    const price = priceText ? extractPrice(priceText) : undefined;
    const siteName = og("site_name") || detectSource(url);

    return NextResponse.json<ScrapedData>({
      url,
      title: title?.substring(0, 200),
      description: description?.substring(0, 600),
      image: images[0],
      images: images.slice(0, 10),
      price,
      priceText: priceText?.substring(0, 50),
      siteName,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json<ScrapedData>({
      url,
      images: [],
      error: `Não foi possível acessar a URL: ${msg}. Preencha os dados manualmente.`,
    });
  }
}
