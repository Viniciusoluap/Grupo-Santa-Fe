// Configuração dos provedores da Inteligência de Mercado (paridade Prospecta 13/11 —
// equivalente aos campos de `server/_core/env.ts` de lá). Objeto MUTÁVEL de propósito:
// `segredos-mercado.ts` preenche as chaves lidas do banco (Configurações › Integrações,
// `configuracoes["segredo.*"]`, criptografadas) quando a variável de ambiente não existe.
// Só é importado no servidor (ações/route handlers); nunca vai para o navegador.

export const MERCADO_ENV = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  /** INCORPORACAO_IA_ATIVA=0 desliga os provedores com IA (Gemini/Anthropic). O Tavily não usa IA. */
  incorporacaoIaDesligada: process.env.INCORPORACAO_IA_ATIVA === "0",
  incorporacaoIaModelo: process.env.INCORPORACAO_IA_MODELO || "claude-sonnet-5-5",
  geminiApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "",
  geminiModelo: process.env.INCORPORACAO_GEMINI_MODELO || "gemini-flash-latest",
  tavilyApiKey: process.env.TAVILY_API_KEY || "",
};
