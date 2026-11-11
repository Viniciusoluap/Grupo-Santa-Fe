// Token público do Mapbox (opcional) guardado no próprio banco, como as outras chaves
// de Admin › Integrações (configuracoes["integracao.mapbox_token"], criptografado).
// Ordem: variável MAPBOX_PUBLIC_TOKEN (se existir) > banco. Sem token → Esri (padrão).
// Gêmeo de Prospecta/server/_core/geo/mapbox-config.ts.
import { prisma } from "@/lib/db";
import { criptografarSegredo, descriptografarSegredo } from "@/lib/segredo";
import { normalizarTokenMapbox, verificarTokenMapbox } from "./mapbox-token";

export const CHAVE_SEGREDO_MAPBOX = "integracao.mapbox_token";

export type MapboxDeps = {
  lerBanco: (chave: string) => Promise<string | undefined>;
  gravarBanco: (chave: string, valor: string) => Promise<void>;
  fetchImpl: typeof fetch;
  env: () => string | undefined;
};

export const mapboxDepsPadrao: MapboxDeps = {
  lerBanco: async k => (await prisma.configuracao.findUnique({ where: { chave: k }, select: { valor: true } }))?.valor,
  gravarBanco: async (k, v) => { await prisma.configuracao.upsert({ where: { chave: k }, create: { chave: k, valor: v, grupo: "integracoes" }, update: { valor: v } }); },
  fetchImpl: (...a) => fetch(...a),
  env: () => process.env.MAPBOX_PUBLIC_TOKEN?.trim() || undefined,
};

let cache: { em: number; valor: { token: string; fonte: "env" | "banco" } | null } | null = null;
const CACHE_MS = 5 * 60 * 1000;

export async function tokenMapbox(deps: MapboxDeps = mapboxDepsPadrao): Promise<{ token: string; fonte: "env" | "banco" } | null> {
  const env = deps.env();
  if (env) return { token: env, fonte: "env" };
  if (cache && Date.now() - cache.em < CACHE_MS) return cache.valor;
  let valor: { token: string; fonte: "env" | "banco" } | null = null;
  try {
    const gravado = await deps.lerBanco(CHAVE_SEGREDO_MAPBOX);
    if (gravado) valor = { token: descriptografarSegredo(gravado), fonte: "banco" };
  } catch { valor = null; }
  cache = { em: Date.now(), valor };
  return valor;
}

/** Valida o formato e o token no Mapbox ANTES de salvar (criptografado). */
export async function salvarTokenMapbox(bruto: unknown, deps: MapboxDeps = mapboxDepsPadrao): Promise<{ mensagem: string }> {
  const token = normalizarTokenMapbox(bruto);
  const r = await verificarTokenMapbox(token, deps.fetchImpl);
  if (!r.ok) throw new Error(r.mensagem);
  await deps.gravarBanco(CHAVE_SEGREDO_MAPBOX, criptografarSegredo(token));
  cache = null;
  return { mensagem: r.mensagem };
}

export async function removerTokenMapbox(deps: MapboxDeps = mapboxDepsPadrao): Promise<void> {
  await deps.gravarBanco(CHAVE_SEGREDO_MAPBOX, "");
  cache = null;
}

export function limparCacheMapbox() { cache = null; }
