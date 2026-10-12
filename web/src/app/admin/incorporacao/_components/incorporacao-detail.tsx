"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TerrenoTab } from "./terreno-tab";
import { TopografiaTab } from "./topografia-tab";
import { MercadoTab } from "./mercado-tab";
import { MassaTab } from "./massa-tab";
import { OrcamentoParametrizadoTab } from "./orcamento-parametrizado-tab";
import { ViabilidadeTab } from "./viabilidade-tab";
import { QuadroAreasTab } from "./quadro-areas-tab";
import { NegociacaoTerrenoTab } from "./negociacao-terreno-tab";
import { BusinessPlanTab } from "./business-plan-tab";
import { ProjetistasTab } from "./projetistas-tab";
import { AprovacaoProjetoTab } from "./aprovacao-projeto-tab";
import { RegistroIncorporacaoTab } from "./registro-incorporacao-tab";
import { OrcamentoPreliminarTab } from "./orcamento-preliminar-tab";
import { PlanejamentoLancamentoTab } from "./planejamento-lancamento-tab";
import { FornecedoresLancamentoTab } from "./fornecedores-lancamento-tab";
import { MaterialPublicitarioTab } from "./material-publicitario-tab";
import { LancamentoImobiliarioTab } from "./lancamento-imobiliario-tab";
import { ProjetosExecutivosTab } from "./projetos-executivos-tab";
import { OrcamentoObraTab } from "./orcamento-obra-tab";
import { CronogramaObraTab } from "./cronograma-obra-tab";
import { AtendimentoClientesTab } from "./atendimento-clientes-tab";
import { RelatorioTab } from "./relatorio-tab";
import { negociacaoFechadaDoJson } from "@/lib/incorporacao/negociacao";
import { businessPlanPreenchidoDoJson } from "@/lib/finance/captacao";
import { pesquisaPrimariaPreenchidaDoJson } from "@/lib/incorporacao/pesquisa-primaria";
import { projetistasCompatibilizadosDoJson } from "@/lib/incorporacao/projetistas";
import { projetoTotalmenteAprovadoDoJson } from "@/lib/incorporacao/aprovacao-projeto";
import { registroCompletoDoJson } from "@/lib/incorporacao/registro-incorporacao";
import { orcamentoPreliminarPreenchidoDoJson } from "@/lib/incorporacao/orcamento-preliminar";
import { planejamentoLancamentoCompletoDoJson } from "@/lib/incorporacao/planejamento-lancamento";
import { fornecedoresTodosContratadosDoJson } from "@/lib/incorporacao/fornecedores-lancamento";
import { materialPublicitarioAprovadoDoJson } from "@/lib/incorporacao/material-publicitario";
import { lancamentoImobiliarioComVendasDoJson } from "@/lib/incorporacao/lancamento-imobiliario";
import { projetosExecutivosTodosLiberadosDoJson } from "@/lib/incorporacao/projetos-executivos";
import { orcamentoObraPreenchidoDoJson } from "@/lib/incorporacao/orcamento-obra";
import { obraConcluidaDoJson } from "@/lib/incorporacao/cronograma-obra";
import { atendimentoTodosConcluidosDoJson } from "@/lib/incorporacao/atendimento-clientes";

export interface EstudoData {
  id: string;
  nome: string;
  municipio: string;
  estado: string;
  status: string;
  responsavel: string | null;
  versaoNumero?: number | null;
  colaboradores?: { id: string; nome: string }[];
  matriculaImovel?: string | null;
  carRegistro?: string | null;
  zoneamentoOficial?: string | null;
  zoneamentoFonte?: string | null;
  kmlUrl: string | null;
  geojson: string | null;
  areaM2: number;
  perimetroM: number;
  centroLat: number | null;
  centroLng: number | null;
  appAreaM2: number | null;
  appLarguraM: number | null;
  appOrigem: string | null;
  elevacaoJson: string | null;
  levantamentoUrl: string | null;
  parametrosJson: string | null;
  potencialJson: string | null;
  urbanismoParecer: string | null;
  pesquisaCidadeJson: string | null;
  estudoMercadoJson: string | null;
  precificacaoComparaveisJson: string | null;
  pesquisaPrimariaJson: string | null;
  quadroAreasJson: string | null;
  orcamentoParametrizadoJson: string | null;
  businessPlanJson: string | null;
  negociacaoTerrenoJson: string | null;
  projetistasJson: string | null;
  aprovacaoProjetoJson: string | null;
  registroIncorporacaoJson: string | null;
  orcamentoPreliminarJson: string | null;
  planejamentoLancamentoJson: string | null;
  fornecedoresLancamentoJson: string | null;
  materialPublicitarioJson: string | null;
  lancamentoImobiliarioJson: string | null;
  projetosExecutivosJson: string | null;
  orcamentoObraJson: string | null;
  cronogramaObraJson: string | null;
  atendimentoClientesJson: string | null;
  massaCenariosJson: string | null;
  cenarioEscolhidoId: string | null;
  mixJson: string | null;
  viabilidadeJson: string | null;
  parecerIa: string | null;
  loteamentoJson: string | null;
  relatorios: string;
}

