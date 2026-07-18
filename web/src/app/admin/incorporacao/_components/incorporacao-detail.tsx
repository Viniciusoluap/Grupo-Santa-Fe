"use client";

import { useMemo, useState } from "react";
import { MapPinned, Mountain, TrendingUp, Grid3x3, Calculator, FileText } from "lucide-react";
import { TerrenoTab } from "./terreno-tab";
import { TopografiaTab } from "./topografia-tab";
import { MercadoTab } from "./mercado-tab";
import { MassaTab } from "./massa-tab";
import { OrcamentoParametrizadoTab } from "./orcamento-parametrizado-tab";
import { ViabilidadeTab } from "./viabilidade-tab";
import { QuadroAreasTab } from "./quadro-areas-tab";
import { NegociacaoTerrenoTab } from "./negociacao-terreno-tab";
import { BusinessPlanTab } from "./business-plan-tab";
import { RelatorioTab } from "./relatorio-tab";
import { EmBreve } from "./em-breve";
import { negociacaoFechadaDoJson } from "@/lib/incorporacao/negociacao";
import { businessPlanPreenchidoDoJson } from "@/lib/finance/captacao";
import { pesquisaPrimariaPreenchidaDoJson } from "@/lib/incorporacao/pesquisa-primaria";

export interface EstudoData {
  id: string;
  nome: string;
  municipio: string;
  estado: string;
  status: string;
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
        descricao:
          "Gestão dos projetistas contratados (arquitetura, estrutural, instalações), com cronograma de entrega e compatibilização técnica entre disciplinas.",
      },
      {
        id: "projeto-aprovado",
        numero: "3.2",
        titulo: "Projeto Aprovado",
        descricao: "Controle da aprovação do projeto legal junto à prefeitura e demais órgãos competentes.",
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
        descricao: "Checklist e documentos do registro da incorporação em cartório.",
      },
      {
        id: "orcamento-preliminar-eve",
        numero: "3.5",
        titulo: "Orçamento Preliminar e EVE",
        descricao:
          "Orçamento preliminar de obra detalhado por disciplina, reconciliado com o Estudo de Viabilidade Econômica já existente na fase de Novos Negócios.",
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
        descricao: "Cronograma e estratégia do lançamento comercial do empreendimento.",
      },
      {
        id: "contratacao-fornecedores",
        numero: "4.2",
        titulo: "Contratação de Fornecedores",
        descricao: "Gestão de fornecedores de marketing, estande de vendas, decoração e eventos do lançamento.",
      },
      {
        id: "material-publicitario",
        numero: "4.3",
        titulo: "Material Publicitário",
        descricao: "Repositório e aprovação de peças publicitárias (site, folder, vídeos, redes sociais).",
      },
      {
        id: "lancamento-imobiliario",
        numero: "4.4",
        titulo: "Lançamento Imobiliário",
        descricao:
          "Painel do lançamento: velocidade de vendas real x projetada, tabela de vendas e resultado do evento de lançamento.",
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
        descricao: "Repositório dos projetos executivos de engenharia liberados para obra.",
      },
      {
        id: "orcamentos-obra",
        numero: "5.2",
        titulo: "Orçamentos",
        descricao: "Orçamento executivo real da obra, comparado ao orçamento preliminar e parametrizado.",
      },
      {
        id: "cronograma-fisico-financeiro",
        numero: "5.3",
        titulo: "Cronograma Físico-Financeiro",
        descricao:
          "Curva S física x financeira da obra, medindo o avanço físico contra o desembolso previsto na Viabilidade.",
      },
      {
        id: "atendimento-clientes",
        numero: "5.4",
        titulo: "Atendimento aos Clientes",
        descricao: "Central de atendimento pós-venda: repasses, assembleias e entrega de chaves.",
      },
    ],
  },
];

