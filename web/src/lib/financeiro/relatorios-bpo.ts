// Lote 03 (29/10/2026), correções 14 e 18 — indicadores dos Relatórios.
// Mesmo arquivo em Prospecta/shared/financeiro/relatorios-indicadores.ts
// (só muda o caminho do import de `centavosDe`). Funções puras: as consultas
// ficam em cada sistema e entregam aqui os registros já lidos do banco.
//
// Regras (iguais nos dois sistemas):
// - Período: datas comparadas como "AAAA-MM-DD", inclusive nas duas pontas.
// - Obra elegível (14 e 18.1): não cancelada (nem distrato, onde existe), com
//   VGV simulado > 0. A data que define o período é a data de início da obra;
//   sem início, a data de criação. Cada obra conta uma única vez (por id).
// - VGV simulado: obra com lead usa o VGV simulado do lead (Prospecta:
//   leads.simulation_value; Santa Fé: Lead.orcamento); sem lead, o VGV da obra.
// - Entrada: regra do financeiro da obra — VGV − financiamento − FGTS − subsídio,
//   só quando os quatro estão preenchidos; obra sem esses dados fica fora da
//   soma da entrada (e é contada em `obrasSemEntrada`).
// - Funil (18.2): leads ativos do CRM (sem excluídos/arquivados), criados no
//   período; etapa resolvida pela regra do CRM; sem etapa válida →
//   "Aguardando classificação".
// - Ranking (18.3): valor efetivamente pago, por data de pagamento — pagamentos
//   confirmados de categoria "comissão" das obras (atribuídos ao corretor do lead
//   da obra) + comissões cadastradas com status "paga". Uma comissão cadastrada
//   para uma obra que já tem pagamentos de comissão é ignorada (evita contar duas
//   vezes o mesmo pagamento). Ordena antes de limitar.
// - Unidades (18.4): retrato atual (sem período). Unidade de incorporação
//   excluída (tombstone) fica fora. No catálogo, só imóveis aprovados na revisão
//   e que não sejam o ponto de localização de uma obra. Não existe vínculo entre
//   imóvel do catálogo e unidade de incorporação nos dois sistemas, então não há
//   como a mesma unidade aparecer nos dois grupos; se o vínculo vier a existir,
//   o imóvel vinculado deve contar só na incorporação (`vinculadoAUnidade`).

import { centavosDe } from "./obra";

export type Periodo = { de: string; ate: string };

