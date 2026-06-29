import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

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

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY não configurada nas variáveis de ambiente do Vercel." },
      { status: 503 }
    );
  }

  const body = (await req.json()) as ZapInput;
  const client = new Anthropic({ apiKey });

  const negocio = body.tipo === "locacao" ? "aluguel" : "venda";
  const zapUrl = `https://www.zapimoveis.com.br/${negocio}/imoveis/${body.estado.toLowerCase()}+${body.cidade.toLowerCase().replace(/\s/g, "-")}+${body.bairro.toLowerCase().replace(/\s/g, "-")}/`;

  const prompt = `Busque anúncios reais de imóveis para ${negocio} em ${body.bairro}, ${body.cidade}/${body.estado} nos portais ZAP Imóveis e VivaReal.

Retorne SOMENTE o JSON abaixo preenchido, sem texto extra, sem markdown:
{"comparaveis":[{"descricao":"","preco":0,"area":0,"precoPorM2":0}],"valorMedio":0,"precoPorM2Medio":0,"totalEncontrados":0,"bairroConsultado":"${body.bairro}","url":"${zapUrl}"}

Regras:
- Inclua 4 a 6 anúncios reais encontrados nos portais com preço e área válidos
- descricao: endereço ou descrição resumida do imóvel
- preco e area devem ser inteiros (sem decimais)
- precoPorM2 = preco dividido por area, arredondado
- valorMedio = média dos preços, precoPorM2Medio = média dos precoPorM2
- totalEncontrados = quantidade de anúncios encontrados nos portais (pode ser maior que os listados)
- Se não encontrar anúncios reais com preços, retorne o JSON com arrays vazios e zeros`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: prompt }],
    });

    let jsonText = "";
    for (const block of response.content) {
      if (block.type === "text") jsonText += block.text;
    }

    jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const start = jsonText.indexOf("{");
    const end = jsonText.lastIndexOf("}");
    if (start === -1 || end === -1) {
      throw new Error("Nenhum JSON encontrado na resposta.");
    }

    const result = JSON.parse(jsonText.slice(start, end + 1)) as ZapResult;

    if (!result.comparaveis?.length) {
      return NextResponse.json(
        { error: `Nenhum imóvel encontrado no ZAP/VivaReal para ${body.bairro}, ${body.cidade}.` },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
