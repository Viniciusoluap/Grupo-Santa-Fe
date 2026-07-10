import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

// Pré-preenche os parâmetros urbanísticos buscando o Plano Diretor / Lei de
// Uso e Ocupação do Solo do município na web. A IA SUGERE — o usuário confirma
// manualmente antes de usar (fidelidade garantida pela confirmação humana).

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // IA desativada por padrão — evita consumo de créditos e travamentos. O estudo
  // urbanístico agora é calculado por fórmulas; a IA só roda se explicitamente
  // habilitada (INCORPORACAO_IA_ATIVA=1).
  if (process.env.INCORPORACAO_IA_ATIVA !== "1") {
    return NextResponse.json(
      { error: "IA desativada. Preencha os parâmetros urbanísticos manualmente — o cálculo é feito por fórmulas." },
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

  const { municipio, estado, zona } = (await req.json()) as {
    municipio: string; estado: string; zona?: string;
  };
  if (!municipio) return NextResponse.json({ error: "Município obrigatório." }, { status: 400 });

  const client = new Anthropic({ apiKey });

  const prompt = `Você é um urbanista especializado em legislação municipal brasileira.

Pesquise na web o Plano Diretor e/ou a Lei de Uso e Ocupação do Solo de ${municipio}/${estado}${zona ? `, zona "${zona}"` : ""} e extraia os parâmetros urbanísticos para empreendimentos residenciais/loteamentos.

Se não encontrar o parâmetro exato do município, use o valor típico de municípios paraenses de porte similar e marque a confiabilidade como "estimado".

Retorne SOMENTE o JSON abaixo, sem texto extra, sem markdown:
{"zona":"","taxaOcupacao":0.6,"coefAproveitamento":1.2,"recuoFrontalM":3,"recuoLateralM":1.5,"recuoFundosM":3,"loteMinimoM2":250,"testadaMinimaM":10,"gabaritoPavimentos":2,"percentInstitucional":0.05,"percentAreaVerde":0.1,"percentViario":0.2,"vagasPorUnidade":1,"fontes":[""],"confiabilidade":"alta|media|estimado","observacoes":""}

Regras: taxaOcupacao e percentuais em fração (0..1); recuos/testada em metros; loteMinimoM2 em m². Em "fontes" liste as leis/links encontrados. Em "observacoes" cite particularidades relevantes (ZEIS, restrições ambientais, outorga onerosa).`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-5",
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
    if (start === -1 || end === -1) throw new Error("Nenhum JSON encontrado na resposta.");
    const result = JSON.parse(jsonText.slice(start, end + 1));
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
