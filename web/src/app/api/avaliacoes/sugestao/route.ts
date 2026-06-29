import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";

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

// Keys that belong to the documentation group (both imovel and terreno)
const DOC_KEYS = new Set([
  "doc_01","doc_02","doc_03","doc_04","doc_05","doc_06","doc_07","doc_08","doc_09","doc_10",
  "ter_doc_01","ter_doc_02","ter_doc_03","ter_doc_04","ter_doc_05","ter_doc_06","ter_doc_07","ter_doc_08","ter_doc_09",
]);

const DOC_LABELS: Record<string, string> = {
  doc_01: "Matrícula atualizada no cartório",
  doc_02: "Escritura / contrato de compra e venda",
  doc_03: "Habite-se / alvará de construção",
  doc_04: "Planta da edificação",
  doc_05: "Sem ônus (hipotecas ou penhoras)",
  doc_06: "IPTU em dia",
  doc_07: "Sem débitos de condomínio",
  doc_08: "Área conforme matrícula",
  doc_09: "Construção regularizada na prefeitura",
  doc_10: "Conformidade com zoneamento",
  ter_doc_01: "Matrícula atualizada no cartório",
  ter_doc_02: "Escritura / contrato de compra e venda",
  ter_doc_03: "Sem ônus (hipotecas ou penhoras)",
  ter_doc_04: "IPTU em dia",
  ter_doc_05: "Área conforme matrícula",
  ter_doc_06: "Conformidade com zoneamento",
  ter_doc_07: "Loteamento / desmembramento regularizado",
  ter_doc_08: "Levantamento topográfico disponível",
  ter_doc_09: "Sem sobreposição com área pública ou tombada",
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

  // Documentation-specific analysis
  const docEntries = Object.entries(items).filter(([k]) => DOC_KEYS.has(k));
  const docNaoConformes = docEntries.filter(([, v]) => v.ok === false);
  const docConformes = docEntries.filter(([, v]) => v.ok === true).length;
  const docTotal = docEntries.filter(([, v]) => v.ok !== null).length;

  // Non-conforming items with notes (general)
  const naoConformesDetalhes = Object.entries(items)
    .filter(([k, v]) => v.ok === false && !DOC_KEYS.has(k))
    .map(([, v]) => (v.nota ? `  • ${v.nota}` : null))
    .filter(Boolean)
    .slice(0, 8);

  let ctx = `\nChecklist de vistoria preenchido (${tipo === "terreno" ? "terreno" : "imóvel pronto"}):`;
  if (estadoLabel) ctx += `\n- Estado/aptidão geral: ${estadoLabel}`;
  if (total > 0) {
    ctx += `\n- Itens verificados: ${total} (${conformes} conformes, ${naoConformes} não conformes)`;
    const pctOk = Math.round((conformes / total) * 100);
    ctx += `\n- Percentual de conformidade geral: ${pctOk}%`;
  }

  // Documentation block — highlighted separately
  if (docTotal > 0) {
    ctx += `\n\nSITUAÇÃO DOCUMENTAL (fator crítico de valorização):`;
    ctx += `\n- ${docConformes} de ${docTotal} itens documentais em ordem`;
    if (docNaoConformes.length > 0) {
      ctx += `\n- Irregularidades documentais encontradas:`;
      for (const [k, v] of docNaoConformes) {
        const label = DOC_LABELS[k] ?? k;
        ctx += `\n  ⚠ ${label}${v.nota ? `: ${v.nota}` : ""}`;
      }
    }
  }

  if (naoConformesDetalhes.length > 0) {
    ctx += `\n\nNão conformidades físicas observadas:\n${naoConformesDetalhes.join("\n")}`;
  }

  ctx += `\n\nREGRAS DE AJUSTE DO VALOR (aplique em ordem de prioridade):

1. DOCUMENTAÇÃO — peso máximo:
   - Todos documentos em ordem → sem penalidade documental
   - 1-2 irregularidades documentais menores (IPTU, planta) → desconto adicional de 5-10%
   - Irregularidades graves (sem matrícula, sem escritura, sem habite-se, ônus, área divergente) → desconto adicional de 15-30% sobre o valor de mercado
   - Imóvel sem documentação regularizável → desconto de 30-50% (risco jurídico alto)

2. CONDIÇÃO FÍSICA (sobre o valor já ajustado pela documentação):
   - ≥90% conformidade → valor pleno ou pequeno prêmio
   - 75-89% → sem desconto adicional
   - 55-74% → desconto de 5-10%
   - <55% → desconto de 10-20%

O valor sugerido deve refletir o meio-termo entre mercado, documentação e condição física.`;

  return ctx;
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
