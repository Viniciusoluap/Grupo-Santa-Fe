import { notFound } from "next/navigation";
import { formatarPercentual, progressoDaObra } from "@/lib/financeiro/progresso";
import Link from "next/link";
import { ArrowLeft, Phone } from "lucide-react";
import { prisma } from "@/lib/db";
import { OBRA_STATUS_CONFIG, WEATHER_CONFIG, ObraStatus, tipoProjetoObra } from "@/lib/types/obra";
import { formatCurrency, formatTelefone } from "@/lib/utils";
import { ObraDiarioClient } from "@/app/admin/obras/[id]/_components/obra-diario-client";
import { carregarResumoObra } from "@/lib/financeiro/obra-dados";
import type { Indicador } from "@/lib/financeiro/obra";
import { carregarProgressoObra, calculoDoProgresso } from "@/lib/obras/progresso-dados";
import { montarDetalheObra } from "@/lib/financeiro/detalhe-obra";
import { carregarGaleriaObra } from "@/lib/obras/galeria-dados";
import { GaleriaMedicoes } from "@/components/obras/galeria-medicoes";

const exibir = (i: Indicador) => (i.ok ? formatCurrency(i.centavos / 100) : "Não calculado");

/**
 * Página de detalhes da obra. A mesma tela serve o painel e o Portal do
 * Empreiteiro (pedido de 15/10: "Ver Detalhes" igual ao do admin); quem chama
 * confere o acesso antes.
 */
