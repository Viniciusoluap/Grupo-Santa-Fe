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
] as const;

export type ModuloServico = "financiamento" | "obra" | "projeto" | "regularizacao" | "avaliacao";

export const MODULO_CONFIG: Record<ModuloServico, { label: string; rota: string; novo: string }> = {
  financiamento: { label: "Financiamento", rota: "/admin/financiamentos", novo: "/admin/financiamentos/novo" },
  obra: { label: "Obra / Reforma", rota: "/admin/obras", novo: "/admin/obras/novo" },
  projeto: { label: "Projeto", rota: "/admin/projetos", novo: "/admin/projetos/novo" },
  regularizacao: { label: "Regularização", rota: "/admin/regularizacao", novo: "/admin/regularizacao/novo" },
  avaliacao: { label: "Avaliação", rota: "/admin/avaliacoes", novo: "/admin/avaliacoes/nova" },
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

export interface RegistrosExistentesDoLead {
  /** Tipos (qualquer grafia) dos financiamentos já vinculados ao lead. */
  financiamentoTipos: string[];
  obras: number;
  projetos: number;
  regularizacoes: number;
  avaliacoes: number;
}

/**
 * Quais serviços do lead ainda NÃO têm registro operacional vinculado.
 * Idempotente: chamar de novo depois de criar os registros devolve lista vazia,
 * então pode rodar tanto no cadastro quanto em toda edição do lead.
 */
export function servicosSemRegistro(
  servicos: string[],
  existentes: RegistrosExistentesDoLead,
): ServicoOperacional[] {
  const tiposFin = new Set(existentes.financiamentoTipos.map(normalizarTipoFinanciamento));
  const contagem: Record<Exclude<ModuloServico, "financiamento">, number> = {
    obra: existentes.obras,
    projeto: existentes.projetos,
    regularizacao: existentes.regularizacoes,
    avaliacao: existentes.avaliacoes,
  };
  const vistos = new Set<string>();
  const pendentes: ServicoOperacional[] = [];

  for (const servico of servicos) {
    const op = moduloDoServico(servico);
    if (!op) continue;
    const chave = op.modulo === "financiamento" ? `fin:${op.tipoFinanciamento}` : op.modulo;
    if (vistos.has(chave)) continue;
    vistos.add(chave);

    if (op.modulo === "financiamento") {
      if (!tiposFin.has(op.tipoFinanciamento!)) pendentes.push(op);
    } else if (contagem[op.modulo] === 0) {
      pendentes.push(op);
    }
  }
  return pendentes;
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
      return normalizarTipoFinanciamento(tipoFinanciamento ?? "") === "mcmv" ? "Financiamento MCMV" : "Financiamento Convencional";
    case "obra":
      return "Obra e reforma";
    case "projeto":
      return "Projeto de engenharia";
    case "regularizacao":
      return "Regularização imobiliária";
    case "avaliacao":
      return "Avaliação de imóvel";
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
