// Pedido de 23/10 (H4): notificações padronizadas — título curto com ícone, um
// cliente por linha, datas no padrão brasileiro, "e mais N" quando a lista é
// longa e um botão de ação ("Ver no CRM"). Vale também para as notificações já
// gravadas no formato antigo ("NOME (2026-10-22); NOME (...)"). Mesmo arquivo em
// Prospecta/shared/notificacao-formato.ts.

export type NotificacaoBruta = { title: string; message: string | null; type?: string | null; actionUrl?: string | null };
export type NotificacaoExibida = {
  icone: string;
  titulo: string;
  resumo: string | null;
  itens: string[];
  restantes: number;
  acao: { rotulo: string; url: string } | null;
};

/** Separador das linhas gravadas pelas notificações novas. */
export const SEPARADOR_ITENS = "\n";

const ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/g;

/** "2026-10-22" → "22/10/2026" em qualquer ponto do texto. */
export function datasParaBR(texto: string): string {
  return texto.replace(ISO, (_t, a, m, d) => `${d}/${m}/${a}`);
}

/** Linha de card com prazo: "NOME — prazo 22/10/2026". */
export function linhaPrazoCard(nome: string, prazoIso: string | null | undefined): string {
  return prazoIso ? `${nome} — prazo ${datasParaBR(prazoIso)}` : nome;
}

function itensDaMensagem(mensagem: string): string[] | null {
  const linhas = mensagem.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (linhas.length > 1) return linhas;
  // Formato antigo: "NOME (2026-10-22); NOME (2026-10-22)".
  const partes = mensagem.split(/;\s*/).map((l) => l.trim()).filter(Boolean);
  if (partes.length > 1 || /\(\d{4}-\d{2}-\d{2}\)\s*$/.test(mensagem.trim())) {
    return partes.map((p) => p.replace(/^(.*?)\s*\((\d{4}-\d{2}-\d{2})\)$/, (_t, nome, data) => linhaPrazoCard(nome, data)));
  }
  return null;
}

/** Título antigo do resumo de prazos → título curto; títulos longos são abreviados. */
export function tituloPrazosCards(n: number): string {
  return `${n} card${n === 1 ? "" : "s"} com prazo até hoje`;
}

function tituloCurto(titulo: string): string {
  const cards = /^(\d+)\s+cards?\s+precisa/i.exec(titulo);
  if (cards) return tituloPrazosCards(Number(cards[1]));
  return titulo.length > 70 ? `${titulo.slice(0, 67)}…` : titulo;
}

/** Ícones por tipo (tipos da Prospecta e do Grupo Santa Fé). */
const ICONE_POR_TIPO: Record<string, string> = {
  vencimento_card: "⏰", medicao_solicitada: "📏", novo_lead: "👤", novo_imovel: "🏠", novo_corretor: "🤝",
  novo_financiamento: "📋", nova_obra: "🏗️", nova_regularizacao: "📄", cobranca_vencendo: "💰", prazo_obra: "🏗️",
  construction_update: "🏗️", obra: "🏗️", draw_result: "🎉", utef_update: "💰", promotional: "🎁",
};

function iconeDa(n: NotificacaoBruta): string {
  if (n.type && ICONE_POR_TIPO[n.type]) return ICONE_POR_TIPO[n.type];
  const url = n.actionUrl ?? "";
  if (/cards?\s/i.test(n.title) && /crm|leads/.test(url)) return "⏰";
  if (/documento/i.test(n.title)) return "📄";
  if (/medi[cç]/i.test(n.title)) return "📏";
  if (/crm|leads/.test(url)) return "📋";
  return "🔔";
}

function acaoDa(url: string | null | undefined): NotificacaoExibida["acao"] {
  if (!url) return null;
  if (/^\/admin\/(crm|leads)/.test(url)) return { rotulo: "Ver no CRM", url };
  if (/obras?\b/.test(url)) return { rotulo: "Ver obra", url };
  if (/^\/(portal|cliente)/.test(url)) return { rotulo: "Abrir no portal", url };
  return { rotulo: "Abrir", url };
}

/** Formato único usado no sino e na página "Ver todas". */
export function exibirNotificacao(n: NotificacaoBruta, maxItens = 5): NotificacaoExibida {
  const mensagem = (n.message ?? "").trim();
  const itens = mensagem ? itensDaMensagem(mensagem) : null;
  const visiveis = itens ? itens.slice(0, maxItens).map(datasParaBR) : [];
  return {
    icone: iconeDa(n),
    titulo: datasParaBR(tituloCurto(n.title.trim())),
    resumo: itens ? null : mensagem ? datasParaBR(mensagem) : null,
    itens: visiveis,
    restantes: itens ? Math.max(0, itens.length - maxItens) : 0,
    acao: acaoDa(n.actionUrl),
  };
}