export async function ObraDetalhe({ id, voltarHref = "/admin/obras", voltarRotulo = "Obras", diarioSomenteLeitura = false }: {
  id: string;
  voltarHref?: string;
  voltarRotulo?: string;
  /** O empreiteiro consulta o diário; os registros são da equipe. */
  diarioSomenteLeitura?: boolean;
}) {
  const o = await prisma.obra.findUnique({
    where: { id },
    include: {
      diario: { orderBy: { data: "desc" }, take: 20 },
      servicoLead: { select: { servico: true } },
      _count: { select: { fotos: true } },
    },
  });
  if (!o) notFound();

  const cfg = OBRA_STATUS_CONFIG[o.status as ObraStatus] ?? {
    label: o.status,
    bgColor: "bg-gray-100",
    color: "text-gray-600",
  };
  const tipo = tipoProjetoObra(o);

  // EPIC-020 Lote 2: os indicadores saem do motor único (Valores da Operação +
  // Custos). `valorTotal`/`valorPago` antigos ficam só como referência legada.
  const resumo = await carregarResumoObra(o.id);
  // Etapas, Resumo Financeiro e Estatísticas espelham o editor da obra
  // (Acompanhar Progresso + Valores da Operação/Custos) — igual à Prospecta.
  const dadosProgresso = await carregarProgressoObra(o.id);
  // Lote 02, correção 02: mesma galeria por medição do Editar Obra (só visualização;
  // a página que chama já conferiu o acesso à obra).
  const galeria = await carregarGaleriaObra(o.id);
  const detalhe = montarDetalheObra(calculoDoProgresso(dadosProgresso!), resumo!.calculo, o._count.fotos);
  const f = detalhe.financeiro;
  const progresso = progressoDaObra(o.progressoMedido?.toString(), o.progresso);

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href={voltarHref} className="flex items-center gap-1 text-sm text-gray-600 hover:text-[var(--brand-dark)]">
          <ArrowLeft size={14} /> {voltarRotulo}
        </Link>
        <h1 className="font-black text-[var(--brand-dark)] text-xl uppercase">{o.nome}</h1>
        <span className={`text-xs font-bold px-2 py-0.5 uppercase ${cfg.bgColor} ${cfg.color}`}>{cfg.label}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Progress bar */}
          <div className="bg-white border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest">Progresso Geral</h2>
              <span className="text-xs font-bold text-[var(--brand-dark)]">{formatarPercentual(progresso)}</span>
            </div>
            <div className="h-3 bg-gray-100 overflow-hidden">
              <div
                className={`h-full transition-all ${progresso >= 100 ? "bg-green-500" : "bg-[var(--brand-yellow)]"}`}
                style={{ width: `${Math.min(100, progresso)}%` }}
              />
            </div>
          </div>

          {/* Etapas — serviços do acompanhamento de progresso */}
          <div className="bg-white border border-gray-100 p-5">
            <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest mb-4 pb-2 border-b border-gray-100">
              Etapas da Obra ({detalhe.estatisticas.etapasConcluidas}/{detalhe.estatisticas.totalEtapas})
            </h2>
            {detalhe.etapas.length === 0 ? (
              <p className="text-sm text-gray-600 text-center py-4">Nenhuma etapa com incidência no acompanhamento do progresso.</p>
            ) : (
              <div className="space-y-3">
                {detalhe.etapas.map((e, i) => {
                  const statusColor = e.situacao === "concluida" ? "bg-green-700" : e.situacao === "em_andamento" ? "bg-[var(--brand-yellow)]" : "bg-gray-200";
                  const labelColor = e.situacao === "concluida" ? "text-green-600" : e.situacao === "em_andamento" ? "text-[var(--brand-dark)]" : "text-gray-600";
                  return (
                    <div key={e.chave} className={`p-3 border ${e.situacao === "em_andamento" ? "border-[var(--brand-yellow)] bg-[var(--brand-yellow)]/5" : "border-gray-100"}`}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 flex items-center justify-center text-xs font-black rounded-full text-white ${e.situacao === "concluida" ? "bg-green-700" : e.situacao === "em_andamento" ? "bg-[var(--brand-yellow)] text-[var(--brand-dark)]" : "bg-gray-200 text-gray-700"}`}>
                            {e.situacao === "concluida" ? "✓" : i + 1}
                          </span>
                          <div>
                            <span className={`text-sm font-bold ${labelColor}`}>{e.nome}</span>
                            <p className="text-[10px] text-gray-600">Incidência {formatarPercentual(e.incidencia)} · {formatarPercentual(e.execucaoObra)} da obra</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-[var(--brand-dark)]">{formatarPercentual(e.execucao)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 overflow-hidden">
                        <div className={`h-full ${statusColor}`} style={{ width: `${Math.min(100, e.execucao)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Fotos por medição — mesmos dados e componente do Editar Obra */}
          <div className="bg-white border border-gray-100 p-5">
            <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest mb-1">Galeria de Fotos ({galeria.fotos.length})</h2>
            <p className="text-xs text-gray-600 mb-4 pb-2 border-b border-gray-100">Fotos organizadas por medição. A gestão das fotos é feita em Editar Obra › Progresso.</p>
            <div className="text-[var(--brand-dark)]">
              <GaleriaMedicoes fotos={galeria.fotos} medicoes={galeria.medicoes} tema="claro" vazio="Nenhuma foto adicionada ainda." />
            </div>
          </div>

          {/* Diário de obra */}
          <ObraDiarioClient
            obraId={o.id}
            diario={o.diario.map((e) => ({ ...e }))}
            weatherConfig={WEATHER_CONFIG}
            somenteLeitura={diarioSomenteLeitura}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Client */}
          <div className="bg-[var(--brand-dark)] p-5">
            <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-3">Cliente</p>
            <p className="text-white font-bold">{o.clienteNome}</p>
            <p className="text-gray-400 text-xs mt-1">{o.endereco}</p>
            <a href={`tel:${o.clienteTel}`} className="mt-3 flex items-center gap-2 w-full bg-white/10 hover:bg-[var(--brand-yellow)] hover:text-[var(--brand-dark)] text-gray-300 font-bold text-xs uppercase tracking-wider py-2 px-3 transition-colors">
              <Phone size={14} /> {formatTelefone(o.clienteTel)}
            </a>
          </div>

          {/* Resumo */}
          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Resumo</p>
            {[
              { label: "Tipo", value: `${tipo.icon} ${tipo.label}` },
              { label: "Engenheiro", value: o.engenheiroResp ?? "Pendente de configuração" },
              { label: "Área", value: o.area == null ? "Pendente de configuração" : `${o.area} m²` },
              o.dataInicio ? { label: "Início", value: new Date(o.dataInicio).toLocaleDateString("pt-BR") } : null,
              o.dataPrevisaoFim ? { label: "Previsão", value: new Date(o.dataPrevisaoFim).toLocaleDateString("pt-BR") } : null,
              o.dataConclusao ? { label: "Concluída em", value: new Date(o.dataConclusao).toLocaleDateString("pt-BR") } : null,
            ].filter(Boolean).map((item) => item && (
              <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-500">{item.label}</span>
                <span className="text-xs font-medium text-[var(--brand-dark)]">{item.value}</span>
              </div>
            ))}
          </div>

          {/* Resumo Financeiro — mesmos campos do editor da obra */}
          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Resumo Financeiro</p>
            {[
              { label: "Orçamento Previsto", value: exibir(f.orcamentoPrevisto), color: "text-[var(--brand-dark)]" },
              { label: "Valor a Receber do Banco", value: exibir(f.receberBanco), color: f.receberBanco.ok && f.receberBanco.centavos > 0 ? "text-orange-500" : "text-[var(--brand-dark)]" },
              { label: "PLS Real (%)", value: f.plsReal.ok ? formatarPercentual(f.plsReal.percentual) : "Não calculado", color: "text-[var(--brand-dark)]" },
              { label: "Gasto Obra Realizado", value: exibir(f.gastoObraRealizado), color: "text-[var(--brand-dark)]" },
              { label: "Saldo Restante", value: exibir(f.saldoRestante), color: f.saldoRestante.ok && f.saldoRestante.centavos < 0 ? "text-red-600" : "text-green-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-500">{label}</span>
                <span className={`text-xs font-bold ${color}`}>{value}</span>
              </div>
            ))}
          </div>

          {/* Estatísticas */}
          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Estatísticas</p>
            {[
              { label: "Total de Etapas", value: detalhe.estatisticas.totalEtapas },
              { label: "Etapas Concluídas", value: detalhe.estatisticas.etapasConcluidas },
              { label: "Total de Fotos", value: detalhe.estatisticas.totalFotos },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-500">{label}</span>
                <span className="text-xs font-bold text-[var(--brand-dark)]">{value}</span>
              </div>
            ))}
          </div>

          {o.descricao && (
            <div className="bg-yellow-50 border border-yellow-100 p-4">
              <p className="text-xs font-bold text-yellow-700 uppercase tracking-wide mb-1">Observações</p>
              <p className="text-xs text-yellow-800">{o.descricao}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
