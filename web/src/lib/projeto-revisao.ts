// Lote 23/10, etapa 2C — "Solicitar revisão" de projeto. Mesmo arquivo em
// Prospecta/shared/projeto-revisao.ts.
//
// O pedido é salvo sempre (com autor, data e estado). Notificação interna e
// e-mail ao colaborador vinculado têm situação própria e honesta: nunca se marca
// como enviado o que não foi enviado.

export const LIMITE_PEDIDO_REVISAO = 2000;

export type SituacaoRevisao = "pendente" | "entregue";
export type SituacaoCanal = "enviado" | "sem_destinatario" | "falhou";

export const ROTULO_SITUACAO_REVISAO: Record<SituacaoRevisao, string> = {
  pendente: "Aguardando revisão",
  entregue: "Revisão entregue",
};

/** Arquivo da versão revisada, enviado ao Google Drive no próprio card. */
export interface EntregaRevisao {
  nome: string;
  url: string;
  driveFileId: string;
  tipo: "editable" | "pdf";
  enviadoEm: string;
  enviadoPor: string;
}

/** Texto do pedido: obrigatório e limitado. Devolve o texto limpo ou lança erro legível. */
export function validarPedidoRevisao(texto: unknown): string {
  const t = typeof texto === "string" ? texto.trim() : "";
  if (!t) throw new Error("Descreva a modificação solicitada.");
  if (t.length > LIMITE_PEDIDO_REVISAO) throw new Error(`O pedido pode ter no máximo ${LIMITE_PEDIDO_REVISAO} caracteres.`);
  return t;
}

export function rotuloCanal(canal: "notificacao" | "email", s: string | null | undefined): string {
  const nome = canal === "notificacao" ? "Notificação interna" : "E-mail";
  if (s === "enviado") return canal === "notificacao" ? "Notificação interna enviada" : "E-mail enviado";
  if (s === "sem_destinatario") return canal === "notificacao" ? "Sem colaborador vinculado — notificação não enviada" : "Colaborador sem e-mail — e-mail não enviado";
  if (s === "falhou") return `${nome}: falha no envio`;
  return `${nome}: —`;
}

/** Mensagem exibida a quem pediu a revisão logo após salvar. */
export function mensagemPedidoSalvo(notificacao: SituacaoCanal, email: SituacaoCanal): { tipo: "ok" | "aviso"; texto: string } {
  if (notificacao === "enviado" && email === "enviado") return { tipo: "ok", texto: "Pedido de revisão salvo. O colaborador foi notificado no sistema e por e-mail." };
  if (notificacao === "sem_destinatario") return { tipo: "aviso", texto: "Pedido de revisão salvo, mas o projeto não tem colaborador vinculado: ninguém foi notificado. Vincule o engenheiro responsável e avise-o." };
  const partes = [notificacao === "enviado" ? "notificado no sistema" : "a notificação interna falhou"];
  partes.push(email === "enviado" ? "o e-mail foi enviado" : email === "sem_destinatario" ? "o colaborador não tem e-mail cadastrado (e-mail não enviado)" : "o envio do e-mail falhou");
  return { tipo: "aviso", texto: `Pedido de revisão salvo: ${partes.join("; ")}.` };
}

const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

export function emailPedidoRevisao(d: { projeto: string; cliente: string; autor: string; texto: string; link: string | null }) {
  return {
    subject: `[Projetos] Revisão solicitada — ${d.projeto}`,
    html: `<p>Foi solicitada uma revisão no projeto <strong>${escapar(d.projeto)}</strong> (cliente ${escapar(d.cliente)}).</p>`
      + `<p><strong>Solicitado por:</strong> ${escapar(d.autor)}</p>`
      + `<p><strong>Modificação solicitada:</strong></p><p style="white-space:pre-wrap">${escapar(d.texto)}</p>`
      + (d.link ? `<p><a href="${escapar(d.link)}">Abrir o projeto e entregar a versão revisada</a></p>` : "<p>Abra o projeto no sistema para entregar a versão revisada.</p>"),
  };
}

export function lerEntregas(valor: unknown): EntregaRevisao[] {
  try {
    const v = typeof valor === "string" ? JSON.parse(valor || "[]") : valor;
    return Array.isArray(v) ? (v as EntregaRevisao[]) : [];
  } catch {
    return [];
  }
}