// Estrutura fiel às 5 fases da metodologia Carolina Caribé (Incorporação na
// Prática), replicando a organização de pastas usada pelo Grupo Santa Fé
// (1. Planejamento → 2. Novos Negócios → 3. Incorporação e Produto →
// 4. Lançamento, Marketing e Vendas → 5. Projetos Executivos e Obras).
// As etapas com "componente" já funcionam; as demais ficam como placeholder
// ("Em breve") até serem construídas uma a uma, com a lógica correta.

interface Etapa {
  id: string;
  numero: string;
  titulo: string;
  componente?: React.ComponentType<{ estudo: EstudoData }>;
  descricao?: string; // usada apenas nas etapas "em breve"
  /**
   * Etapa concluída? Auto-computado a partir do que já está preenchido no
   * estudo — nunca exige checklist manual (regra: tudo automático). Etapas
   * "em breve" sem função ficam sempre como não concluídas.
   */
  concluida?: (estudo: EstudoData) => boolean;
}

interface Fase {
  id: string;
  numero: number;
  titulo: string;
  etapas: Etapa[];
}

const FASES: Fase[] = [
  {
    id: "planejamento",
    numero: 1,
    titulo: "Planejamento",
    etapas: [
      {
        id: "planejamento-geral",
        numero: "1.1",
        titulo: "Planejamento do Empreendimento",
        descricao:
          "Diretrizes gerais do empreendimento antes de abrir o estudo de novos negócios: nome, localização, responsável e premissas iniciais — hoje preenchidos na criação do estudo.",
        concluida: (e) => !!e.nome && !!e.municipio,
      },
    ],
  },
  {
    id: "novos-negocios",
    numero: 2,
    titulo: "Novos Negócios",
    etapas: [
      { id: "terreno", numero: "2.1", titulo: "Documentos do Terreno", componente: TerrenoTab, concluida: (e) => !!e.geojson },
      { id: "topografia", numero: "2.1", titulo: "Topografia 3D", componente: TopografiaTab, concluida: (e) => !!e.elevacaoJson },
      { id: "mercado", numero: "2.2", titulo: "Inteligência de Mercado", componente: MercadoTab, concluida: (e) => !!e.pesquisaCidadeJson || !!e.estudoMercadoJson || !!e.precificacaoComparaveisJson || pesquisaPrimariaPreenchidaDoJson(e.pesquisaPrimariaJson) },
      { id: "massa", numero: "2.3", titulo: "Estudo de Massa e Quadro de Áreas", componente: MassaTab, concluida: (e) => !!e.massaCenariosJson },
      {
        id: "orcamento-parametrizado",
        numero: "2.4",
        titulo: "Orçamento Parametrizado",
        componente: OrcamentoParametrizadoTab,
        concluida: (e) => !!e.orcamentoParametrizadoJson,
      },
      { id: "viabilidade", numero: "2.5", titulo: "Estudo de Viabilidade Econômica", componente: ViabilidadeTab, concluida: (e) => !!e.loteamentoJson },
      {
        id: "business-plan",
        numero: "2.6",
        titulo: "Business Plan e Investidores",
        componente: BusinessPlanTab,
        concluida: (e) => businessPlanPreenchidoDoJson(e.businessPlanJson),
      },
      {
        id: "negociacao-terreno",
        numero: "2.7",
        titulo: "Negociação do Terreno",
        componente: NegociacaoTerrenoTab,
        concluida: (e) => negociacaoFechadaDoJson(e.negociacaoTerrenoJson),
      },
    ],
  },
  {
    id: "incorporacao-produto",
    numero: 3,
    titulo: "Incorporação e Produto",
    etapas: [
      {
        id: "contratacao-projetistas",
        numero: "3.1",
        titulo: "Contratação de Projetistas",
        componente: ProjetistasTab,
        concluida: (e) => projetistasCompatibilizadosDoJson(e.projetistasJson),
      },
      {
        id: "projeto-aprovado",
        numero: "3.2",
        titulo: "Projeto Aprovado",
        componente: AprovacaoProjetoTab,
        concluida: (e) => projetoTotalmenteAprovadoDoJson(e.aprovacaoProjetoJson),
      },
      {
        id: "quadro-nbr-12721",
        numero: "3.3",
        titulo: "Quadro da NBR 12721",
        componente: QuadroAreasTab,
        concluida: (e) => !!e.quadroAreasJson,
      },
      {
        id: "registro-incorporacao",
        numero: "3.4",
        titulo: "Registro da Incorporação",
        componente: RegistroIncorporacaoTab,
        concluida: (e) => registroCompletoDoJson(e.registroIncorporacaoJson),
      },
      {
        id: "orcamento-preliminar-eve",
        numero: "3.5",
        titulo: "Orçamento Preliminar e EVE",
        componente: OrcamentoPreliminarTab,
        concluida: (e) => orcamentoPreliminarPreenchidoDoJson(e.orcamentoPreliminarJson),
      },
    ],
  },
  {
    id: "lancamento-mkt-vendas",
    numero: 4,
    titulo: "Lançamento, Marketing e Vendas",
    etapas: [
      {
        id: "planejamento-lancamento",
        numero: "4.1",
        titulo: "Planejamento do Lançamento",
        componente: PlanejamentoLancamentoTab,
        concluida: (e) => planejamentoLancamentoCompletoDoJson(e.planejamentoLancamentoJson),
      },
      {
        id: "contratacao-fornecedores",
        numero: "4.2",
        titulo: "Contratação de Fornecedores",
        componente: FornecedoresLancamentoTab,
        concluida: (e) => fornecedoresTodosContratadosDoJson(e.fornecedoresLancamentoJson),
      },
      {
        id: "material-publicitario",
        numero: "4.3",
        titulo: "Material Publicitário",
        componente: MaterialPublicitarioTab,
        concluida: (e) => materialPublicitarioAprovadoDoJson(e.materialPublicitarioJson),
      },
      {
        id: "lancamento-imobiliario",
        numero: "4.4",
        titulo: "Lançamento Imobiliário",
        componente: LancamentoImobiliarioTab,
        concluida: (e) => lancamentoImobiliarioComVendasDoJson(e.lancamentoImobiliarioJson),
      },
    ],
  },
  {
    id: "projetos-obras",
    numero: 5,
    titulo: "Projetos Executivos e Obras",
    etapas: [
      {
        id: "projetos-executivos",
        numero: "5.1",
        titulo: "Projetos Executivos",
        componente: ProjetosExecutivosTab,
        concluida: (e) => projetosExecutivosTodosLiberadosDoJson(e.projetosExecutivosJson),
      },
      {
        id: "orcamentos-obra",
        numero: "5.2",
        titulo: "Orçamentos",
        componente: OrcamentoObraTab,
        concluida: (e) => orcamentoObraPreenchidoDoJson(e.orcamentoObraJson),
      },
      {
        id: "cronograma-fisico-financeiro",
        numero: "5.3",
        titulo: "Cronograma Físico-Financeiro",
        componente: CronogramaObraTab,
        concluida: (e) => obraConcluidaDoJson(e.cronogramaObraJson),
      },
      {
        id: "atendimento-clientes",
        numero: "5.4",
        titulo: "Atendimento aos Clientes",
        componente: AtendimentoClientesTab,
        concluida: (e) => atendimentoTodosConcluidosDoJson(e.atendimentoClientesJson),
      },
    ],
  },
];

