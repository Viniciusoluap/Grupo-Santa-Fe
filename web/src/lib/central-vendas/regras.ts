// Central de Vendas — paridade com a Prospecta (13/11/2026; gêmeo de Prospecta/shared/central-vendas/regras.ts).
// Regras puras (sem banco), usadas pelo servidor e cobertas por testes.
import { chaveTelefone } from "@/lib/whatsapp/conversas";

// ── Horário (America/Fortaleza: UTC-3 o ano todo, sem horário de verão) ──
const OFFSET_MIN = -3 * 60;
const MIN_DIA = 24 * 60;

export function partesFortaleza(d: Date) {
  const local = new Date(d.getTime() + OFFSET_MIN * 60_000);
  return {
    diaSemana: local.getUTCDay(),
    minutos: local.getUTCHours() * 60 + local.getUTCMinutes(),
    data: local.toISOString().slice(0, 10),
    mes: local.toISOString().slice(0, 7),
  };
}

export const minutosDe = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Início (UTC) do dia local de `d` mais `minutos`. */
function momentoLocal(d: Date, minutos: number, somarDias = 0): Date {
  const { data } = partesFortaleza(d);
  const meiaNoiteUtc = Date.parse(`${data}T00:00:00Z`) - OFFSET_MIN * 60_000;
  return new Date(meiaNoiteUtc + (somarDias * MIN_DIA + minutos) * 60_000);
}

export const inicioDoDiaFortaleza = (d: Date) => momentoLocal(d, 0);

export function dentroDaJanela(agora: Date, janela: { inicio: string; fim: string }): boolean {
  const m = partesFortaleza(agora).minutos;
  return m >= minutosDe(janela.inicio) && m < minutosDe(janela.fim);
}

/** Próximo momento em que a janela abre (hoje, se ainda não abriu; senão amanhã). */
export function proximaAberturaJanela(agora: Date, janela: { inicio: string; fim: string }): Date {
  const ini = minutosDe(janela.inicio);
  return partesFortaleza(agora).minutos < ini ? momentoLocal(agora, ini) : momentoLocal(agora, ini, 1);
}

export type HorarioAtendimento = { dias: number[]; inicio: string; fim: string };

export function emHorarioDeAtendimento(agora: Date, h: HorarioAtendimento): boolean {
  const p = partesFortaleza(agora);
  return h.dias.includes(p.diaSemana) && p.minutos >= minutosDe(h.inicio) && p.minutos < minutosDe(h.fim);
}

/** Minutos de horário de atendimento entre dois instantes (o SLA só corre em horário comercial). */
export function minutosUteisEntre(inicio: Date, fim: Date, h: HorarioAtendimento): number {
  if (fim <= inicio) return 0;
  const ini = minutosDe(h.inicio), fimDia = minutosDe(h.fim);
  let total = 0;
  for (let dia = 0; dia < 400; dia++) {
    const abre = momentoLocal(inicio, ini, dia), fecha = momentoLocal(inicio, fimDia, dia);
    if (abre > fim) break;
    if (!h.dias.includes(partesFortaleza(abre).diaSemana)) continue;
    const a = Math.max(abre.getTime(), inicio.getTime()), b = Math.min(fecha.getTime(), fim.getTime());
    if (b > a) total += (b - a) / 60_000;
  }
  return Math.floor(total);
}

// ── Captação ──

/** Código de campanha da primeira mensagem: "Olá! [ref:instagram-colina-park]" → "instagram-colina-park". */
export function extrairRef(texto: string | null | undefined): string | null {
  const m = /\[\s*ref\s*:\s*([a-z0-9][a-z0-9_-]{0,79})\s*\]/i.exec(texto ?? "");
  return m ? m[1].toLowerCase() : null;
}

