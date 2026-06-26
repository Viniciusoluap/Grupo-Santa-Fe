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
  caracteristicas?: string;
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

const ESTADO_GERAL_LABELS: Record<string, string> = {
  novo: "Novo / Em construção",
  otimo: "Ótimo estado",
  conservado: "Conservado",
  regular: "Regular",
  reformas_leves: "Necessita reformas leves",
  reformas_importantes: "Necessita reformas importantes",
  ruim: "Ruim",
  // terreno
  excelente: "Excelente aptidão",
  bom: "Boa aptidão",
  restricoes: "Com restrições relevantes",
  inapropriado: "Inapropriado para construção",
};

type ItemState = { ok: boolean | null; nota: string };
type ChecklistData = {
  tipoChecklist?: "imovel" | "terreno";
  estadoGeral?: string;
  items?: Record<string, ItemState>;
  fotos?: string[];
};

function buildChecklistContext(raw: string): string {
  if (!raw) return "";
  let parsed: ChecklistData;
  try {
    parsed = JSON.parse(raw) as ChecklistData;
  } catch {
    return "";
  }

  const tipo = parsed.tipoChecklist ?? "imovel";
  const estadoLabel = parsed.estadoGeral
    ? (ESTADO_GERAL_LABELS[parsed.estadoGeral] ?? parsed.estadoGeral)
    : null;
  const items = parsed.items ?? {};

  const conformes = Object.values(items).filter((v) => v.ok === true).length;
  const naoConformes = Object.values(items).filter((v) => v.ok === false).length;
  const total = Object.values(items).filter((v) => v.ok !== null).length;

  // Collect non-conforming items with notes
  const naoConformesDetalhes = Object.entries(items)
    .filter(([, v]) => v.ok === false)
    .map(([, v]) => (v.nota ? `  • ${v.nota}` : null))
    .filter(Boolean)
    .slice(0, 10);

  let ctx = `\nChecklist de vistoria preenchido (${tipo === "terreno" ? "terreno" : "imóvel pronto"}):`;
  if (estadoLabel) ctx += `\n- Estado/aptidão geral: ${estadoLabel}`;
  if (total > 0) {
    ctx += `\n- Itens verificados: ${total} (${conformes} conformes, ${naoConformes} não conformes)`;
    const pctOk = Math.round((conformes / total) * 100);
    ctx += `\n- Percentual de conformidade: ${pctOk}%`;
  }
  if (naoConformesDetalhes.length > 0) {
    ctx += `\n- Não conformidades observadas:\n${naoConformesDetalhes.join("\n")}`;
  }

  ctx += `\n\nAo definir o valor, aplique um fator de ajuste baseado na condição real do imóvel:
- Ótimo/Novo (≥90% conformidade): valor de mercado pleno ou pequeno prêmio
- Conservado (75-89%): valor de mercado pleno
- Regular/leves reformas (55-74%): desconto de 5-10% sobre o comparativo
- Importantes reformas (<55%): desconto de 10-20% sobre o comparativo
O valor sugerido deve refletir esse meio-termo entre o mercado e a condição física constatada em vistoria.`;

  return ctx;
}

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

  const checklistCtx = buildChecklistContext(body.caracteristicas ?? "");

  const prompt = `Você é um perito avaliador imobiliário especializado no mercado do Pará e Sudeste do Pará.

Imóvel a avaliar:
- Endereço: ${body.endereco}, ${body.bairro}, ${body.cidade}/${body.estado}
- Tipo: ${tipoDesc}
- Características: ${areaDesc}${terrenoDesc}${quartosDesc}${banheirosDesc}
${checklistCtx}

Faça UMA busca web por imóveis similares em ${body.cidade} - ${body.bairro} (ZAP, VivaReal, OLX ou Imovelweb). Com os dados encontrados, calcule o valor de mercado pelo método comparativo direto e ajuste conforme a condição real do imóvel descrita no checklist acima.

Retorne SOMENTE o JSON abaixo, sem texto extra, sem markdown, sem explicações — apenas o JSON puro:
{"valorSugerido":0,"valorMin":0,"valorMax":0,"precoPorM2":0,"estadoGeral":"","comparaveis":[{"descricao":"","preco":0,"area":0,"precoPorM2":0}],"fontes":[""],"metodologia":"","confiabilidade":"media","observacoes":""}

Preencha com no máximo 4 comparáveis. Todos os valores numéricos devem ser inteiros sem decimais. No campo "metodologia" explique brevemente como o checklist influenciou o valor final.`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: prompt }],
    });

    let jsonText = "";
    for (const block of response.content) {
      if (block.type === "text") {
        jsonText += block.text;
      }
    }

    jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

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