/** "AAAA-MM-DD" de uma data (UTC) ou de um texto já nesse formato. */
export function chaveData(d: Date | string | null | undefined): string | null {
  if (d === null || d === undefined) return null;
  if (typeof d === "string") return /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : null;
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function noPeriodo(d: Date | string | null | undefined, p: Periodo): boolean {
  const k = chaveData(d);
  return k !== null && k >= p.de && k <= p.ate;
}

const reais = (centavos: number) => centavos / 100;

// ---------------------------------------------------------------- 14 / 18.1

export const STATUS_OBRA_FORA_DOS_RELATORIOS = ["cancelled", "cancelada", "cancelado", "distrato"] as const;

export type ObraRelatorio = {
  id: string | number;
  status: string;
  dataInicio: Date | string | null;
  criadoEm: Date | string;
  leadId: string | number | null;
  /** VGV simulado do lead (só usado quando há lead). */
  vgvLead: string | number | null;
  vgv: string | number | null;
  financiamento: string | number | null;
  fgts: string | number | null;
  subsidio: string | number | null;
};

export type IndicadoresObras = {
  vgvTotal: number;
  obrasElegiveis: number;
  /** null quando não há obra elegível (tela mostra "—"). */
  ticketMedio: number | null;
  financiadoTotal: number;
  subsidioTotal: number;
  entradaTotal: number;
  obrasSemEntrada: number;
};

export function vgvSimuladoCentavos(o: Pick<ObraRelatorio, "leadId" | "vgvLead" | "vgv">): number | null {
  return centavosDe(o.leadId !== null && o.leadId !== undefined ? o.vgvLead : o.vgv);
}

export function obraElegivel(o: ObraRelatorio, p: Periodo): boolean {
  if ((STATUS_OBRA_FORA_DOS_RELATORIOS as readonly string[]).includes(o.status)) return false;
  const vgv = vgvSimuladoCentavos(o);
  if (vgv === null || vgv <= 0) return false;
  return noPeriodo(o.dataInicio ?? o.criadoEm, p);
}

export function indicadoresDeObras(obras: ObraRelatorio[], p: Periodo): IndicadoresObras {
  const unicas = new Map<string, ObraRelatorio>();
  for (const o of obras) if (obraElegivel(o, p)) unicas.set(String(o.id), o);
  let vgv = 0, financiado = 0, subsidio = 0, entrada = 0, semEntrada = 0;
  for (const o of Array.from(unicas.values())) {
    const v = vgvSimuladoCentavos(o)!;
    const fin = centavosDe(o.financiamento);
    const fgts = centavosDe(o.fgts);
    const sub = centavosDe(o.subsidio);
    vgv += v;
    financiado += fin ?? 0;
    subsidio += sub ?? 0;
    if (fin === null || fgts === null || sub === null) semEntrada++;
    else entrada += v - fin - fgts - sub;
  }
  const n = unicas.size;
  return {
    vgvTotal: reais(vgv),
    obrasElegiveis: n,
    ticketMedio: n > 0 ? reais(Math.round(vgv / n)) : null,
    financiadoTotal: reais(financiado),
    subsidioTotal: reais(subsidio),
    entradaTotal: reais(entrada),
    obrasSemEntrada: semEntrada,
  };
}

export const NOTA_NUMEROS_DE_OBRA = "Comparação entre métricas; as fatias não somam um total.";
export const AJUDA_VGV_DE_OBRAS =
  "Soma do VGV simulado das obras não canceladas com VGV maior que zero. O período considera a data de início da obra ou, quando não houver início, a data de criação. Ticket médio = VGV total ÷ número de obras.";

/** Fatias do gráfico "Números de Obra" (valores ≥ 0 para o gráfico; o valor real fica em `valor`). */
export function numerosDeObra(i: IndicadoresObras): { chave: string; nome: string; valor: number; fatia: number }[] {
  return [
    { chave: "vgv", nome: "VGV total simulado", valor: i.vgvTotal },
    { chave: "financiado", nome: "Financiado total", valor: i.financiadoTotal },
    { chave: "subsidio", nome: "Subsídio total", valor: i.subsidioTotal },
    { chave: "entrada", nome: "Entrada total dos clientes", valor: i.entradaTotal },
  ].map((f) => ({ ...f, fatia: Math.max(0, f.valor) }));
}

// ---------------------------------------------------------------------- 18.2

export const ETAPA_SEM_CLASSIFICACAO = { key: "__sem_etapa__", label: "Aguardando classificação" } as const;

export type EtapaFunil = { key: string; label: string; n: number; pct: number };

/**
 * `etapas`: etapas do CRM na ordem do pipeline. `leads`: etapa já resolvida pela
 * regra do CRM (null = sem etapa válida). Etapas zeradas aparecem; a linha
 * "Aguardando classificação" só aparece quando há leads nela.
 */
export function funilDeLeads(
  etapas: readonly { key: string; label: string }[],
  leads: { etapa: string | null }[],
): { etapas: EtapaFunil[]; total: number } {
  const contagem = new Map<string, number>();
  const chaves = new Set(etapas.map((e) => e.key));
  for (const l of leads) {
    const k = l.etapa && chaves.has(l.etapa) ? l.etapa : ETAPA_SEM_CLASSIFICACAO.key;
    contagem.set(k, (contagem.get(k) ?? 0) + 1);
  }
  const total = leads.length;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const linhas = etapas.map((e) => ({ key: e.key, label: e.label, n: contagem.get(e.key) ?? 0, pct: pct(contagem.get(e.key) ?? 0) }));
  const sem = contagem.get(ETAPA_SEM_CLASSIFICACAO.key) ?? 0;
  if (sem > 0) linhas.push({ ...ETAPA_SEM_CLASSIFICACAO, n: sem, pct: pct(sem) });
  return { etapas: linhas, total };
}

// ---------------------------------------------------------------------- 18.3

export const CORRETOR_NAO_VINCULADO = "Sem corretor vinculado";
export const MENSAGEM_RANKING_VAZIO = "Nenhuma comissão paga no período";

export type PagamentoComissaoObra = {
  obraId: string | number;
  corretorId: string | number | null;
  corretor: string | null;
  valor: string | number;
  data: Date | string;
};

export type ComissaoCadastrada = {
  /** Obra do negócio, quando a comissão é de obra. */
  obraId: string | number | null;
  corretorId: string | number | null;
  corretor: string | null;
  valor: string | number;
  status: string;
  pagoEm: Date | string | null;
};

export type LinhaRanking = { nome: string; totalPago: number; pagamentos: number };

export function rankingDeCorretores(
  pagamentosObra: PagamentoComissaoObra[],
  comissoes: ComissaoCadastrada[],
  p: Periodo,
  limite = 5,
): LinhaRanking[] {
  const obrasComPagamento = new Set(pagamentosObra.map((m) => String(m.obraId)));
  const mapa = new Map<string, { nome: string; centavos: number; pagamentos: number }>();
  const somar = (corretorId: string | number | null, nome: string | null, valor: string | number) => {
    const c = centavosDe(valor);
    if (c === null) return;
    const chave = corretorId !== null && corretorId !== undefined ? `id:${corretorId}` : `nome:${nome ?? ""}`;
    const atual = mapa.get(chave) ?? { nome: nome?.trim() || CORRETOR_NAO_VINCULADO, centavos: 0, pagamentos: 0 };
    atual.centavos += c;
    atual.pagamentos += 1;
    mapa.set(chave, atual);
  };
  for (const m of pagamentosObra) if (noPeriodo(m.data, p)) somar(m.corretorId, m.corretor, m.valor);
  for (const c of comissoes) {
    if (c.status !== "paga" || !noPeriodo(c.pagoEm, p)) continue;
    if (c.obraId !== null && c.obraId !== undefined && obrasComPagamento.has(String(c.obraId))) continue;
    somar(c.corretorId, c.corretor, c.valor);
  }
  return Array.from(mapa.values())
    .filter((l) => l.centavos > 0)
    .sort((a, b) => b.centavos - a.centavos || a.nome.localeCompare(b.nome, "pt-BR"))
    .slice(0, limite)
    .map((l) => ({ nome: l.nome, totalPago: reais(l.centavos), pagamentos: l.pagamentos }));
}

// ---------------------------------------------------------------------- 18.4

export type SituacaoUnidade = "disponivel" | "reservado" | "vendido";

/** Incorporação: disponivel / reservada / vendida (varchar). Outro valor = não classificado. */
export function situacaoUnidadeIncorporacao(status: string): SituacaoUnidade | null {
  const s = status.trim().toLowerCase();
  if (s === "disponivel") return "disponivel";
  if (s === "reservada" || s === "reservado") return "reservado";
  if (s === "vendida" || s === "vendido") return "vendido";
  return null;
}

/**
 * Catálogo. Prospecta: disponivel / reservado / vendido / alugado.
 * Santa Fé: venda, lancamento, locacao (disponível) / vendido, locado (vendido).
 */
export function situacaoImovelCatalogo(status: string): SituacaoUnidade | null {
  const s = status.trim().toLowerCase();
  if (["disponivel", "venda", "lancamento", "locacao"].includes(s)) return "disponivel";
  if (s === "reservado") return "reservado";
  if (["vendido", "alugado", "locado"].includes(s)) return "vendido";
  return null;
}

export type BarraUnidades = {
  chave: string;
  nome: string;
  total: number;
  disponiveis: number;
  reservados: number;
  vendidos: number;
};

export function unidadesDisponiveis(
  incorporacao: { status: string; excluida: boolean }[],
  catalogo: { status: string; aprovado: boolean; pontoDeObra: boolean; vinculadoAUnidade?: boolean }[],
): { barras: BarraUnidades[]; naoClassificadas: number } {
  let naoClassificadas = 0;
  const contar = (situacoes: (SituacaoUnidade | null)[]) => {
    const r = { disponivel: 0, reservado: 0, vendido: 0 };
    for (const s of situacoes) if (s) r[s]++; else naoClassificadas++;
    return r;
  };
  const inc = contar(incorporacao.filter((u) => !u.excluida).map((u) => situacaoUnidadeIncorporacao(u.status)));
  const cat = contar(
    catalogo.filter((i) => i.aprovado && !i.pontoDeObra && !i.vinculadoAUnidade).map((i) => situacaoImovelCatalogo(i.status)),
  );
  const barra = (chave: string, nome: string, disponiveis: number, reservados: number, vendidos: number): BarraUnidades =>
    ({ chave, nome, total: disponiveis + reservados + vendidos, disponiveis, reservados, vendidos });
  return {
    barras: [
      barra("incorporacao_disponiveis", "Incorporação — disponíveis", inc.disponivel, 0, 0),
      barra("incorporacao_ocupadas", "Incorporação — reservados + vendidos", 0, inc.reservado, inc.vendido),
      barra("catalogo_disponiveis", "Catálogo — disponíveis", cat.disponivel, 0, 0),
      barra("catalogo_ocupados", "Catálogo — reservados + vendidos", 0, cat.reservado, cat.vendido),
    ],
    naoClassificadas,
  };
}
