// Lote 23/10, etapa 6 — "Duplicar lead". Gêmeo de
// Prospecta/shared/lead-duplicar.ts (mesmas regras).
//
// Copia: dados cadastrais e informações do lead + documentos (o mesmo arquivo do
// Drive é reaproveitado; o documento copiado é um registro novo, então excluir ou
// trocar o documento num lead não mexe no outro — e nenhum fluxo apaga o arquivo
// do Drive). NÃO copia: serviços, processos, etapas, solicitações/entregas,
// tarefas, visitas, contratos, histórico/atividades, acesso do cliente ao portal.
// O lead novo começa na primeira etapa do pipeline e guarda a origem.

/** Campos que voltam ao início no lead novo (pertencem ao andamento do lead original). */
export const CAMPOS_REINICIADOS = ["etapa", "motivo de recusa", "follow-up", "prazo do card", "exclusão/arquivamento"] as const;

export const NAO_COPIADOS = ["serviços", "processos e etapas", "solicitações e entregas", "tarefas e visitas", "contratos", "histórico transacional", "acesso do cliente ao portal"] as const;

export function textoConfirmacaoDuplicar(nome: string): string {
  return `Duplicar o lead "${nome}"? Será criado um lead novo com os mesmos dados e documentos. ` +
    `Não são copiados: ${NAO_COPIADOS.join(", ")}.`;
}

/** Modelos das notas (placeholders %s, na ordem; usados também via format() no SQL). */
export const MODELO_NOTA_LEAD_NOVO = "Lead criado por duplicação do lead nº %s (%s); %s documento(s) copiado(s).";
export const MODELO_NOTA_LEAD_ORIGEM = "Lead duplicado: criado o lead nº %s com os mesmos dados e documentos.";

export function preencherModelo(modelo: string, ...valores: Array<string | number>): string {
  let i = 0;
  return modelo.replace(/%s/g, () => String(valores[i++] ?? ""));
}
