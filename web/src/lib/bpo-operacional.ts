import { SERVICOS_PROGRESSO } from "@/lib/financeiro/progresso";

/**
 * Lote 3, item 12 (29/10, paridade Prospecta `shared/financeiro/bpo-operacional.ts`): categorias
 * operacionais sem registro vinculado, válidas para cobrança e despesa. Decisão: "projetos"
 * (cobrança) continua sendo o vínculo com um projeto cadastrado; "projetos_taxas" é a
 * classificação sem vínculo para taxas, ART/RRT, alvarás e projetos avulsos.
 */
export const CATEGORIAS_SEM_VINCULO = ["projetos_taxas", "impostos", "tarifas_bancarias", "pro_labore", "administrativo", "outros"] as const;
export const CATEGORIAS_RECEITA = ["obras", "regularizacoes", "comissoes", "projetos", "avaliacoes", "imoveis", "incorporacao", "financiamentos", ...CATEGORIAS_SEM_VINCULO] as const;
export const CATEGORIAS_DESPESA = ["obras", "tarefas_agenda", "regularizacoes", "comissoes", "incorporacao", ...CATEGORIAS_SEM_VINCULO] as const;
export const ROTULOS_OPERACIONAIS: Record<string, string> = { obras: "Obras", tarefas_agenda: "Tarefas e Agenda", regularizacoes: "Regularizações", comissoes: "Comissões", projetos: "Projetos", avaliacoes: "Avaliações", imoveis: "Imóveis", incorporacao: "Incorporação", financiamentos: "Financiamentos", projetos_taxas: "Projetos e taxas", impostos: "Impostos", tarifas_bancarias: "Tarifas bancárias", pro_labore: "Pró-labore", administrativo: "Administrativo", outros: "Outros" };

export const categoriaSemVinculo = (categoria: string | null | undefined) => (CATEGORIAS_SEM_VINCULO as readonly string[]).includes(categoria ?? "");

const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[\s-]+/g, "_");
const ehSaida = (tipo: string) => tipo === "despesa" || tipo.startsWith("despesa_");

/**
 * Item 12: a "Categoria contábil" saiu da tela; `categoria`/`categoriaContabil` (DRE, contabilidade,
 * impostos, extrato) passam a ser derivadas da Categoria Operacional. Cobrança: financiamentos →
 * "Financiamento/CAIXA", demais → "Recebimento de cliente". Despesa de obra: Material → "Material";
 * Mão de obra/Empreiteiro → "Mão de obra"; demais → "Outros". Mesma regra da Prospecta.
 */
export function categoriaContabilDaOperacional(tipo: string, operacional: string | null | undefined, tipoDespesaObra?: string | null): string {
  switch (operacional) {
    case "impostos": return "Impostos";
    case "tarifas_bancarias": return "Tarifas bancárias";
    case "pro_labore": return "Pró-labore";
    case "administrativo": return "Administrativo";
    case "projetos_taxas": return "Projetos e taxas";
    case "outros": return "Outros";
  }
  if (!ehSaida(tipo)) return operacional === "financiamentos" ? "Financiamento/CAIXA" : "Recebimento de cliente";
  if (operacional === "obras") {
    const t = semAcento(tipoDespesaObra ?? "");
    if (t === "material") return "Material";
    if (t === "mao_de_obra" || t === "empreiteiro") return "Mão de obra";
  }
  return "Outros";
}

/** Na edição mantém a categoria gravada (extrato/Asaas/antigos) e só recalcula quando a operacional muda. */
export function categoriaNaEdicao(tipo: string, antes: { categoria: string | null; categoriaOperacional: string | null; tipoDespesaObra: string | null }, depois: { categoriaOperacional?: string | null; tipoDespesaObra?: string | null }): string {
  const op = depois.categoriaOperacional || null;
  const mudou = op !== (antes.categoriaOperacional || null) || (depois.tipoDespesaObra || null) !== (antes.tipoDespesaObra || null);
  if (op && (mudou || !antes.categoria)) return categoriaContabilDaOperacional(tipo, op, depois.tipoDespesaObra);
  return antes.categoria || categoriaContabilDaOperacional(tipo, op, depois.tipoDespesaObra);
}
export const TIPOS_DESPESA_OBRA = ["Empreiteiro", "Terreno", "Comissão", "Fornecedor", "Outros", "Mão de obra", "Material"];
export type VinculoBpo = { id: string; rotulo: string; clienteNome: string | null; leadId: string | null; href: string };
export type CatalogoBpo = Record<string, VinculoBpo[]>;
export function validarOperacaoBpo(input: { tipo: string; categoriaOperacional?: string | null; vinculoOperacionalId?: string | null; tipoDespesaObra?: string | null; etapa?: string | null }, obrigatorio = true) {
  if (!obrigatorio && !input.categoriaOperacional && !input.vinculoOperacionalId) return;
  const categorias: readonly string[] = input.tipo === "despesa" ? CATEGORIAS_DESPESA : CATEGORIAS_RECEITA;
  if (!categorias.includes(input.categoriaOperacional ?? "")) throw new Error("Selecione uma categoria operacional válida.");
  if (categoriaSemVinculo(input.categoriaOperacional)) {
    if (input.vinculoOperacionalId) throw new Error("Esta categoria não tem registro vinculado.");
  } else if (!input.vinculoOperacionalId) throw new Error("Selecione o registro operacional vinculado.");
  if (input.tipo === "despesa" && input.categoriaOperacional === "obras") {
    if (!TIPOS_DESPESA_OBRA.includes(input.tipoDespesaObra ?? "")) throw new Error("Selecione o tipo da despesa de obra.");
    if (input.etapa && !SERVICOS_PROGRESSO.some((s) => s.chave === input.etapa)) throw new Error("Etapa inválida.");
  } else if (input.tipoDespesaObra || input.etapa) throw new Error("Tipo da despesa e etapa são exclusivos de despesas de obras.");
}
