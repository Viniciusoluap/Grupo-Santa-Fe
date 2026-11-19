// Paridade 17/11, bloco 3 (gêmeo de Prospecta/shared/funcoes-anthropic.ts, EPIC-024 S-11): funções do sistema que
// usam a Anthropic e ganham uma linha em Integrações › Anthropic › "Modelo por função". Fonte única: o painel monta
// uma linha por função e a resolução do modelo (@/lib/ia/modelo-por-funcao) só aceita estas.
// Santa Fé: Dolores e Maquete 3D não existem aqui. As funções são o agente da Central de Vendas e a pesquisa de
// anúncios do Mercado da Incorporação (quando roda pela Anthropic). Nenhuma delas usa a chave do painel: cada uma
// continua com a sua chave (variável de ambiente ou a chave própria da Central). Escolher o modelo nunca liga a IA.
// Só nomes e textos — nenhuma chave nem acesso a banco aqui (pode ir para o navegador).

export const FUNCOES_ANTHROPIC = ["central_vendas_agente", "incorporacao_mercado"] as const;
export type FuncaoAnthropic = (typeof FUNCOES_ANTHROPIC)[number];

export type DescricaoFuncaoAnthropic = {
  id: FuncaoAnthropic;
  rotulo: string;
  /** O que faz e quando gasta, para o dono. */
  descricao: string;
  recomendacao: string;
};

export const DESCRICAO_FUNCOES_ANTHROPIC: Record<FuncaoAnthropic, DescricaoFuncaoAnthropic> = {
  central_vendas_agente: {
    id: "central_vendas_agente",
    rotulo: "Central de Vendas — agente de atendimento inicial",
    descricao: "Responde ao primeiro contato do lead (saudação, consentimento e qualificação) e passa para a equipe. Só gasta com a IA da Central de Vendas ligada, a cada mensagem, até o limite mensal de tokens definido na Central.",
    recomendacao: "Um modelo equilibrado (ex.: Sonnet) costuma bastar; respostas curtas e regras conferidas pelo sistema.",
  },
  incorporacao_mercado: {
    id: "incorporacao_mercado",
    rotulo: "Mercado da Incorporação — pesquisa de anúncios na web",
    descricao: "Pesquisa anúncios de imóveis na web para o estudo de mercado, quando o provedor em uso é a busca da Anthropic (sem Tavily nem Google configurados). Só gasta quando alguém pede a pesquisa de anúncios, e nunca com INCORPORACAO_IA_ATIVA=0.",
    recomendacao: "Um modelo que use bem a busca na web (ex.: Sonnet); anúncio sem link é descartado pelo sistema.",
  },
};

export const ehFuncaoAnthropic = (v: unknown): v is FuncaoAnthropic =>
  typeof v === "string" && (FUNCOES_ANTHROPIC as readonly string[]).includes(v);

/** O que a tela "Modelo por função" sabe de uma função (só nomes de modelo). */
export type EstadoModeloDaFuncao = { modelo: string | null; sumiu?: string | null };

/**
 * QA S-11 achado 1 (Prospecta): o botão Salvar fica habilitado quando há o que gravar — trocar o modelo escolhido, ou
 * salvar "Usar o preferencial" (valor vazio) quando há aviso de modelo sumido (o aviso sai).
 */
export function haAlgoParaSalvar(f: EstadoModeloDaFuncao, valor: string): boolean {
  if (valor !== (f.modelo ?? "")) return true;
  return valor === "" && !!f.sumiu;
}