export function slug(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

/** Origem a partir do código: campanha cadastrada vence; senão "canal-empreendimento" pelo slug do produto. */
export function origemDoRef(
  ref: string | null,
  campanhas: { codigo: string; canal: string; produtoId: number | null }[],
  produtos: { id: number; slug: string }[],
): { canal: string | null; campanha: string | null; produtoId: number | null } {
  if (!ref) return { canal: null, campanha: null, produtoId: null };
  const c = campanhas.find(x => x.codigo === ref);
  if (c) return { canal: c.canal, campanha: c.codigo, produtoId: c.produtoId };
  const produto = [...produtos].sort((a, b) => b.slug.length - a.slug.length).find(p => ref === p.slug || ref.endsWith(`-${p.slug}`));
  const canal = produto && ref !== produto.slug ? ref.slice(0, ref.length - produto.slug.length - 1) : produto ? null : ref.split("-")[0];
  return { canal: canal || null, campanha: ref, produtoId: produto?.id ?? null };
}

/** Link wa.me com o texto pré-preenchido da campanha. */
export function linkCampanha(numero: string, codigo: string, saudacao = "Olá!"): string {
  let d = numero.replace(/\D/g, "");
  if (d && !d.startsWith("55")) d = `55${d}`;
  return `https://wa.me/${d}?text=${encodeURIComponent(`${saudacao} [ref:${codigo}]`)}`;
}

export const numeroAutorizado = (numero: string, lista: string[]) => {
  const k = chaveTelefone(numero);
  return Boolean(k) && lista.some(n => chaveTelefone(n) === k);
};

const semAcento = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Opt-out: o cliente responde só "SAIR" ou "PARAR" (com ou sem pontuação). */
export function ehOptOut(texto: string | null | undefined): boolean {
  return /^(sair|parar)[\s.!]*$/.test(semAcento((texto ?? "").trim()));
}

// ── Distribuição ──

/** Rodízio: o próximo depois do último atribuído (ordem por id); `excluir` pula o atual (reatribuição). */
export function proximoOperador(operadores: string[], ultimo: string | null, excluir?: string | null): string | null {
  const lista = Array.from(new Set(operadores)).sort().filter(id => id !== excluir);
  if (!lista.length) return null;
  if (ultimo == null) return lista[0];
  return lista.find(id => id > ultimo) ?? lista[0];
}

// ── Transferência para humano ──

export type MotivoTransferencia =
  | "pedido_cliente" | "reclamacao" | "juridico" | "negociacao_valor" | "baixa_confianca" | "sem_progresso"
  | "resposta_bloqueada" | "limite_tokens" | "ia_indisponivel" | "ia_desligada" | "reprovado" | "modelo";

export const ROTULOS_MOTIVO: Record<MotivoTransferencia, string> = {
  pedido_cliente: "Cliente pediu atendente", reclamacao: "Reclamação", juridico: "Questão jurídica",
  negociacao_valor: "Negociação de valor", baixa_confianca: "Baixa confiança da IA", sem_progresso: "3 mensagens sem progresso",
  resposta_bloqueada: "Resposta da IA bloqueada pelas regras", limite_tokens: "Limite mensal de tokens atingido",
  ia_indisponivel: "IA indisponível", ia_desligada: "IA desligada", reprovado: "Análise reprovada", modelo: "IA pediu transferência",
};

const GATILHOS: [Exclude<MotivoTransferencia, "baixa_confianca" | "sem_progresso" | "resposta_bloqueada" | "limite_tokens" | "ia_indisponivel" | "ia_desligada" | "reprovado" | "modelo">, RegExp][] = [
  ["juridico", /\b(advogad\w*|juridic\w*|processar|processo judicial|acao judicial|na justica|procon|danos morais|rescis\w*|liminar)\b/],
  ["reclamacao", /\b(reclama\w*|absurdo|pessimo|horrivel|insatisfeit\w*|descaso|enganad\w*|vergonha|nao resolve\w*)\b/],
  ["negociacao_valor", /\b(desconto|negociar|negociacao|abaixar|baixar o (valor|preco)|valor menor|preco menor|contraproposta|fazer por menos|faz por quanto|melhor preco)\b/],
  ["pedido_cliente", /\b(atendente|humano|pessoa de verdade|falar com (alguem|uma pessoa|o corretor|um corretor|o gerente|voces)|corretor|consultor|me liga|ligacao)\b/],
];

/** Gatilho detectado no texto do cliente (por código, independente da IA). */
export function gatilhoNoTexto(texto: string): MotivoTransferencia | null {
  const t = semAcento(texto);
  for (const [motivo, re] of GATILHOS) if (re.test(t)) return motivo;
  return null;
}

export function motivoTransferencia(p: { textoCliente: string; confianca: number; limiar: number; semProgresso: number; pedidoModelo?: boolean }): MotivoTransferencia | null {
  return gatilhoNoTexto(p.textoCliente)
    ?? (p.pedidoModelo ? "modelo" : null)
    ?? (p.confianca < p.limiar ? "baixa_confianca" : null)
    ?? (p.semProgresso >= 3 ? "sem_progresso" : null);
}

// ── Regras proibidas da IA (verificadas na saída, sempre) ──

const PROMESSA_APROVACAO = [
  /\b(seu|o|sua|a) (financiamento|credito|cadastro|analise|proposta) (ja )?(esta|foi|sera|vai ser|vai sair|sai) (aprovad|liberad|garantid)/,
  /\b(voce|vc) (ja )?(esta|foi|sera|vai ser|e) (aprovad|pre-?aprovad)/,
  /\bgarant\w* (a |sua |seu |o )?(aprovacao|credito|financiamento|liberacao)/,
  /\b(aprovacao|credito|financiamento) (garantid|cert[oa]|assegurad)/,
  /\bpre-?aprovad\w*/,
  /\bcom certeza (vai|sera|e|voce) (ser )?(aprovad|liberad)/,
  /\b(esta|ta) aprovad[oa]\b/,
];
const VALORES = /(r\$\s?\d[\d.,]*(\s?mil\b)?|\d[\d.,]*\s?%|\d[\d.,]*\s?mil\b|\d[\d.,]*\s?reais\b)/g;

/** "1.234,56" | "650,00" | "8,5" | "1234.56" | "180" (+ "mil") → número canônico em texto (null se não for número). */
export function valorCanonico(token: string): string | null {
  const mil = /\bmil\b/.test(token);
  let t = (/\d[\d.,]*/.exec(token)?.[0] ?? "").replace(/[.,]+$/, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t);
  return Number.isFinite(n) ? String(mil ? Math.round(n * 1000 * 100) / 100 : n) : null;
}

/** Números que aparecem na base cadastrada (forma canônica): os únicos que a IA pode citar. */
export function numerosPermitidos(base: string): Set<string> {
  const out = new Set<string>();
  for (const m of Array.from(semAcento(base).matchAll(/\d[\d.,]*(\s?mil\b)?/g))) {
    const v = valorCanonico(m[0]);
    if (v) out.add(v);
  }
  return out;
}

export type Violacao = "promessa_aprovacao" | "condicao_nao_cadastrada" | "decisao_financeira";

/**
 * A IA nunca promete aprovação, nunca cita taxa/parcela/valor fora do cadastro e nunca decide nada financeiro.
 * `base` = textos cadastrados (produtos, condições, preços). Devolve as violações (vazio = pode enviar).
 */
export function violacoesResposta(resposta: string, base: string): Violacao[] {
  const t = semAcento(resposta);
  const v = new Set<Violacao>();
  if (PROMESSA_APROVACAO.some(re => re.test(t))) v.add("promessa_aprovacao");
  if (/\b(reprovad[oa]|negad[oa]|recusad[oa])\b/.test(t) && /\b(voce|seu|sua|vc)\b/.test(t)) v.add("decisao_financeira");
  const permitidos = numerosPermitidos(base);
  const fora = (token: string) => { const c = valorCanonico(token); return c !== null && !permitidos.has(c); };
  if (Array.from(t.matchAll(VALORES)).some(m => fora(m[0]))) v.add("condicao_nao_cadastrada");
  // Termo de condição comercial com número por perto ("taxa de 8", "em 60 parcelas") também precisa estar no cadastro.
  const perto = [
    ...Array.from(t.matchAll(/\b(?:taxa|juros|parcela\w*|entrada|prestac\w*|subsidio|cet)\D{0,25}?(\d[\d.,]*(\s?mil\b)?)/g)).map(m => m[1]),
    ...Array.from(t.matchAll(/(\d[\d.,]*)\s*(?:x|vezes|parcelas?|prestacoes|meses)\b/g)).map(m => m[1]),
  ];
  if (perto.some(fora)) v.add("condicao_nao_cadastrada");
  return Array.from(v);
}

// ── Documentos ──

export type ItemChecklistLite = { chave: string; nome: string; tipo: string; obrigatorio: boolean };

/** Itens obrigatórios ainda sem documento recebido. */
export function pendentesDoChecklist(itens: ItemChecklistLite[], recebidas: Iterable<string | null>): ItemChecklistLite[] {
  const ok = new Set(Array.from(recebidas).filter(Boolean) as string[]);
  return itens.filter(i => i.obrigatorio && !ok.has(i.chave));
}

const SINONIMOS: [string[], RegExp][] = [
  [["cnh", "rg"], /\b(cnh|carteira de motorista|habilitacao)\b/],
  [["rg", "cnh"], /\b(rg|identidade|carteira de identidade|cin)\b/],
  [["address_proof"], /\b(comprovante de (residencia|endereco)|conta de (luz|agua|energia)|fatura de (luz|agua|energia))\b/],
  [["income_proof_irpf", "income_proof_formal"], /\b(irpf|imposto de renda|declaracao de (ir|imposto))\b/],
  [["income_proof_formal", "spouse_income_proof"], /\b(holerite|contracheque|contra cheque|comprovante de renda|extrato bancario|carteira de trabalho|ctps)\b/],
  [["fgts"], /\b(fgts|extrato do fgts)\b/],
  [["birth_marriage_certificate"], /\b(certidao de (nascimento|casamento)|certidao)\b/],
  [["pis"], /\b(pis|nis|pasep)\b/],
];

/**
 * Classificação sem IA (nome do arquivo e legenda): item do checklist cujo nome aparece no texto, ou cujo
 * tipo bate com um sinônimo conhecido. Só metadados — o arquivo em si nunca sai do sistema.
 */
export function classificarPorNome(texto: string, itens: ItemChecklistLite[]): { chave: string; confianca: number } | null {
  const t = semAcento(texto).replace(/[_.-]+/g, " ");
  const porNome = itens.find(i => t.includes(semAcento(i.nome)) || new RegExp(`\\b${semAcento(i.chave).replace(/[_-]+/g, " ")}\\b`).test(t));
  if (porNome) return { chave: porNome.chave, confianca: 0.9 };
  for (const [tipos, re] of SINONIMOS) {
    if (!re.test(t)) continue;
    for (const tipo of tipos) {
      const item = itens.find(i => i.tipo === tipo);
      if (item) return { chave: item.chave, confianca: 0.8 };
    }
  }
  return null;
}

// ── Fila ──

export const MAX_TENTATIVAS = 5;
/** Espera antes da tentativa n (1, 2, 4, 8... minutos, no máximo 2 h). */
export const backoffMinutos = (tentativas: number) => Math.min(120, 2 ** Math.max(0, tentativas - 1));

export type BloqueioEnvio = "desligado" | "opt_out" | "modo_teste" | "fora_horario" | "limite_diario";

/** Proteções de envio: opt-out, modo de teste, janela 8h–20h (proativas) e limite diário por número. */
export function bloqueioEnvio(p: {
  ativo: boolean; optOut: boolean; ignorarOptOut?: boolean; modoTeste: boolean; numerosTeste: string[]; numero: string;
  proativa: boolean; agora: Date; janela: { inicio: string; fim: string }; enviadosHoje: number; limiteDiario: number;
}): BloqueioEnvio | null {
  if (!p.ativo) return "desligado";
  if (p.optOut && !p.ignorarOptOut) return "opt_out";
  if (p.modoTeste && !numeroAutorizado(p.numero, p.numerosTeste)) return "modo_teste";
  if (p.proativa && !dentroDaJanela(p.agora, p.janela)) return "fora_horario";
  if (p.enviadosHoje >= p.limiteDiario) return "limite_diario";
  return null;
}

/** Texto do template com {{variáveis}}; variável sem valor some (nunca sai "{{...}}"). */
export function preencher(texto: string, valores: Record<string, string | null | undefined>): string {
  return texto.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (_m, v: string) => (valores[v.toLowerCase()] ?? "").trim())
    .replace(/[ \t]+([,.!?])/g, "$1").replace(/[ \t]{2,}/g, " ").trim();
}

/**
 * Mapeamento dos status para as etapas operacionais do CRM do Santa Fé (leads.etapaOperacional, lote 11/10):
 * só avança, nunca recua. Sem etapa operacional, vale a equivalência de etapaDoLead (status novo → novo_lead).
 */
const ORDEM_ETAPAS = ["novo_lead", "em_atendimento", "aprovado_follow_up", "projetos_vistorias", "contratos_cartorio", "medicoes", "finalizado"];
export function etapaAvancada(atual: string | null | undefined, alvo: "em_atendimento" | "aprovado_follow_up"): string | null {
  const i = ORDEM_ETAPAS.indexOf(atual ?? "novo_lead");
  const j = ORDEM_ETAPAS.indexOf(alvo);
  // Etapa legada/desconhecida: não mexe.
  if (i < 0) return null;
  return i < j ? alvo : null;
}
