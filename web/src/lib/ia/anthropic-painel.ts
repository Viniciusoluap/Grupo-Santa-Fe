import "server-only";
// Paridade 17/11, bloco 3 (gêmeo de Prospecta/server/_core/anthropic-painel.ts, EPIC-024 S-10 e S-11): chave da
// Anthropic cadastrada em Admin › Integrações — SÓ cadastro. Fica em configuracoes["segredo.anthropic_painel_api_key"]
// (AES-256-GCM, @/lib/segredo, grupo "integracoes") e NUNCA é lida por função nenhuma do Santa Fé: a Central de
// Vendas continua com a chave própria dela ou ANTHROPIC_API_KEY, e o Mercado continua com ANTHROPIC_API_KEY. Assim,
// cadastrar a chave aqui não liga em silêncio nenhuma IA paga. O teste de conexão e a lista de modelos usam
// client.models.list() (não consome tokens). A guarda em src/lib/__tests__/integracoes-anthropic.test.ts confere.
// O que o painel muda nas funções: só o NOME do modelo (modelo por função e preferencial), resolvido em
// @/lib/ia/modelo-por-funcao — e a variável de ambiente da função continua com prioridade.
import { prisma } from "@/lib/db";
import { criptografarSegredo, descriptografarSegredo, segredoEmTextoPuro } from "@/lib/segredo";
import { DESCRICAO_FUNCOES_ANTHROPIC, FUNCOES_ANTHROPIC, type FuncaoAnthropic } from "@/lib/ia/funcoes-anthropic";
import {
  CHAVE_MODELO_PREFERENCIAL, chaveAvisoDaFuncao, chaveModeloDaFuncao, modeloDaFuncao, modelosGravadosDasFuncoes, type LeitorModelos, type OrigemModelo,
} from "@/lib/ia/modelo-por-funcao";

export const CHAVE_SEGREDO_ANTHROPIC_PAINEL = "segredo.anthropic_painel_api_key";
export const CHAVE_MODELO_ANTHROPIC_PAINEL = CHAVE_MODELO_PREFERENCIAL;

export type FamiliaModelo = "opus" | "sonnet" | "haiku" | "fable" | "outro";
export type ModeloAnthropic = { id: string; nome: string; familia: FamiliaModelo; lancadoEm: string | null };

type ModeloSdk = { id: string; display_name?: string | null; created_at?: string | null };
/** O mínimo do SDK que usamos: client.models.list() é iterável página a página (for await). */
export type ClienteModelos = { models: { list: (params?: { limit?: number }) => AsyncIterable<ModeloSdk> } };

export type AnthropicPainelDeps = {
  lerBanco: (chave: string) => Promise<string | undefined>;
  gravarBanco: (chave: string, valor: string) => Promise<void>;
  criarCliente: (apiKey: string) => Promise<ClienteModelos> | ClienteModelos;
  encrypt: (valor: string) => string;
  decrypt: (valor: string) => string;
};

export const anthropicPainelDepsPadrao: AnthropicPainelDeps = {
  lerBanco: async (k) => (await prisma.configuracao.findUnique({ where: { chave: k }, select: { valor: true } }))?.valor ?? undefined,
  gravarBanco: async (k, v) => { await prisma.configuracao.upsert({ where: { chave: k }, create: { chave: k, valor: v, grupo: "integracoes" }, update: { valor: v } }); },
  criarCliente: async (apiKey) => {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    return new Anthropic({ apiKey, maxRetries: 1, timeout: 20_000 }) as unknown as ClienteModelos;
  },
  encrypt: criptografarSegredo,
  decrypt: descriptografarSegredo,
};

/** Esconde qualquer chave "sk-ant-…" que apareça num texto (mensagem de erro, log). */
export function mascararChaveAnthropic(texto: string): string {
  return texto.replace(/sk-ant-[A-Za-z0-9_-]*/g, "sk-ant-…");
}

export function familiaDoModelo(id: string, nome = ""): FamiliaModelo {
  const t = `${id} ${nome}`.toLowerCase();
  for (const f of ["opus", "sonnet", "haiku", "fable"] as const) if (t.includes(f)) return f;
  return "outro";
}

function normalizarChave(bruto: unknown): string {
  const chave = String(bruto ?? "").trim();
  if (!chave) throw new Error("Cole a chave de API da Anthropic.");
  if (/\s/.test(chave) || chave.length < 20) throw new Error("Chave inválida: confira se foi copiada inteira, sem espaços.");
  return chave;
}