const ICONE_FASE: Record<string, React.ComponentType<{ size?: number }>> = {
  planejamento: MapPinned,
  "novos-negocios": TrendingUp,
  "incorporacao-produto": Grid3x3,
  "lancamento-mkt-vendas": Mountain,
  "projetos-obras": Calculator,
};

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
  const [faseId, setFaseId] = useState<string>("novos-negocios");
  const [etapaId, setEtapaId] = useState<string>("terreno");
  const [relatorioAtivo, setRelatorioAtivo] = useState(false);
  const temTerreno = !!estudo.geojson;

  const fase = useMemo(() => FASES.find((f) => f.id === faseId) ?? FASES[0], [faseId]);
  const etapa = useMemo(
    () => fase.etapas.find((e) => e.id === etapaId) ?? fase.etapas[0],
    [fase, etapaId]
  );
  const progresso = useMemo(() => calcularProgresso(estudo), [estudo]);

  function selecionarFase(f: Fase) {
    setFaseId(f.id);
    setEtapaId(f.etapas[0].id);
    setRelatorioAtivo(false);
  }

  const Componente = etapa.componente;

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

      {/* Fases (nível 1) */}
      <div className="flex gap-1 border-b border-gray-100 overflow-x-auto">
        {FASES.map((f) => {
          const Icon = ICONE_FASE[f.id];
          const ativo = !relatorioAtivo && faseId === f.id;
          return (
            <button
              key={f.id}
              onClick={() => selecionarFase(f)}
              className={`flex items-center gap-1.5 text-xs font-bold px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                ativo
                  ? "border-[var(--brand-yellow)] text-[var(--brand-dark)]"
                  : "border-transparent text-gray-400 hover:text-[var(--brand-dark)]"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black ${
                  ativo ? "bg-[var(--brand-yellow)] text-[var(--brand-dark)]" : "bg-gray-100 text-gray-400"
                }`}
              >
                {f.numero}
              </span>
              <Icon size={13} /> {f.titulo}
            </button>
          );
        })}
        <button
          onClick={() => setRelatorioAtivo(true)}
          disabled={!temTerreno}
          className={`flex items-center gap-1.5 text-xs font-bold px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
            relatorioAtivo
              ? "border-[var(--brand-yellow)] text-[var(--brand-dark)]"
              : !temTerreno
              ? "border-transparent text-gray-300 cursor-not-allowed"
              : "border-transparent text-gray-400 hover:text-[var(--brand-dark)]"
          }`}
        >
          <FileText size={13} /> Relatório
        </button>
      </div>

      {!relatorioAtivo && (
        <div className="flex flex-wrap gap-1.5 pt-3">
          {fase.etapas.map((e) => {
            const disabled = e.id !== "terreno" && !temTerreno;
            const ativo = etapaId === e.id;
            return (
              <button
                key={e.id}
                onClick={() => !disabled && setEtapaId(e.id)}
                disabled={disabled}
                className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 border transition-colors whitespace-nowrap ${
                  ativo
                    ? "bg-[var(--brand-dark)] border-[var(--brand-dark)] text-[var(--brand-yellow)]"
                    : disabled
                    ? "border-gray-100 text-gray-300 cursor-not-allowed"
                    : "border-gray-200 text-gray-500 hover:border-[var(--brand-yellow)] hover:text-[var(--brand-dark)]"
                }`}
              >
                <span className="text-gray-400">{e.numero}</span> {e.titulo}
                {!e.componente && (
                  <span
                    className={`text-[8px] font-black px-1 py-0.5 uppercase ${
                      ativo ? "bg-[var(--brand-yellow)] text-[var(--brand-dark)]" : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    breve
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="pt-5">
        {relatorioAtivo ? (
          <RelatorioTab estudo={estudo} />
        ) : Componente ? (
          <Componente estudo={estudo} />
        ) : (
          <EmBreve titulo={etapa.titulo} descricao={etapa.descricao ?? "Esta etapa ainda será construída."} />
        )}
      </div>

      {!temTerreno && !relatorioAtivo && etapaId !== "terreno" && (
        <p className="text-xs text-gray-400 mt-3">
          Envie o KML do terreno na etapa <b>2.1 Documentos do Terreno</b> para habilitar as demais análises.
        </p>
      )}
    </div>
  );
}
