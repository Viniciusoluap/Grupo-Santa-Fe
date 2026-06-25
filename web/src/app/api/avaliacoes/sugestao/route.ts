import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

export interface SugestaoInput {
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
  tipo: string;
  areaConstruida: number | null;
  areaTerreno: number | null;
  quartos: number | null;
  banheiros: number | null;
}

export interface SugestaoResult {
  valorSugerido: number;
  valorMin: number;
  valorMax: number;
  precoPorM2: number;
  estadoGeral: string;
  comparaveis: { descricao: string; preco: number; area: number; precoPorM2: number }[];
  fontes: string[];
  metodologia: string;
  confiabilidade: "alta" | "media" | "baixa";
  observacoes: string;
}

const TIPO_LABELS: Record<string, string> = {
  mercado: "residencial",
  locacao: "residencial para locação",
  judicial: "imóvel para avaliação judicial",
  parecer_tecnico: "imóvel comercial ou misto",
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY não configurada nas variáveis de ambiente do Vercel." },
      { status: 503 }
    );
  }

  const body = (await req.json()) as SugestaoInput;
  const client = new Anthropic({ apiKey });

  const tipoDesc = TIPO_LABELS[body.tipo] ?? body.tipo;
  const areaDesc = body.areaConstruida ? `${body.areaConstruida} m² construídos` : "";
  const terrenoDesc = body.areaTerreno ? `, ${body.areaTerreno} m² de terreno` : "";
  const quartosDesc = body.quartos ? `, ${body.quartos} quartos` : "";
  const banheirosDesc = body.banheiros ? `, ${body.banheiros} banheiros` : "";

  const prompt = `Você é um perito avaliador imobiliário especializado no mercado do Pará e Sudeste do Pará.

Preciso de uma sugestão de valor de mercado para o seguinte imóvel:
- Endereço: ${body.endereco}, ${body.bairro}, ${body.cidade}/${body.estado}
- Tipo: ${tipoDesc}
- Características: ${areaDesc}${terrenoDesc}${quartosDesc}${banheirosDesc}

INSTRUÇÕES:
1. Use a ferramenta de busca web para pesquisar imóveis similares à venda ou aluguel em ${body.cidade} - ${body.bairro} ou bairros próximos
2. Busque em portais como ZAP Imóveis, VivaReal, OLX Imóveis, Imovelweb
3. Pesquise também o valor do metro quadrado em ${body.cidade}/${body.estado} atualmente
4. Calcule o preço médio por metro quadrado com base nos comparáveis encontrados
5. Aplique o método comparativo: preço/m² × ${body.areaConstruida ?? "área construída"}

Retorne EXCLUSIVAMENTE um JSON válido neste formato (sem markdown, sem texto extra):
{
  "valorSugerido": <número em reais>,
  "valorMin": <número em reais>,
  "valorMax": <número em reais>,
  "precoPorM2": <número em reais>,
  "estadoGeral": "<descrição do mercado local>",
  "comparaveis": [
    {"descricao": "<endereço/descrição>", "preco": <número>, "area": <m²>, "precoPorM2": <número>}
  ],
  "fontes": ["<fonte1>", "<fonte2>"],
  "metodologia": "<como foi calculado>",
  "confiabilidade": "<alta|media|baixa>",
  "observacoes": "<notas importantes sobre a avaliação>"
}`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: prompt }],
    });

    // Extract the text content from the response
    let jsonText = "";
    for (const block of response.content) {
      if (block.type === "text") {
        jsonText += block.text;
      }
    }

    // Clean up any markdown fences if present
    jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    // Find JSON object
    const start = jsonText.indexOf("{");
    const end = jsonText.lastIndexOf("}");
    if (start === -1 || end === -1) {
      throw new Error("Nenhum JSON encontrado na resposta.");
    }
    const result = JSON.parse(jsonText.slice(start, end + 1)) as SugestaoResult;
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
