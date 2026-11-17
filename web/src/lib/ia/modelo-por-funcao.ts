// Paridade 17/11, bloco 3 (gêmeo de Prospecta/server/_core/modelo-por-funcao.ts, EPIC-024 S-11): qual modelo da
// Anthropic cada função usa. Lê SÓ os nomes de modelo guardados em configuracoes (o da função e o preferencial do
// painel) — nunca a chave: este módulo não importa o painel nem o cofre (a guarda em
// src/lib/__tests__/integracoes-anthropic.test.ts confere).
// Resolução, sempre nesta ordem: variável de ambiente da função (Mercado: INCORPORACAO_IA_MODELO — continua com
// prioridade, como antes) → modelo da função → modelo anterior da função (Central de Vendas: o "Modelo da IA" das
// configurações da Central) → modelo preferencial do painel → padrão próprio da função.
import { prisma } from "@/lib/db";
import { FUNCOES_ANTHROPIC, ehFuncaoAnthropic, type FuncaoAnthropic } from "@/lib/ia/funcoes-anthropic";

/** Modelo preferencial do painel. */
export const CHAVE_MODELO_PREFERENCIAL = "segredo.anthropic_painel_modelo";
/** Modelo escolhido para a função (vazio = usar o preferencial). */
export const chaveModeloDaFuncao = (f: FuncaoAnthropic) => `${CHAVE_MODELO_PREFERENCIAL}.${f}`;
/** Id do modelo que foi limpo por ter sumido da conta (o painel avisa até o admin escolher de novo). */
export const chaveAvisoDaFuncao = (f: FuncaoAnthropic) => `${CHAVE_MODELO_PREFERENCIAL}_sumiu.${f}`;

export type OrigemModelo = "ambiente" | "funcao" | "anterior" | "preferencial" | "padrao";
export type ModeloResolvido = { modelo: string | null; origem: OrigemModelo | null };
export type LeitorModelos = { lerBanco: (chave: string) => Promise<string | undefined> };
export const leitorModelosPadrao: LeitorModelos = {
  lerBanco: async (k) => (await prisma.configuracao.findUnique({ where: { chave: k }, select: { valor: true } }))?.valor ?? undefined,
};

const limpo = (v: string | null | undefined) => (v ?? "").trim() || null;
/** Nunca lança: erro síncrono de `lerBanco` (antes de devolver a promessa) também vira "não escolhido". */
const ler = async (deps: LeitorModelos, chave: string) =>
  limpo(await Promise.resolve().then(() => deps.lerBanco(chave)).catch(() => undefined));

/**
 * Modelo que a função usa agora. Nunca lança: banco fora do ar = "não escolhido" (cai para o próximo da ordem).
 * `preferencial`: quem já leu o preferencial o passa; `undefined` = ler aqui.
 */
export async function modeloDaFuncao(
  funcao: FuncaoAnthropic,
  opcoes: { ambiente?: string | null; anterior?: string | null; preferencial?: string | null; padrao?: string | null } = {},
  deps: LeitorModelos = leitorModelosPadrao,
): Promise<ModeloResolvido> {
  if (!ehFuncaoAnthropic(funcao)) return { modelo: null, origem: null };
  const ambiente = limpo(opcoes.ambiente);
  if (ambiente) return { modelo: ambiente, origem: "ambiente" };
  const daFuncao = await ler(deps, chaveModeloDaFuncao(funcao));
  if (daFuncao) return { modelo: daFuncao, origem: "funcao" };
  const anterior = limpo(opcoes.anterior);
  if (anterior) return { modelo: anterior, origem: "anterior" };
  const preferencial = opcoes.preferencial !== undefined ? limpo(opcoes.preferencial) : await ler(deps, CHAVE_MODELO_PREFERENCIAL);
  if (preferencial) return { modelo: preferencial, origem: "preferencial" };
  const padrao = limpo(opcoes.padrao);
  return padrao ? { modelo: padrao, origem: "padrao" } : { modelo: null, origem: null };
}

/** O que está gravado para cada função (modelo escolhido e aviso de modelo sumido) — só nomes de modelo. */
export async function modelosGravadosDasFuncoes(deps: LeitorModelos = leitorModelosPadrao) {
  const r = {} as Record<FuncaoAnthropic, { modelo: string | null; sumiu: string | null }>;
  await Promise.all(FUNCOES_ANTHROPIC.map(async (f) => {
    const [modelo, sumiu] = await Promise.all([ler(deps, chaveModeloDaFuncao(f)), ler(deps, chaveAvisoDaFuncao(f))]);
    r[f] = { modelo, sumiu };
  }));
  return r;
}
