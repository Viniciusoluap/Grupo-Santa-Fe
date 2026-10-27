import { SERVICOS_PROGRESSO } from "@/lib/financeiro/progresso";

export const CATEGORIAS_RECEITA = ["obras", "regularizacoes", "comissoes", "projetos", "avaliacoes", "imoveis", "incorporacao", "financiamentos"] as const;
export const CATEGORIAS_DESPESA = ["obras", "tarefas_agenda", "regularizacoes", "comissoes", "incorporacao"] as const;
export const ROTULOS_OPERACIONAIS: Record<string, string> = { obras: "Obras", tarefas_agenda: "Tarefas e Agenda", regularizacoes: "Regularizações", comissoes: "Comissões", projetos: "Projetos", avaliacoes: "Avaliações", imoveis: "Imóveis", incorporacao: "Incorporação", financiamentos: "Financiamentos" };
export const TIPOS_DESPESA_OBRA = ["Empreiteiro", "Terreno", "Comissão", "Fornecedor", "Outros", "Mão de obra", "Material"];
export type VinculoBpo = { id: string; rotulo: string; clienteNome: string | null; leadId: string | null; href: string };
export type CatalogoBpo = Record<string, VinculoBpo[]>;
export function validarOperacaoBpo(input: { tipo: string; categoriaOperacional?: string | null; vinculoOperacionalId?: string | null; tipoDespesaObra?: string | null; etapa?: string | null }, obrigatorio = true) {
  if (!obrigatorio && !input.categoriaOperacional && !input.vinculoOperacionalId) return;
  const categorias: readonly string[] = input.tipo === "despesa" ? CATEGORIAS_DESPESA : CATEGORIAS_RECEITA;
  if (!categorias.includes(input.categoriaOperacional ?? "")) throw new Error("Selecione uma categoria operacional válida.");
  if (!input.vinculoOperacionalId) throw new Error("Selecione o registro operacional vinculado.");
  if (input.tipo === "despesa" && input.categoriaOperacional === "obras") {
    if (!TIPOS_DESPESA_OBRA.includes(input.tipoDespesaObra ?? "")) throw new Error("Selecione o tipo da despesa de obra.");
    if (input.etapa && !SERVICOS_PROGRESSO.some((s) => s.chave === input.etapa)) throw new Error("Etapa inválida.");
  } else if (input.tipoDespesaObra || input.etapa) throw new Error("Tipo da despesa e etapa são exclusivos de despesas de obras.");
}
