import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const CIDADE_BUSCA = process.env.PROSPECCAO_CIDADE ?? "Canaã dos Carajás PA";

// Reduzido de 5 para 3 termos: o diagnóstico em produção (Vercel runtime errors)
// mostrou "Task timed out after 60 seconds" nesta rota — cada termo pode disparar
// uma rodada de busca web, e o total ultrapassava o limite da função serverless,
// deixando o botão girando para sempre sem resposta. Menos termos + timeouts
// internos (abaixo) garantem que a rota sempre responda dentro do prazo.
const QUERIES = [
  `imóvel à venda ${CIDADE_BUSCA}`,
  `casa ou apartamento para alugar ${CIDADE_BUSCA}`,
  `terreno lote à venda ${CIDADE_BUSCA} whatsapp`,
];

const TIMEOUT_TOTAL_MS = 50_000; // margem de segurança abaixo do maxDuration (60s)
const TIMEOUT_POR_CHAMADA_MS = 25_000;
const MAX_RODADAS_BUSCA = 2;

interface ProspeccaoImovel {
  titulo: string;
  tipo: string;
  status: string;
  preco: number;
  area: number;
  quartos: number | null;
  banheiros: number | null;
  vagas: number | null;
  bairro: string;
  cidade: string;
  estado: string;
  descricao: string;
  contato: string;
  origemUrl: string;
}

// Prospection drafts are identified by publicadoSite=false + slug prefix "rsc-"
// Contact and origin URL are stored in the descricao field as JSON:
// {"_desc": "...", "_contato": "...", "_origem": "..."}
function parseDraftDesc(raw: string): { descricao: string; contato: string | null; origemUrl: string | null } {
  try {
    const p = JSON.parse(raw) as Record<string, string>;
    if (p._desc !== undefined) {
      return { descricao: p._desc ?? "", contato: p._contato ?? null, origemUrl: p._origem ?? null };
    }
  } catch { /* not JSON */ }
  return { descricao: raw, contato: null, origemUrl: null };
}

