import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const CIDADE_BUSCA = process.env.PROSPECCAO_CIDADE ?? "Canaã dos Carajás PA";

const QUERIES = [
  `casa venda ${CIDADE_BUSCA}`,
  `apartamento venda ${CIDADE_BUSCA}`,
  `terreno lote venda ${CIDADE_BUSCA}`,
  `casa aluguel ${CIDADE_BUSCA}`,
  `imóvel venda ${CIDADE_BUSCA} whatsapp`,
];

interface BraveResult {
  title: string;
  url: string;
  description: string;
}

interface ProspeccaoImovel {
  titulo: string;
  tipo: "casa" | "apartamento" | "terreno" | "lote" | "comercial" | "chacara";
  status: "venda" | "locacao";
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

async function buscaBrave(query: string): Promise<BraveResult[]> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&country=br&search_lang=pt`;
  const res = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "X-Subscription-Token": BRAVE_API_KEY!,
    },
  });
  if (!res.ok) return [];
  const data = await res.json() as { web?: { results?: Array<{ title: string; url: string; description: string }> } };
  return (data.web?.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    description: r.description,
  }));
}

async function extrairComClaude(resultados: BraveResult[]): Promise<ProspeccaoImovel[]> {
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const texto = resultados
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.description}`)
    .join("\n\n---\n\n");

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Analise os resultados de busca abaixo e extraia todos os imóveis encontrados à venda ou para locação. Para cada imóvel, retorne um JSON array com os campos:
- titulo (string)
- tipo: "casa" | "apartamento" | "terreno" | "lote" | "comercial" | "chacara"
- status: "venda" | "locacao"
- preco (number, 0 se não encontrado)
- area (number em m², 0 se não encontrado)
- quartos (number | null)
- banheiros (number | null)
- vagas (number | null)
- bairro (string)
- cidade (string)
- estado (string, ex: "PA")
- descricao (string resumida)
- contato (telefone ou email encontrado, string vazia se não houver)
- origemUrl (URL da fonte)

Retorne APENAS o JSON array, sem markdown, sem explicação.

Resultados:
${texto}`,
      },
    ],
  });

  const content = msg.content[0];
  if (content.type !== "text") return [];

  try {
    const raw = content.text.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(raw) as ProspeccaoImovel[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// GET — list pending prospection drafts
export async function GET() {
  try {
    const drafts = await prisma.imovel.findMany({
      where: { rascunho: true },
      orderBy: { criadoEm: "desc" },
      select: {
        id: true, titulo: true, tipo: true, status: true, preco: true, area: true,
        quartos: true, bairro: true, cidade: true, estado: true,
        contatoOrigem: true, origemUrl: true, criadoEm: true,
      },
    });
    return NextResponse.json({ drafts });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST — run prospection search
export async function POST() {
  if (!BRAVE_API_KEY) {
    return NextResponse.json({ error: "BRAVE_SEARCH_API_KEY não configurada nas variáveis de ambiente do Vercel." }, { status: 400 });
  }
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada nas variáveis de ambiente do Vercel." }, { status: 400 });
  }

  try {
    // Search
    const allResults: BraveResult[] = [];
    for (const q of QUERIES) {
      const results = await buscaBrave(q);
      allResults.push(...results);
    }

    // Deduplicate by URL
    const seen = new Set<string>();
    const unique = allResults.filter((r) => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });

    if (unique.length === 0) {
      return NextResponse.json({ created: 0, message: "Nenhum resultado encontrado." });
    }

    // Extract with Claude
    const imoveis = await extrairComClaude(unique);

    // Deduplicate against existing (by price + bairro)
    const existing = await prisma.imovel.findMany({
      where: { rascunho: true },
      select: { preco: true, bairro: true },
    });
    const existingKeys = new Set(existing.map((e) => `${e.preco}-${e.bairro}`));

    const novos = imoveis.filter((im) => {
      if (im.preco === 0) return false;
      return !existingKeys.has(`${im.preco}-${im.bairro}`);
    });

    // Save as drafts
    let created = 0;
    for (const im of novos) {
      const slug = `prospeccao-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await prisma.imovel.create({
        data: {
          slug,
          tipo: im.tipo,
          status: im.status,
          titulo: im.titulo || "Imóvel prospectado",
          descricao: im.descricao || "",
          preco: im.preco,
          area: im.area || 1,
          quartos: im.quartos,
          banheiros: im.banheiros,
          vagas: im.vagas,
          bairro: im.bairro || "",
          cidade: im.cidade || CIDADE_BUSCA.split(" ")[0],
          estado: im.estado || "PA",
          publicadoSite: false,
          rascunho: true,
          contatoOrigem: im.contato || null,
          origemUrl: im.origemUrl || null,
        },
      });
      created++;
    }

    return NextResponse.json({ created, total: imoveis.length, message: `${created} imóveis novos adicionados para revisão.` });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PATCH — approve or discard a draft
export async function PATCH(request: NextRequest) {
  const { id, action } = (await request.json()) as { id: string; action: "aprovar" | "descartar" };

  if (!id || !["aprovar", "descartar"].includes(action)) {
    return NextResponse.json({ error: "id e action (aprovar|descartar) obrigatórios" }, { status: 400 });
  }

  try {
    if (action === "descartar") {
      await prisma.imovel.delete({ where: { id } });
    } else {
      await prisma.imovel.update({
        where: { id },
        data: { rascunho: false, publicadoSite: true },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
