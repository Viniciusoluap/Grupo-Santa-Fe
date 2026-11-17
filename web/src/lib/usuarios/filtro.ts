// Paridade 17/11, bloco 1 — EPIC-023 S-A da Prospecta (`AdminConfiguracoes.tsx`, `visiveis`): filtros da lista de
// "Usuários e acesso". Busca (nome, e-mail, CRECI, telefone, cliente do CRM) e situação, combinados.

export const SITUACOES = ["todos", "ativos", "inativos"] as const;
export type Situacao = (typeof SITUACOES)[number];

export interface ItemFiltravel {
  ativo: boolean;
  /** Textos onde a busca procura (vazios/nulos são ignorados). */
  textos: readonly (string | null | undefined)[];
}

export function casaSituacao(ativo: boolean, situacao: Situacao): boolean {
  return situacao === "todos" || ativo === (situacao === "ativos");
}

export function casaBusca(textos: ItemFiltravel["textos"], busca: string): boolean {
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  return !termo || textos.filter(Boolean).join(" ").toLocaleLowerCase("pt-BR").includes(termo);
}

export function filtrarItens<T extends ItemFiltravel>(itens: readonly T[], filtro: { busca: string; situacao: Situacao }): T[] {
  return itens.filter((i) => casaSituacao(i.ativo, filtro.situacao) && casaBusca(i.textos, filtro.busca));
}
