// Lote 4 (30/10/2026): "Restaurar" uma exclusão em lote do BPO a partir do backup JSON
// (bpo_lancamento_exclusoes_backup). Regra pura (sem banco/rede): decide o que volta, o que já
// existe (não duplica) e quais vínculos externos sumiram (restaura sem o vínculo e avisa).
// Gêmeos: Prospecta shared/financeiro/bpo-restauracao.ts · Santa Fé web/src/lib/bpo-restauracao.ts.

export const CONFIRMACAO_RESTAURACAO = "RESTAURAR";
export const confirmacaoRestauracaoValida = (texto: string | null | undefined) => String(texto ?? "").trim() === CONFIRMACAO_RESTAURACAO;

/** Linha do snapshot gravado na exclusão (colunas do lançamento + campos calculados da tela). */
export type ItemSnapshot = Record<string, unknown> & { id: string | number };

export type ContextoRestauracao = {
  /** IDs de lançamentos que existem hoje (o mesmo ID nunca é recriado: não duplica). */
  idsExistentes: Set<string>;
  /** IDs de clientes BPO que existem hoje. */
  clientesExistentes: Set<string>;
  /** O registro operacional (obra, projeto, comissão…) ainda existe? */
  vinculoExiste: (tipo: string, categoriaOperacional: string, id: string) => boolean;
  /** Valores já usados em colunas únicas (ex.: requestKey) por OUTROS lançamentos. */
  unicosEmUso: Record<string, Set<string>>;
};

export type ItemPlano = {
  id: string;
  descricao: string;
  valor: number;
  vencimento: string | null;
  clienteNome: string | null;
  acao: "restaurar" | "ja_existe";
  avisos: string[];
  /** Colunas a gravar na volta (já sem os vínculos que não existem mais). */
  dados: Record<string, unknown>;
};

export type PlanoRestauracao = {
  itens: ItemPlano[];
  restaurar: number;
  jaExistem: number;
  comAviso: number;
};

/** Colunas que, por regra da exclusão em lote, sempre eram vazias — e continuam vazias na volta. */
const SEMPRE_VAZIOS = ["asaasPaymentId", "transacaoId", "bankTransactionId", "combinadaEmId"];

const texto = (v: unknown) => (v == null ? "" : String(v)).trim();

export function lerSnapshot(json: string): ItemSnapshot[] {
  let v: unknown;
  try { v = JSON.parse(json); } catch { throw new Error("Backup corrompido: o JSON da exclusão não pôde ser lido."); }
  if (!Array.isArray(v)) throw new Error("Backup corrompido: formato inesperado.");
  return v.filter((x): x is ItemSnapshot => !!x && typeof x === "object" && "id" in x && x.id != null);
}

/**
 * Monta o plano. `colunas` = colunas reais da tabela bpo_lancamentos (o snapshot também traz
 * campos calculados como clienteNome/baixas, que não são gravados). `colunasData` são convertidas
 * de texto ISO para Date.
 */
export function planejarRestauracao(
  snapshot: ItemSnapshot[],
  ctx: ContextoRestauracao,
  colunas: readonly string[],
  colunasData: readonly string[],
): PlanoRestauracao {
  const vistos = new Set<string>();
  const itens: ItemPlano[] = snapshot.map((s) => {
    const id = String(s.id);
    const clienteNome = texto(s.clienteNome) && texto(s.clienteNome) !== "—" ? texto(s.clienteNome) : texto(s.clienteNomeLivre) || null;
    const base = {
      id, descricao: texto(s.descricao), valor: Number(s.valor ?? 0) || 0,
      vencimento: s.vencimento ? String(s.vencimento) : null, clienteNome,
    };
    if (ctx.idsExistentes.has(id) || vistos.has(id)) {
      return { ...base, acao: "ja_existe" as const, avisos: ["Já existe no BPO (não será duplicado)."], dados: {} };
    }
    vistos.add(id);
    const dados: Record<string, unknown> = {};
    for (const c of colunas) if (c in s) dados[c] = s[c];
    for (const c of colunasData) if (typeof dados[c] === "string") dados[c] = new Date(dados[c] as string);
    for (const c of SEMPRE_VAZIOS) if (c in dados) dados[c] = null;
    const avisos: string[] = [];
    if (dados.clienteId != null && !ctx.clientesExistentes.has(String(dados.clienteId))) {
      avisos.push(`O cliente BPO (${clienteNome ?? `#${dados.clienteId}`}) não existe mais: volta sem o vínculo, com o nome como texto.`);
      dados.clienteId = null;
      if (!texto(dados.clienteNomeLivre) && clienteNome) dados.clienteNomeLivre = clienteNome;
    }
    const vinculo = texto(dados.vinculoOperacionalId);
    if (vinculo && !ctx.vinculoExiste(texto(dados.tipo), texto(dados.categoriaOperacional), vinculo)) {
      avisos.push(`O registro operacional vinculado (${texto(dados.vinculoOperacionalRotulo) || vinculo}) não existe mais: volta sem o vínculo.`);
      dados.vinculoOperacionalId = null;
      dados.vinculoOperacionalRotulo = null;
    }
    for (const [coluna, emUso] of Object.entries(ctx.unicosEmUso)) {
      const v = texto(dados[coluna]);
      if (v && emUso.has(v)) {
        avisos.push(`A chave única "${coluna}" já está em uso por outro lançamento: volta sem ela.`);
        dados[coluna] = null;
      }
    }
    return { ...base, acao: "restaurar" as const, avisos, dados };
  });
  return {
    itens,
    restaurar: itens.filter((i) => i.acao === "restaurar").length,
    jaExistem: itens.filter((i) => i.acao === "ja_existe").length,
    comAviso: itens.filter((i) => i.acao === "restaurar" && i.avisos.length > 0).length,
  };
}