const MODULOS_ATIVOS = FASES.flatMap((fase) => fase.etapas
  .filter((etapa) => etapa.componente)
  .map((etapa) => ({ ...etapa, faseTitulo: fase.titulo })));

/** Progresso por fase — auto-computado a partir do que já está preenchido no estudo (nunca manual). */
function calcularProgresso(estudo: EstudoData) {
  const porFase = FASES.map((f) => {
    const concluidas = f.etapas.filter((e) => e.concluida?.(estudo)).length;
    const total = f.etapas.length;
    return { id: f.id, concluidas, total, pct: total > 0 ? Math.round((concluidas / total) * 100) : 0 };
  });
  const concluidasTotal = porFase.reduce((s, f) => s + f.concluidas, 0);
  const etapasTotal = porFase.reduce((s, f) => s + f.total, 0);
  const geral = etapasTotal > 0 ? Math.round((concluidasTotal / etapasTotal) * 100) : 0;
  return { porFase, geral };
}

export function IncorporacaoDetail({ estudo }: { estudo: EstudoData }) {
  const [etapaId, setEtapaId] = useState<string>("terreno");
  const [relatorioAtivo, setRelatorioAtivo] = useState(false);
  const [visitados, setVisitados] = useState<string[]>(["terreno"]);
  const [alterado, setAlterado] = useState(false);
  const temTerreno = !!estudo.geojson;

  const progresso = useMemo(() => calcularProgresso(estudo), [estudo]);

  useEffect(() => {
    if (!alterado) return;
    const avisar = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [alterado]);

  return (
    <div>
      {/* Progresso — auto-computado, sem checklist manual */}
      <div className="bg-white border border-gray-100 p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Progresso do estudo</p>
          <p className="text-xs font-black text-[var(--brand-dark)]">{progresso.geral}% concluído</p>
        </div>
        <div className="flex gap-1.5">
          {FASES.map((f, i) => {
            const pf = progresso.porFase[i];
            return (
              <div key={f.id} className="flex-1 min-w-0">
                <div className="h-1.5 bg-gray-100 overflow-hidden">
                  <div className="h-full bg-[var(--brand-yellow)] transition-all" style={{ width: `${pf.pct}%` }} />
                </div>
                <p className="text-[9px] text-gray-400 mt-1 truncate">{f.numero}. {f.titulo} ({pf.concluidas}/{pf.total})</p>
              </div>
            );
          })}
        </div>
      </div>

      <nav aria-label="Módulos da incorporação" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        <button type="button" onClick={() => { setEtapaId("dados"); setRelatorioAtivo(false); }}
          aria-current={!relatorioAtivo && etapaId === "dados" ? "page" : undefined}
          className={`min-w-0 border px-3 py-3 text-left text-xs font-bold break-words ${!relatorioAtivo && etapaId === "dados" ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)]" : "bg-white text-[var(--brand-dark)] hover:border-[var(--brand-yellow)]"}`}>
          Dados Gerais
        </button>
        {MODULOS_ATIVOS.map((modulo) => {
          const ativo = !relatorioAtivo && etapaId === modulo.id;
          const disabled = modulo.id !== "terreno" && !temTerreno;
          return (
            <button key={modulo.id} type="button" disabled={disabled}
              onClick={() => { setEtapaId(modulo.id); setRelatorioAtivo(false); setVisitados((anteriores) => anteriores.includes(modulo.id) ? anteriores : [...anteriores, modulo.id]); }}
              aria-current={ativo ? "page" : undefined}
              className={`min-w-0 border px-3 py-3 text-left text-xs font-bold break-words ${ativo ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)]" : disabled ? "bg-gray-50 text-gray-400 cursor-not-allowed" : "bg-white text-[var(--brand-dark)] hover:border-[var(--brand-yellow)]"}`}>
              <span className="block text-[10px] font-normal opacity-70">{modulo.faseTitulo}</span>{modulo.titulo}
            </button>
          );
        })}
        <button type="button" disabled={!temTerreno}
          onClick={() => { setRelatorioAtivo(true); setVisitados((anteriores) => anteriores.includes("relatorio") ? anteriores : [...anteriores, "relatorio"]); }}
          aria-current={relatorioAtivo ? "page" : undefined}
          className={`min-w-0 border px-3 py-3 text-left text-xs font-bold ${relatorioAtivo ? "bg-[var(--brand-dark)] text-[var(--brand-yellow)]" : !temTerreno ? "bg-gray-50 text-gray-400 cursor-not-allowed" : "bg-white text-[var(--brand-dark)] hover:border-[var(--brand-yellow)]"}`}>
          Relatório Executivo
        </button>
      </nav>
      {alterado && <p role="status" className="text-xs text-amber-800 mt-3">Há alterações nesta sessão. Salve antes de sair da página.</p>}
      <div className="pt-5" onInputCapture={() => setAlterado(true)} onChangeCapture={() => setAlterado(true)}>
        <div hidden={relatorioAtivo || etapaId !== "dados"} className="bg-white border border-gray-100 p-4 text-sm">
          <h2 className="font-bold text-[var(--brand-dark)] mb-2">Dados Gerais</h2>
          <p>{estudo.nome} · {estudo.municipio}/{estudo.estado}</p>
          <p>Responsável: {estudo.responsavel || "Não informado"}</p>
          <Link href={`/admin/incorporacao/${estudo.id}/editar`} className="inline-block mt-3 font-bold underline text-[var(--brand-dark)]">Editar dados gerais</Link>
        </div>
        {MODULOS_ATIVOS.filter((modulo) => visitados.includes(modulo.id)).map((modulo) => {
          const Componente = modulo.componente!;
          return <div key={modulo.id} hidden={relatorioAtivo || etapaId !== modulo.id}><Componente estudo={estudo} /></div>;
        })}
        {visitados.includes("relatorio") && <div hidden={!relatorioAtivo}><RelatorioTab estudo={estudo} /></div>}
      </div>
      {!temTerreno && etapaId !== "terreno" && etapaId !== "dados" && (
        <p className="text-xs text-gray-500 mt-3">Envie o KML do terreno para habilitar as análises.</p>
      )}
    </div>
  );
}