function mensagemDeErro(e: unknown): string {
  const status = (e as { status?: number })?.status;
  if (status === 401) return "A Anthropic recusou a chave (HTTP 401): chave inválida ou revogada.";
  if (status === 403) return "A Anthropic recusou a chave (HTTP 403): a chave não tem permissão para listar modelos.";
  if (status === 429) return "A Anthropic limitou as consultas (HTTP 429). Tente de novo em instantes.";
  const msg = e instanceof Error && e.message ? e.message : "A Anthropic não respondeu.";
  return mascararChaveAnthropic(status ? `A Anthropic respondeu HTTP ${status}: ${msg}` : msg);
}

/** Modelos que a CONTA/CHAVE tem disponíveis, como a API devolve (nome e id oficiais), mais recentes primeiro. */
export async function listarModelosDaChave(apiKey: string, deps: AnthropicPainelDeps = anthropicPainelDepsPadrao): Promise<ModeloAnthropic[]> {
  try {
    const cliente = await deps.criarCliente(apiKey);
    const modelos: ModeloAnthropic[] = [];
    for await (const m of cliente.models.list({ limit: 100 })) {
      const nome = m.display_name?.trim() || m.id;
      modelos.push({ id: m.id, nome, familia: familiaDoModelo(m.id, nome), lancadoEm: m.created_at ?? null });
    }
    return modelos;
  } catch (e) {
    throw new Error(mensagemDeErro(e));
  }
}

export const MENSAGEM_CHAVE_ILEGIVEL = "Há uma chave salva que não pode ser lida (a chave do servidor mudou?) — cadastre de novo.";

/** Chave salva: "ilegivel" quando existe mas não decifra (ex.: AUTH_SECRET trocado). "plain:" é recriptografada. */
async function lerChaveSalva(deps: AnthropicPainelDeps): Promise<string | "ilegivel" | null> {
  const gravado = await deps.lerBanco(CHAVE_SEGREDO_ANTHROPIC_PAINEL).catch(() => undefined);
  if (!gravado) return null;
  let chave: string;
  try { chave = deps.decrypt(gravado).trim(); } catch { return "ilegivel"; }
  if (!chave) return "ilegivel";
  if (segredoEmTextoPuro(gravado)) {
    try { await deps.gravarBanco(CHAVE_SEGREDO_ANTHROPIC_PAINEL, deps.encrypt(chave)); } catch { /* recriptografa no próximo uso */ }
  }
  return chave;
}

/** A chave pronta para listar modelos; ilegível vira erro com a orientação. */
async function lerChave(deps: AnthropicPainelDeps): Promise<string | null> {
  const c = await lerChaveSalva(deps);
  if (c === "ilegivel") throw new Error(MENSAGEM_CHAVE_ILEGIVEL);
  return c;
}

async function lerModelo(deps: AnthropicPainelDeps): Promise<string | null> {
  return (await deps.lerBanco(CHAVE_MODELO_ANTHROPIC_PAINEL).catch(() => undefined))?.trim() || null;
}

const finalDe = (v: string) => (v.length >= 8 ? `…${v.slice(-4)}` : "…");

/** O que está salvo — sem a chave: só os 4 últimos caracteres e o id do modelo preferencial. */
export async function statusAnthropicPainel(deps: AnthropicPainelDeps = anthropicPainelDepsPadrao) {
  const [salva, modelo] = await Promise.all([lerChaveSalva(deps), lerModelo(deps)]);
  const chave = salva === "ilegivel" ? null : salva;
  return {
    configurado: Boolean(chave), final: chave ? finalDe(chave) : null, modeloPreferencial: modelo, ativa: false as const,
    /** Existe valor salvo que não decifra: a tela pede para cadastrar de novo (não diz "nenhuma chave"). */
    ilegivel: salva === "ilegivel", aviso: salva === "ilegivel" ? MENSAGEM_CHAVE_ILEGIVEL : null,
  };
}

/** Teste disparado pelo admin: lista os modelos com a chave salva (sem consumir tokens). */
export async function testarAnthropicPainel(deps: AnthropicPainelDeps = anthropicPainelDepsPadrao): Promise<{ ok: boolean; mensagem: string }> {
  const chave = await lerChaveSalva(deps);
  if (chave === "ilegivel") return { ok: false, mensagem: MENSAGEM_CHAVE_ILEGIVEL };
  if (!chave) return { ok: false, mensagem: "Nenhuma chave da Anthropic salva." };
  try {
    const modelos = await listarModelosDaChave(chave, deps);
    return { ok: true, mensagem: `Anthropic conectada — ${modelos.length} modelo(s) disponível(is) para esta chave.` };
  } catch (e) {
    return { ok: false, mensagem: mascararChaveAnthropic(e instanceof Error ? e.message : String(e)) };
  }
}

/**
 * Valida a chave na Anthropic ANTES de salvar (criptografada). Troca a chave anterior, se houver; o modelo
 * preferencial (e o de cada função) que a chave nova não oferece é limpo, com aviso.
 */
