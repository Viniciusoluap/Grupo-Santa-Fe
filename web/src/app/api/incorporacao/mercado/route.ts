import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const maxDuration = 90;

// Pesquisa da cidade + estudo de mercado imobiliário via IA com busca web:
// perfil socioeconômico do município, oferta/demanda, preço médio do m² por
// produto (lote, casa, apartamento), velocidade de absorção e concorrentes.

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // IA desativada por padrão — evita consumo de créditos e travamentos.
  if (process.env.INCORPORACAO_IA_ATIVA !== "1") {
    return NextResponse.json(
      { error: "IA desativada. Informe os comparáveis de mercado manualmente." },
      { status: 503 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY não configurada nas variáveis de ambiente." },
      { status: 503 }
    );
  }

  const { municipio, estado } = (await req.json()) as { municipio: string; estado: string };
  if (!municipio) return NextResponse.json({ error: "Município obrigatório." }, { status: 400 });

  const client = new Anthropic({ apiKey });

  const prompt = `Você é um analista de mercado imobiliário especializado no Pará e na metodologia de estudo de mercado para incorporação (Carolina Caribé / Incorporação na Prática).

Pesquise na web dados atuais sobre ${municipio}/${estado} e produza a pesquisa da cidade + estudo de mercado imobiliário. Use fontes como IBGE, prefeitura, portais imobiliários (ZAP, VivaReal, OLX) e notícias econômicas locais.

Retorne SOMENTE o JSON abaixo, sem texto extra, sem markdown:
{
"cidade":{"populacao":0,"crescimentoAnualPct":0,"pibPerCapita":0,"principaisAtividades":[""],"rendaMediaMensal":0,"deficitHabitacional":"","resumo":""},
"mercado":{
 "precoM2Lote":0,"precoM2Casa":0,"precoM2Apartamento":0,
 "velocidadeVendas":"","demandaPorProduto":[{"produto":"","demanda":"alta|media|baixa","publico":""}],
 "concorrentes":[{"nome":"","produto":"","faixaPreco":""}],
 "comparaveis":[{"descricao":"","preco":0,"area":0,"precoPorM2":0}],
 "oportunidades":"","riscos":""
},
"fontes":[""],"confiabilidade":"alta|media|baixa"
}

Valores em R$ inteiros. Máx. 4 concorrentes e 4 comparáveis. Em "resumo", 2-3 frases sobre o momento econômico da cidade. Seja factual: se um dado não for encontrado, use 0 ou "" e reduza a confiabilidade.`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 4096,
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
    if (start === -1 || end === -1) throw new Error("Nenhum JSON encontrado na resposta.");
    const result = JSON.parse(jsonText.slice(start, end + 1));
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
