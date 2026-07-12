import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

// Gera um parecer de viabilidade (go/no-go) a partir dos indicadores do EVE,
// seguindo a lógica da metodologia Carolina Caribé. Mesmo padrão dos demais
// endpoints de IA do projeto (avaliacoes/sugestao).

export interface ParecerInput {
  nome: string;
  municipio: string;
  estado: string;
  areaM2: number;
  vgv: number;
  custoTotal: number;
  lucroBruto: number;
  margemLiquida: number; // 0..1
  vpl: number;
  tir: number | null; // taxa mensal
  paybackMes: number | null;
  exposicaoMaxima: number;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // IA desativada por padrão — evita consumo de créditos e travamentos. O parecer
  // é opcional; os indicadores (VPL/TIR/ROI/etc.) já vêm das fórmulas.
  if (process.env.INCORPORACAO_IA_ATIVA !== "1") {
    return NextResponse.json(
      { error: "Parecer por IA desativado. Os indicadores de viabilidade já são calculados por fórmulas." },
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

  const d = (await req.json()) as ParecerInput;
  const client = new Anthropic({ apiKey });

  const tirMensal = d.tir != null ? (d.tir * 100).toFixed(2) + "% a.m." : "não convergiu";
  const tirAnual = d.tir != null ? ((Math.pow(1 + d.tir, 12) - 1) * 100).toFixed(1) + "% a.a." : "—";

  const prompt = `Você é um especialista em viabilidade de incorporação imobiliária no Brasil, seguindo a metodologia de Estudo de Viabilidade Econômica (EVE) de Carolina Caribé (Incorporação na Prática).

Empreendimento: ${d.nome} — ${d.municipio}/${d.estado}
Área do terreno: ${d.areaM2.toLocaleString("pt-BR")} m²

Indicadores calculados (EVE):
- VGV: R$ ${d.vgv.toLocaleString("pt-BR")}
- Custo total: R$ ${d.custoTotal.toLocaleString("pt-BR")}
- Lucro bruto: R$ ${d.lucroBruto.toLocaleString("pt-BR")}
- Margem líquida: ${(d.margemLiquida * 100).toFixed(1)}%
- VPL: R$ ${d.vpl.toLocaleString("pt-BR")}
- TIR: ${tirMensal} (${tirAnual})
- Payback: ${d.paybackMes != null ? d.paybackMes + " meses" : "não recuperado no horizonte"}
- Exposição máxima de caixa: R$ ${d.exposicaoMaxima.toLocaleString("pt-BR")}

Escreva um parecer técnico objetivo em português (máx. 4 parágrafos) analisando: (1) se a margem e a TIR são atrativas para o mercado brasileiro de incorporação; (2) o risco de exposição de caixa; (3) o payback; (4) uma recomendação clara GO / GO COM RESSALVAS / NO-GO com justificativa. Não invente números além dos fornecidos. Seja direto e prático.`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });
    let texto = "";
    for (const block of response.content) {
      if (block.type === "text") texto += block.text;
    }
    return NextResponse.json({ parecer: texto.trim() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