export async function salvarChaveAnthropicPainel(bruto: unknown, deps: AnthropicPainelDeps = anthropicPainelDepsPadrao): Promise<{ mensagem: string; modelos: number; modeloLimpo: string | null }> {
  const chave = normalizarChave(bruto);
  const modelos = await listarModelosDaChave(chave, deps);
  await deps.gravarBanco(CHAVE_SEGREDO_ANTHROPIC_PAINEL, deps.encrypt(chave));
  const preferido = await lerModelo(deps);
  const modeloLimpo = preferido && !modelos.some((m) => m.id === preferido) ? preferido : null;
  if (modeloLimpo) await deps.gravarBanco(CHAVE_MODELO_ANTHROPIC_PAINEL, "");
  const funcoesLimpas = await conferirModelosDasFuncoes(modelos, deps);
  const avisoFuncoes = funcoesLimpas.map((f) => ` O modelo ${f.modelo} de "${DESCRICAO_FUNCOES_ANTHROPIC[f.funcao].rotulo}" não é oferecido para esta chave e foi limpo: a função passa a usar a próxima opção da ordem.`).join("");
  return {
    mensagem: `Chave validada e salva — ${modelos.length} modelo(s) disponível(is).${modeloLimpo ? ` O modelo preferencial ${modeloLimpo} não é oferecido para esta chave e foi limpo: escolha outro.` : ""}${avisoFuncoes}`,
    modelos: modelos.length, modeloLimpo,
  };
}

/** Remove a chave, a preferência de modelo, os modelos escolhidos por função e os avisos. */
export async function removerAnthropicPainel(deps: AnthropicPainelDeps = anthropicPainelDepsPadrao): Promise<void> {
  await deps.gravarBanco(CHAVE_SEGREDO_ANTHROPIC_PAINEL, "");
  await deps.gravarBanco(CHAVE_MODELO_ANTHROPIC_PAINEL, "");
  for (const f of FUNCOES_ANTHROPIC) {
    await deps.gravarBanco(chaveModeloDaFuncao(f), "");
    await deps.gravarBanco(chaveAvisoDaFuncao(f), "");
  }
}

/** Lista, na hora, os modelos da chave salva. */
export async function modelosAnthropicPainel(deps: AnthropicPainelDeps = anthropicPainelDepsPadrao): Promise<ModeloAnthropic[]> {
  const chave = await lerChave(deps);
  if (!chave) throw new Error("Salve a chave da Anthropic antes de listar os modelos.");
  return listarModelosDaChave(chave, deps);
}

/** Grava o modelo preferencial — só se a chave salva tiver esse modelo disponível. */
export async function salvarModeloPreferencialAnthropic(id: string, deps: AnthropicPainelDeps = anthropicPainelDepsPadrao): Promise<ModeloAnthropic> {
  const modelos = await modelosAnthropicPainel(deps);
  const modelo = modelos.find((m) => m.id === String(id ?? "").trim());
  if (!modelo) throw new Error("Esse modelo não está disponível para a chave salva. Atualize a lista e escolha outro.");
  await deps.gravarBanco(CHAVE_MODELO_ANTHROPIC_PAINEL, modelo.id);
  return modelo;
}

// ── S-11: modelo por função (só nomes de modelo; a resolução fica em @/lib/ia/modelo-por-funcao) ──

/**
 * QA S-11 achado 2 (Prospecta): o módulo de modelos recebe SÓ o leitor do banco — nunca `decrypt`, `criarCliente` nem
 * `encrypt`. Assim ele não tem com que decifrar a chave, mesmo que alguém tente.
 */
const soLeitor = (deps: AnthropicPainelDeps): LeitorModelos => ({ lerBanco: (k) => deps.lerBanco(k) });

/**
 * Modelo escolhido para uma função que não aparece mais na lista da conta: é limpo (a função cai para a próxima opção)
 * e o id fica guardado como aviso para o painel mostrar até o admin escolher de novo.
 */
export async function conferirModelosDasFuncoes(modelos: ModeloAnthropic[], deps: AnthropicPainelDeps = anthropicPainelDepsPadrao): Promise<Array<{ funcao: FuncaoAnthropic; modelo: string }>> {
  const gravados = await modelosGravadosDasFuncoes(soLeitor(deps));
  const limpas: Array<{ funcao: FuncaoAnthropic; modelo: string }> = [];
  for (const f of FUNCOES_ANTHROPIC) {
    const id = gravados[f].modelo;
    if (!id || modelos.some((m) => m.id === id)) continue;
    await deps.gravarBanco(chaveModeloDaFuncao(f), "");
    await deps.gravarBanco(chaveAvisoDaFuncao(f), id);
    limpas.push({ funcao: f, modelo: id });
  }
  return limpas;
}

/**
 * Confere o modelo de uma função SEM gravar nada: id vazio = "usar a próxima opção" (null); senão, só um id que a chave
 * salva oferece agora. Não chama a IA para a função (listar modelos não consome tokens).
 */
