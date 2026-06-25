import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export interface ZapInput {
  bairro: string;
  cidade: string;
  estado: string;
  tipo: string;
  areaConstruida: number | null;
}

export interface ZapComparavel {
  descricao: string;
  preco: number;
  area: number;
  precoPorM2: number;
}

export interface ZapResult {
  comparaveis: ZapComparavel[];
  valorMedio: number;
  precoPorM2Medio: number;
  totalEncontrados: number;
  bairroConsultado: string;
  url: string;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .trim();
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ZapInput;

  const negocio = body.tipo === "locacao" ? "aluguel" : "venda";
  const estadoSlug = slugify(body.estado);
  const cidadeSlug = slugify(body.cidade);
  const bairroSlug = slugify(body.bairro);

  const url = `https://www.zapimoveis.com.br/${negocio}/imoveis/${estadoSlug}+${cidadeSlug}+${bairroSlug}/`;

  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          error: `ZAP retornou status ${res.status}. O site pode estar bloqueando a requisição — tente a Sugestão IA como alternativa.`,
        },
        { status: 502 }
      );
    }

    html = await res.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: `Não foi possível conectar ao ZAP (${msg}). Tente a Sugestão IA como alternativa.`,
      },
      { status: 502 }
    );
  }

  // Extract __NEXT_DATA__ JSON embedded in the page
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
  );
  if (!match) {
    return NextResponse.json(
      {
        error:
          "Não foi possível extrair dados do ZAP. O site pode ter bloqueado a requisição ou mudado sua estrutura — tente a Sugestão IA.",
      },
      { status: 502 }
    );
  }

  let nextData: Record<string, unknown>;
  try {
    nextData = JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Erro ao processar dados do ZAP." },
      { status: 502 }
    );
  }

  // Navigate through possible data paths
  type AnyObj = Record<string, unknown>;
  const pageProps = ((nextData?.props as AnyObj)?.pageProps as AnyObj) ?? {};
  const searchResult =
    ((pageProps?.initialSearch as AnyObj)?.result as AnyObj) ??
    ((pageProps?.search as AnyObj)?.result as AnyObj) ??
    {};
  const listings = (searchResult?.listings as unknown[]) ?? [];

  if (!listings.length) {
    return NextResponse.json(
      {
        error: `Nenhum imóvel encontrado no ZAP para ${body.bairro}, ${body.cidade}. Tente a Sugestão IA.`,
      },
      { status: 404 }
    );
  }

  const businessType = body.tipo === "locacao" ? "RENTAL" : "SALE";
  const comparaveis: ZapComparavel[] = [];

  for (const item of listings.slice(0, 12)) {
    const listing =
      ((item as AnyObj)?.listing as AnyObj) ?? (item as AnyObj);
    const pricingInfos = (listing?.pricingInfos as AnyObj[]) ?? [];
    const priceInfo =
      pricingInfos.find((p) => p?.businessType === businessType) ??
      pricingInfos[0];
    const preco = parseInt(String(priceInfo?.price ?? "0"), 10);
    if (!preco || preco < 1000) continue;

    const usable = (listing?.usableAreas as string[]) ?? [];
    const total = (listing?.totalAreas as string[]) ?? [];
    const area = parseInt(usable[0] ?? total[0] ?? "0", 10);
    if (!area) continue;

    const address = (listing?.address as AnyObj) ?? {};
    const rua = String(address?.street ?? "");
    const bairroNome = String(address?.neighborhood ?? body.bairro);
    const quartos = (listing?.bedrooms as string[])?.[0];
    const descricao = [rua, bairroNome, quartos ? `${quartos} qts` : ""]
      .filter(Boolean)
      .join(" · ");

    comparaveis.push({
      descricao,
      preco,
      area,
      precoPorM2: Math.round(preco / area),
    });
  }

  if (!comparaveis.length) {
    return NextResponse.json(
      {
        error:
          "Imóveis encontrados, mas sem preços/áreas válidos para calcular. Tente a Sugestão IA.",
      },
      { status: 404 }
    );
  }

  const valorMedio = Math.round(
    comparaveis.reduce((s, c) => s + c.preco, 0) / comparaveis.length
  );
  const precoPorM2Medio = Math.round(
    comparaveis.reduce((s, c) => s + c.precoPorM2, 0) / comparaveis.length
  );

  return NextResponse.json({
    comparaveis,
    valorMedio,
    precoPorM2Medio,
    totalEncontrados: listings.length,
    bairroConsultado: body.bairro,
    url,
  } satisfies ZapResult);
}
