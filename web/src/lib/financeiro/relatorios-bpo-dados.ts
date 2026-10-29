import { prisma } from "@/lib/db";
import { etapaDoLead, leadNoPipelineAtivo } from "@/lib/crm/pipeline";
import { LEAD_STAGE_CONFIG, LEAD_STAGES } from "@/lib/types/crm";
import {
  chaveData, funilDeLeads, indicadoresDeObras, noPeriodo, numerosDeObra, rankingDeCorretores, unidadesDisponiveis,
  type Periodo,
} from "@/lib/financeiro/relatorios-bpo";

// Lote 03 — correções 14 e 18: consultas dos indicadores da aba Relatórios do BPO.
// Gêmeo do `overview` da Prospecta (server/relatorios-router.ts). As regras
// estão em ./relatorios-bpo.ts. Período: o mesmo da tela (do 1º dia do mês de
// 11 meses atrás até hoje), aplicado ao VGV de Obras, Números de Obra, Funil
// (data de criação do lead) e Ranking (data do pagamento). Unidades = retrato atual.

export function periodoUltimos12Meses(agora = new Date()): Periodo {
  const inicio = new Date(Date.UTC(agora.getFullYear(), agora.getMonth() - 11, 1));
  return { de: chaveData(inicio)!, ate: chaveData(agora)! };
}

/** Data "AAAA-MM-DD" válida (calendário real) ou null. */
function dataValida(v: string | undefined): string | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : null;
}

/**
 * Filtro De/Até da aba Relatórios (searchParams `relDe`/`relAte`, paridade com a
 * Prospecta). Ausente ou inválido → ponta padrão dos últimos 12 meses; De depois
 * de Até → as datas são trocadas.
 */
export function periodoDosParametros(relDe?: string, relAte?: string, agora = new Date()): Periodo & { personalizado: boolean } {
  const padrao = periodoUltimos12Meses(agora);
  const de = dataValida(relDe);
  const ate = dataValida(relAte);
  const p = { de: de ?? padrao.de, ate: ate ?? padrao.ate };
  return { ...(p.de > p.ate ? { de: p.ate, ate: p.de } : p), personalizado: de !== null || ate !== null };
}

export const ETAPAS_FUNIL_CRM =LEAD_STAGES.map((key) => ({ key, label: LEAD_STAGE_CONFIG[key].label }));

export async function carregarIndicadoresRelatorios(periodo: Periodo) {
  const [obras, leads, pagamentosObra, comissoes, unidadesIncorporacao, imoveis] = await Promise.all([
    prisma.obra.findMany({
      select: {
        id: true, status: true, dataInicio: true, criadoEm: true, leadId: true, vgv: true,
        financiamentoCef: true, fgts: true, subsidio: true,
        leadVinculado: { select: { orcamento: true } },
      },
    }),
    prisma.lead.findMany({
      where: { excluidoEm: null, arquivadoEm: null },
      select: { etapaOperacional: true, status: true, arquivadoEm: true, excluidoEm: true, criadoEm: true },
    }),
    prisma.obraMovimento.findMany({
      where: { natureza: "pagamento", categoria: "comissao", status: "confirmado" },
      select: {
        obraId: true, valor: true, data: true,
        obra: { select: { leadVinculado: { select: { corretor: { select: { id: true, nome: true } } } } } },
      },
    }),
    prisma.comissao.findMany({
      where: { beneficiario: "corretor" },
      select: { tipoNegocio: true, negocioId: true, corretorId: true, valor: true, status: true, pagamentoEm: true, corretor: { select: { nome: true } } },
    }),
    prisma.estudoUnidade.findMany({ select: { status: true, excluidoEm: true } }),
    prisma.imovel.findMany({ select: { status: true, revisaoStatus: true, obraLocalizacao: { select: { id: true } } } }),
  ]);

  const vgvObras = indicadoresDeObras(
    obras.map((o) => ({
      id: o.id, status: o.status, dataInicio: o.dataInicio, criadoEm: o.criadoEm, leadId: o.leadId,
      vgvLead: o.leadVinculado?.orcamento ?? null,
      vgv: o.vgv?.toString() ?? null,
      financiamento: o.financiamentoCef?.toString() ?? null,
      fgts: o.fgts?.toString() ?? null,
      subsidio: o.subsidio?.toString() ?? null,
    })),
    periodo,
  );
  const funilLeads = funilDeLeads(
    ETAPAS_FUNIL_CRM,
    leads.filter((l) => leadNoPipelineAtivo(l) && noPeriodo(l.criadoEm, periodo)).map((l) => ({ etapa: etapaDoLead(l) })),
  );
  const corretorRanking = rankingDeCorretores(
    pagamentosObra.map((m) => {
      const c = m.obra.leadVinculado?.corretor ?? null;
      return { obraId: m.obraId, corretorId: c?.id ?? null, corretor: c?.nome ?? null, valor: m.valor.toString(), data: m.data };
    }),
    comissoes.map((c) => ({
      obraId: c.tipoNegocio === "obra" ? c.negocioId : null,
      corretorId: c.corretorId, corretor: c.corretor?.nome ?? null, valor: c.valor, status: c.status, pagoEm: c.pagamentoEm,
    })),
    periodo,
  );
  const unidades = unidadesDisponiveis(
    unidadesIncorporacao.map((u) => ({ status: u.status, excluida: u.excluidoEm !== null })),
    imoveis.map((i) => ({ status: i.status, aprovado: i.revisaoStatus === "aprovado", pontoDeObra: i.obraLocalizacao !== null })),
  );

  return { periodo, vgvObras, numerosDeObra: numerosDeObra(vgvObras), funilLeads, corretorRanking, unidadesDisponiveis: unidades };
}

export type IndicadoresRelatorios = Awaited<ReturnType<typeof carregarIndicadoresRelatorios>>;