export async function validarModeloDaFuncao(funcao: FuncaoAnthropic, id: string, deps: AnthropicPainelDeps = anthropicPainelDepsPadrao): Promise<ModeloAnthropic | null> {
  if (!FUNCOES_ANTHROPIC.includes(funcao)) throw new Error("Função desconhecida.");
  const alvo = String(id ?? "").trim();
  if (!alvo) return null;
  const modelos = await modelosAnthropicPainel(deps);
  const modelo = modelos.find((m) => m.id === alvo) ?? null;
  if (!modelo) throw new Error("Esse modelo não está disponível para a chave salva. Atualize a lista e escolha outro.");
  return modelo;
}

/**
 * Grava o modelo (já validado) de uma função e apaga o aviso de modelo sumido. Se a gravação do modelo falhar, o aviso
 * volta a ser o de antes (QA S-11 achado 6: nada fica salvo pela metade) e o erro sobe.
 */
export async function gravarModeloDaFuncao(funcao: FuncaoAnthropic, modelo: ModeloAnthropic | null, deps: AnthropicPainelDeps = anthropicPainelDepsPadrao): Promise<void> {
  const aviso = chaveAvisoDaFuncao(funcao);
  const antes = (await deps.lerBanco(aviso))?.trim() ?? "";
  try {
    await deps.gravarBanco(aviso, "");
    await deps.gravarBanco(chaveModeloDaFuncao(funcao), modelo?.id ?? "");
  } catch (e) {
    if (antes) await deps.gravarBanco(aviso, antes).catch(() => undefined);
    throw e;
  }
}

/** Valida e grava o modelo de uma função (id vazio = "usar a próxima opção"). Não liga nada. */
export async function salvarModeloDaFuncao(funcao: FuncaoAnthropic, id: string, deps: AnthropicPainelDeps = anthropicPainelDepsPadrao): Promise<ModeloAnthropic | null> {
  const modelo = await validarModeloDaFuncao(funcao, id, deps);
  await gravarModeloDaFuncao(funcao, modelo, deps);
  return modelo;
}

/** O que cada função já tem fora do painel (só nomes de modelo e SE há chave — nunca a chave). */
export type ContextoDasFuncoes = Partial<Record<FuncaoAnthropic, {
  /** Variável de ambiente do modelo da função (prioridade, como antes). */
  ambiente?: string | null;
  /** Modelo configurado na própria função (Central de Vendas: "Modelo da IA" das configurações dela). */
  anterior?: string | null;
  padrao?: string | null;
  /** A função tem a chave dela (variável de ambiente ou chave própria)? Sem ela, a função não roda. */
  temChave?: boolean;
  /** Por que a função não roda sem a chave dela (texto para a tela). */
  semChave?: string | null;
  nota?: string | null;
}>>;

export const ROTULO_ORIGEM_MODELO: Record<OrigemModelo, string> = {
  ambiente: "variável de ambiente do servidor (tem prioridade)",
  funcao: "escolhido para esta função",
  anterior: "configurado na própria função",
  preferencial: "preferencial do painel",
  padrao: "padrão da função",
};

/**
 * Uma linha por função para o painel: escolhido, aviso de modelo sumido e o modelo que vale agora. Sem a chave.
 * Santa Fé: as funções não rodam pela chave do painel, então "valendo" é a resolução real da função (com a variável de
 * ambiente na frente), e `semChave` diz quando a função não tem a chave DELA (não roda, com ou sem modelo).
 * `configurado`: há chave legível no painel (necessária só para listar e escolher modelos).
 */
export async function statusModelosPorFuncao(contexto: ContextoDasFuncoes = {}, deps: AnthropicPainelDeps = anthropicPainelDepsPadrao) {
  const [salva, preferencial, gravados] = await Promise.all([lerChaveSalva(deps), lerModelo(deps), modelosGravadosDasFuncoes(soLeitor(deps))]);
  const funcoes = await Promise.all(FUNCOES_ANTHROPIC.map(async (f) => {
    const c = contexto[f] ?? {};
    const valendo = await modeloDaFuncao(f, { ambiente: c.ambiente ?? null, anterior: c.anterior ?? null, padrao: c.padrao ?? null, preferencial }, soLeitor(deps));
    return {
      ...DESCRICAO_FUNCOES_ANTHROPIC[f],
      modelo: gravados[f].modelo,
      sumiu: gravados[f].sumiu,
      nota: c.nota ?? null,
      semChave: c.temChave === false ? c.semChave ?? "A função está sem a chave dela: não roda (escolher o modelo não a liga)." : null,
      valendo,
    };
  }));
  return { configurado: Boolean(salva && salva !== "ilegivel"), preferencial, funcoes };
}
