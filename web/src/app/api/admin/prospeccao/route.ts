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

// GET — list pending prospection drafts (publicadoSite=false, slug starts with "rsc-")
export async function GET() {
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
  if (!BRAVE_API_KEY) {
    return NextResponse.json({ error: "BRAVE_SEARCH_API_KEY não configurada nas variáveis de ambiente do Vercel." }, { status: 400 });
  }
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada nas variáveis de ambiente do Vercel." }, { status: 400 });
  }

  try {
    const allResults: BraveResult[] = [];
    for (const q of QUERIES) {
      const results = await buscaBrave(q);
      allResults.push(...results);
    }

    const seen = new Set<string>();
    const unique = allResults.filter((r) => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });

    if (unique.length === 0) {
      return NextResponse.json({ created: 0, message: "Nenhum resultado encontrado." });
    }

    const imoveis = await extrairComClaude(unique);

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
