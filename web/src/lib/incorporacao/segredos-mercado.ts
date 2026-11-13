import "server-only";
// Chaves dos provedores de anúncios (Tavily e Google) no PRÓPRIO banco — paridade Prospecta
// (server/_core/incorporacao/segredos-mercado.ts), reaproveitando o cofre do Santa Fé:
// tabela `configuracoes` (mesma das outras chaves de Admin › Integrações, grupo "integracoes")
// e a criptografia AES-256-GCM de `@/lib/segredo`.
// Ordem: variável de ambiente (TAVILY_API_KEY / GEMINI_API_KEY) > configuracoes["segredo.tavily_api_key" /
// "segredo.gemini_api_key"]. Valor gravado como "plain:<chave>" (pela equipe/agente, sem acesso à
// chave do servidor) é recriptografado no primeiro uso. Chaves "segredo.*" nunca vão para o navegador.
import { prisma } from "@/lib/db";
import { criptografarSegredo, descriptografarSegredo, segredoEmTextoPuro } from "@/lib/segredo";
import { MERCADO_ENV } from "./mercado-config";

export const CHAVE_SEGREDO_GEMINI = "segredo.gemini_api_key";
export const CHAVE_SEGREDO_TAVILY = "segredo.tavily_api_key";
export const PREFIXO_SEGREDO = "segredo.";

export type BancoSegredos = {
  lerConfiguracao(chave: string): Promise<string | undefined>;
  gravarConfiguracao(chave: string, valor: string): Promise<void>;
};

export const bancoSegredosPadrao: BancoSegredos = {
  lerConfiguracao: async (k) => (await prisma.configuracao.findUnique({ where: { chave: k }, select: { valor: true } }))?.valor ?? undefined,
  gravarConfiguracao: async (k, v) => {
    await prisma.configuracao.upsert({ where: { chave: k }, create: { chave: k, valor: v, grupo: "integracoes" }, update: { valor: v } });
  },
};

const caches = new Map<string, { em: number; valor: string }>();
const CACHE_MS = 5 * 60 * 1000;

type CampoEnv = "geminiApiKey" | "tavilyApiKey";

/** Preenche MERCADO_ENV[campo] a partir da variável de ambiente ou do banco. Nunca lança: sem chave, o provedor informa a falta. */
async function carregarChave(banco: BancoSegredos, nomesEnv: string[], chaveBanco: string, campo: CampoEnv, agora: number): Promise<string> {
  const doAmbiente = nomesEnv.map((n) => process.env[n]).find((v) => v);
  if (doAmbiente) { MERCADO_ENV[campo] = doAmbiente; return doAmbiente; }
  const c = caches.get(chaveBanco);
  if (c && agora - c.em < CACHE_MS) { MERCADO_ENV[campo] = c.valor; return c.valor; }
  try {
    const gravado = await banco.lerConfiguracao(chaveBanco);
    if (!gravado) { MERCADO_ENV[campo] = ""; return ""; }
    const valor = descriptografarSegredo(gravado).trim();
    if (segredoEmTextoPuro(gravado)) {
      try { await banco.gravarConfiguracao(chaveBanco, criptografarSegredo(valor)); } catch { /* recriptografa no próximo uso */ }
    }
    caches.set(chaveBanco, { em: agora, valor });
    MERCADO_ENV[campo] = valor;
    return valor;
  } catch {
    MERCADO_ENV[campo] = "";
    return "";
  }
}

/** Garante MERCADO_ENV.geminiApiKey preenchida (variável de ambiente ou banco). */
export function carregarChaveGemini(banco: BancoSegredos = bancoSegredosPadrao, agora = Date.now()): Promise<string> {
  return carregarChave(banco, ["GEMINI_API_KEY", "GOOGLE_API_KEY"], CHAVE_SEGREDO_GEMINI, "geminiApiKey", agora);
}

/** Garante MERCADO_ENV.tavilyApiKey preenchida (TAVILY_API_KEY ou banco `segredo.tavily_api_key`). */
export function carregarChaveTavily(banco: BancoSegredos = bancoSegredosPadrao, agora = Date.now()): Promise<string> {
  return carregarChave(banco, ["TAVILY_API_KEY"], CHAVE_SEGREDO_TAVILY, "tavilyApiKey", agora);
}

export function _limparCacheChaveGemini() { caches.clear(); }
