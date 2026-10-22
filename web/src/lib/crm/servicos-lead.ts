// Regras puras (sem banco) do vínculo real Lead (CRM) ↔ serviços operacionais.
// EPIC-007: o lead é a fonte única dos dados do cliente. Ao vincular um lead a
// um serviço, o registro operacional é criado/populado com os dados do lead —
// o profissional nunca recadastra nome/telefone/e-mail que o CRM já tem.

/** Serviços oferecidos no cadastro de lead (mesma lista do site/contato). */
export const SERVICOS_LEAD = [
  "Compra de imóvel",
  "Financiamento MCMV",
  "Financiamento Convencional",
  "Venda de imóvel",
  "Locação",
  "Obra e reforma",
  "Projeto de engenharia",
  "Regularização imobiliária",
  "Avaliação de imóvel",
  "Compra de lote",
  "Outro",
  "Tarefas e Agenda",
] as const;

export type ModuloServico = "financiamento" | "obra" | "projeto" | "regularizacao" | "avaliacao" | "tarefa";

export const MODULO_CONFIG: Record<ModuloServico, { label: string; rota: string }> = {
  financiamento: { label: "Financiamento", rota: "/admin/financiamentos" },
  obra: { label: "Obra / Reforma", rota: "/admin/obras" },
  projeto: { label: "Projeto", rota: "/admin/projetos" },
  regularizacao: { label: "Regularização", rota: "/admin/regularizacao" },
  avaliacao: { label: "Avaliação", rota: "/admin/avaliacoes" },
  tarefa: { label: "Tarefa", rota: "/admin/agenda" },
};

export interface ServicoOperacional {
  modulo: ModuloServico;
  servico: string;
  /** Só para financiamento: chave de TIPO_CONFIG (src/lib/types/financiamento.ts). */
  tipoFinanciamento?: "mcmv" | "sbpe";
}

const MAPA: Record<string, Omit<ServicoOperacional, "servico">> = {
  "Financiamento MCMV": { modulo: "financiamento", tipoFinanciamento: "mcmv" },
  "Financiamento Convencional": { modulo: "financiamento", tipoFinanciamento: "sbpe" },
  "Obra e reforma": { modulo: "obra" },
  "Projeto de engenharia": { modulo: "projeto" },
  "Regularização imobiliária": { modulo: "regularizacao" },
  "Avaliação de imóvel": { modulo: "avaliacao" },
  "Tarefas e Agenda": { modulo: "tarefa" },
};

/** Serviço de lead → módulo operacional. `null` = serviço só de CRM (compra, venda, locação...). */
export function moduloDoServico(servico: string): ServicoOperacional | null {
  const m = MAPA[servico];
  return m ? { servico, ...m } : null;
}

/** `Lead.servico` é um JSON de string[] (legado: string simples). */
export function parseServicosLead(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v.filter((s): s is string => typeof s === "string" && s.trim() !== "");
    if (typeof v === "string" && v.trim()) return [v];
  } catch {
    if (raw.trim()) return [raw];
  }
  return [];
}

/**
 * Registros antigos criados automaticamente gravavam o tipo como "MCMV" /
 * "Convencional" (fora das chaves de TIPO_CONFIG). Normaliza para comparar.
 */
export function normalizarTipoFinanciamento(tipo: string): string {
  const t = tipo.trim().toLowerCase();
  if (t === "mcmv") return "mcmv";
  if (t === "convencional") return "sbpe";
  return t;
}

export interface LeadDadosCliente {
  nome: string;
  telefone: string;
  email: string | null;
}

/** Dados do cliente copiados do lead para o registro operacional. */
export function dadosClienteDoLead(lead: LeadDadosCliente) {
  return {
    clienteNome: lead.nome.trim(),
    clienteTel: lead.telefone.trim(),
    clienteEmail: lead.email?.trim() || null,
  };
}

/** Número de protocolo da avaliação (mesmo formato usado em /admin/avaliacoes). */
export function gerarNumeroAvaliacao(agora: Date = new Date(), aleatorio: number = Math.random()): string {
  const sufixo = Math.floor(1000 + aleatorio * 9000);
  return `AVL-${agora.getFullYear()}${String(agora.getMonth() + 1).padStart(2, "0")}-${sufixo}`;
}

/** Módulo operacional → serviço correspondente no cadastro do lead. */
export function servicoDoModulo(modulo: ModuloServico, tipoFinanciamento?: string | null): string {
  switch (modulo) {
    case "financiamento":
      if (normalizarTipoFinanciamento(tipoFinanciamento ?? "") === "mcmv") return "Financiamento MCMV";
      if (normalizarTipoFinanciamento(tipoFinanciamento ?? "") === "sbpe") return "Financiamento Convencional";
      return `Financiamento (${tipoFinanciamento ?? "não informado"})`;
    case "obra":
      return "Obra e reforma";
    case "projeto":
      return "Projeto de engenharia";
    case "regularizacao":
      return "Regularização imobiliária";
    case "avaliacao":
      return "Avaliação de imóvel";
    case "tarefa":
      return "Tarefas e Agenda";
  }
}

/**
 * Inclui o serviço na lista do lead (sem duplicar). Mantém o quadro de serviços
 * e o funil coerentes quando o serviço é aberto a partir do módulo.
 * Retorna `null` quando nada muda.
 */
export function incluirServico(servicos: string[], servico: string): string[] | null {
  if (servicos.includes(servico)) return null;
  return [...servicos, servico];
}

/**
 * Falha na criação automática de registros (EPIC-007): o lead é salvo, mas o
 * usuário PRECISA saber quais serviços ficaram sem registro operacional. A
 * server action redireciona para o detalhe do lead com esses módulos na URL e
 * a página mostra o aviso.
 */
export const PARAM_FALHA_SERVICOS = "falhaServicos";

export function rotaDetalheLead(leadId: string, falhas: ModuloServico[] = []): string {
  const base = `/admin/leads/${leadId}`;
  if (falhas.length === 0) return base;
  return `${base}?${PARAM_FALHA_SERVICOS}=${encodeURIComponent(falhas.join(","))}`;
}

/** Lê o parâmetro de falhas aceitando só módulos conhecidos (sem duplicar). */
export function parseFalhasServicos(raw: string | string[] | null | undefined): ModuloServico[] {
  const texto = Array.isArray(raw) ? raw.join(",") : raw ?? "";
  const modulos: ModuloServico[] = [];
  for (const parte of texto.split(",")) {
    const m = parte.trim() as ModuloServico;
    if (Object.prototype.hasOwnProperty.call(MODULO_CONFIG, m) && !modulos.includes(m)) modulos.push(m);
  }
  return modulos;
}