// Busca imóveis na web usando a busca web nativa da Claude (sem dependência do Brave).
// A Claude executa as buscas server-side e devolve os imóveis já extraídos em JSON.
async function buscaImoveisComClaude(): Promise<ProspeccaoImovel[]> {
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const prompt = `Pesquise na web imóveis à venda e para locação em ${CIDADE_BUSCA}. Faça buscas para cada um destes termos e analise os anúncios encontrados (portais imobiliários, OLX, Facebook Marketplace, sites de imobiliárias locais):

${QUERIES.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Extraia todos os imóveis reais que encontrar. Para cada imóvel, monte um objeto com os campos:
- titulo (string)
- tipo: "casa" | "apartamento" | "terreno" | "lote" | "comercial" | "chacara"
- status: "venda" | "locacao"
- preco (number em reais, 0 se não encontrado)
- area (number em m², 0 se não encontrado)
- quartos (number | null)
- banheiros (number | null)
- vagas (number | null)
- bairro (string)
- cidade (string)
- estado (string, ex: "PA")
- descricao (string resumida)
- contato (telefone ou email encontrado, string vazia se não houver)
- origemUrl (URL da fonte do anúncio)

Não invente imóveis: inclua apenas os que aparecem de fato nos resultados de busca. Retorne APENAS um JSON array com os imóveis, sem markdown e sem explicação.`;

  // web_search é uma server tool: a Claude pode pausar (pause_turn) entre rodadas
  // de busca. Repetimos a chamada reenviando o histórico até o turno terminar.
  // Cada chamada tem timeout próprio e o nº de rodadas é limitado — sem isso, a
  // rota podia ultrapassar os 60s da função serverless e travar sem responder.
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
  let response = await client.messages.create(
    {
      model: "claude-sonnet-5",
      max_tokens: 8192,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages,
    },
    { timeout: TIMEOUT_POR_CHAMADA_MS }
  );

  let guard = 0;
  while (response.stop_reason === "pause_turn" && guard < MAX_RODADAS_BUSCA) {
    messages.push({ role: "assistant", content: response.content });
    response = await client.messages.create(
      {
        model: "claude-sonnet-5",
        max_tokens: 8192,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages,
      },
      { timeout: TIMEOUT_POR_CHAMADA_MS }
    );
    guard++;
  }

  let jsonText = "";
  for (const block of response.content) {
    if (block.type === "text") jsonText += block.text;
  }
  jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  const start = jsonText.indexOf("[");
  const end = jsonText.lastIndexOf("]");
  if (start === -1 || end === -1) return [];

  try {
    const parsed = JSON.parse(jsonText.slice(start, end + 1)) as ProspeccaoImovel[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// GET — list pending prospection drafts (publicadoSite=false, slug starts with "rsc-")
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const drafts = await prisma.imovel.findMany({
      where: { publicadoSite: false, slug: { startsWith: "rsc-" } },
      orderBy: { criadoEm: "desc" },
      select: {
        id: true, titulo: true, tipo: true, status: true, preco: true, area: true,
        quartos: true, bairro: true, cidade: true, estado: true,
        descricao: true, criadoEm: true,
      },
    });

    const parsed = drafts.map((d) => {
      const { descricao, contato, origemUrl } = parseDraftDesc(d.descricao);
      return { ...d, descricao, contatoOrigem: contato, origemUrl, criadoEm: d.criadoEm.toISOString() };
    });

    return NextResponse.json({ drafts: parsed });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST — run prospection search
export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada nas variáveis de ambiente do Vercel." }, { status: 400 });
  }

  try {
    // Corrida contra um prazo total: se a busca (mesmo com os timeouts internos)
    // ainda assim demorar demais, respondemos com um erro claro em vez de deixar
    // a função ser encerrada pela Vercel sem devolver nada ao cliente (o botão
    // "Buscando..." travava para sempre nesse cenário).
    const imoveis = await Promise.race([
      buscaImoveisComClaude(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT_TOTAL")), TIMEOUT_TOTAL_MS)
      ),
    ]);

    if (imoveis.length === 0) {
      return NextResponse.json({ created: 0, message: "Nenhum imóvel encontrado na busca." });
    }

    // Deduplicate against existing drafts by price + bairro
    const existing = await prisma.imovel.findMany({
      where: { publicadoSite: false, slug: { startsWith: "rsc-" } },
      select: { preco: true, bairro: true },
    });
    const existingKeys = new Set(existing.map((e) => `${e.preco}-${e.bairro}`));

    const novos = imoveis.filter((im) => {
      if (im.preco === 0) return false;
      return !existingKeys.has(`${im.preco}-${im.bairro}`);
    });

    let created = 0;
    for (const im of novos) {
      const slug = `rsc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      // Store contact and origin in descricao as JSON
      const descricaoJson = JSON.stringify({
        _desc: im.descricao || "",
        _contato: im.contato || "",
        _origem: im.origemUrl || "",
      });
      await prisma.imovel.create({
        data: {
          slug,
          tipo: im.tipo || "casa",
          status: im.status || "venda",
          titulo: im.titulo || "Imóvel prospectado",
          descricao: descricaoJson,
          preco: im.preco,
          area: im.area || 1,
          quartos: im.quartos,
          banheiros: im.banheiros,
          vagas: im.vagas,
          bairro: im.bairro || "",
          cidade: im.cidade || CIDADE_BUSCA.split(" ")[0],
          estado: im.estado || "PA",
          publicadoSite: false,
        },
      });
      created++;
    }

    return NextResponse.json({ created, total: imoveis.length, message: `${created} imóveis novos adicionados para revisão.` });
  } catch (err) {
    const timeout = err instanceof Error && err.message === "TIMEOUT_TOTAL";
    return NextResponse.json(
      {
        error: timeout
          ? "A busca demorou demais e foi interrompida antes de travar o servidor. Tente novamente — buscas mais curtas tendem a concluir mais rápido."
          : String(err),
      },
      { status: timeout ? 504 : 500 }
    );
  }
}

// PATCH — approve or discard a draft
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id, action } = (await request.json()) as { id: string; action: "aprovar" | "descartar" };

  if (!id || !["aprovar", "descartar"].includes(action)) {
    return NextResponse.json({ error: "id e action (aprovar|descartar) obrigatórios" }, { status: 400 });
  }

  try {
    if (action === "descartar") {
      await prisma.imovel.delete({ where: { id } });
    } else {
      // Restore plain description when approving
      const imovel = await prisma.imovel.findUnique({ where: { id }, select: { descricao: true } });
      const { descricao } = parseDraftDesc(imovel?.descricao ?? "");
      await prisma.imovel.update({
        where: { id },
        data: { publicadoSite: true, descricao },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
