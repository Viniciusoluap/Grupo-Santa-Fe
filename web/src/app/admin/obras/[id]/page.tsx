import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone } from "lucide-react";
import { prisma } from "@/lib/db";
import { OBRA_STATUS_CONFIG, OBRA_TIPO_CONFIG, WEATHER_CONFIG, ObraStatus, ObraTipo } from "@/lib/types/obra";
import { formatCurrency, formatTelefone } from "@/lib/utils";
import { ObraDiarioClient } from "./_components/obra-diario-client";

interface PageProps { params: Promise<{ id: string }> }

export default async function ObraDetailPage({ params }: PageProps) {
  const { id } = await params;
  const o = await prisma.obra.findUnique({
    where: { id },
    include: {
      etapas: { orderBy: { ordem: "asc" } },
      diario: { orderBy: { data: "desc" }, take: 20 },
    },
  });
  if (!o) notFound();

  const cfg = OBRA_STATUS_CONFIG[o.status as ObraStatus] ?? {
    label: o.status,
    bgColor: "bg-gray-100",
    color: "text-gray-600",
  };
  const tipo = OBRA_TIPO_CONFIG[o.tipo as ObraTipo] ?? { label: o.tipo, icon: "🏗️" };

  const aReceber = o.valorTotal - o.valorPago;

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/admin/obras" className="flex items-center gap-1 text-sm text-gray-400 hover:text-[var(--brand-dark)]">
          <ArrowLeft size={14} /> Obras
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
              <span className="text-xs font-bold text-[var(--brand-dark)]">{o.progresso}%</span>
            </div>
            <div className="h-3 bg-gray-100 overflow-hidden">
              <div
                className={`h-full transition-all ${o.progresso === 100 ? "bg-green-500" : "bg-[var(--brand-yellow)]"}`}
                style={{ width: `${o.progresso}%` }}
              />
            </div>
          </div>

          {/* Etapas */}
          <div className="bg-white border border-gray-100 p-5">
            <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest mb-4 pb-2 border-b border-gray-100">
              Etapas da Obra ({o.etapas.filter((e) => e.status === "concluida").length}/{o.etapas.length})
            </h2>
            {o.etapas.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Nenhuma etapa cadastrada.</p>
            ) : (
              <div className="space-y-3">
                {o.etapas.map((e) => {
                  const statusColor = e.status === "concluida" ? "bg-green-500" : e.status === "em_andamento" ? "bg-[var(--brand-yellow)]" : "bg-gray-200";
                  const labelColor = e.status === "concluida" ? "text-green-600" : e.status === "em_andamento" ? "text-[var(--brand-dark)]" : "text-gray-400";
                  return (
                    <div key={e.id} className={`p-3 border ${e.status === "em_andamento" ? "border-[var(--brand-yellow)] bg-[var(--brand-yellow)]/5" : "border-gray-100"}`}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 flex items-center justify-center text-xs font-black rounded-full text-white ${e.status === "concluida" ? "bg-green-500" : e.status === "em_andamento" ? "bg-[var(--brand-yellow)] text-[var(--brand-dark)]" : "bg-gray-200 text-gray-400"}`}>
                            {e.status === "concluida" ? "✓" : e.ordem}
                          </span>
                          <span className={`text-sm font-bold ${labelColor}`}>{e.nome}</span>
                          {e.status === "em_andamento" && (
                            <span className="text-[9px] font-bold bg-[var(--brand-yellow)] text-[var(--brand-dark)] px-2 py-0.5 uppercase">Em andamento</span>
                          )}
                        </div>
                        <span className="text-xs font-bold text-[var(--brand-dark)]">{e.percentual}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 overflow-hidden">
                        <div className={`h-full ${statusColor}`} style={{ width: `${e.percentual}%` }} />
                      </div>
                      {e.descricao && <p className="text-xs text-gray-400 mt-1">{e.descricao}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Diário de obra */}
          <ObraDiarioClient
            obraId={o.id}
            diario={o.diario.map((e) => ({ ...e }))}
            weatherConfig={WEATHER_CONFIG}
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
              { label: "Engenheiro", value: o.engenheiroResp },
              { label: "Área", value: `${o.area} m²` },
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

          {/* Financial */}
          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Financeiro</p>
            {[
              { label: "Valor total", value: formatCurrency(o.valorTotal), color: "text-[var(--brand-dark)]" },
              { label: "Recebido", value: formatCurrency(o.valorPago), color: "text-green-600" },
              { label: "A receber", value: formatCurrency(aReceber), color: aReceber > 0 ? "text-orange-500" : "text-gray-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-500">{label}</span>
                <span className={`text-xs font-bold ${color}`}>{value}</span>
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
