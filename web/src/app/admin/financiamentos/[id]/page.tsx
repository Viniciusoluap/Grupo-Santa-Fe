import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, Mail, CheckCircle2, AlertCircle } from "lucide-react";
import { prisma } from "@/lib/db";
import { STATUS_CONFIG, TIPO_CONFIG, BANCO_CONFIG, FinanciamentoStatus } from "@/lib/types/financiamento";
import { formatCurrency } from "@/lib/utils";

interface PageProps { params: Promise<{ id: string }> }

const stageOrder: FinanciamentoStatus[] = ["pre_analise", "documentacao", "analise_banco", "aprovado", "contrato", "registro", "liberado"];

export default async function FinanciamentoDetailPage({ params }: PageProps) {
  const { id } = await params;
  const f = await prisma.financiamento.findUnique({
    where: { id },
    include: {
      checklist: { orderBy: { grupo: "asc" } },
      corretor: true,
    },
  });
  if (!f) notFound();

  const cfg = STATUS_CONFIG[f.status as FinanciamentoStatus] ?? {
    label: f.status,
    bgColor: "bg-gray-100",
    color: "text-gray-600",
    order: 0,
  };
  const currentOrder = cfg.order;

  const tipoLabel = TIPO_CONFIG[f.tipo as keyof typeof TIPO_CONFIG]?.label ?? f.tipo;
  const bancoLabel = BANCO_CONFIG[f.banco as keyof typeof BANCO_CONFIG]?.label ?? f.banco;

  // Group checklist items by grupo
  const checklistByGroup = f.checklist.reduce((acc, item) => {
    if (!acc[item.grupo]) acc[item.grupo] = [];
    acc[item.grupo].push(item);
    return acc;
  }, {} as Record<string, typeof f.checklist>);

  const totalChecklist = f.checklist.length;
  const doneChecklist = f.checklist.filter((i) => i.concluido).length;
  const progressPct = totalChecklist > 0 ? Math.round((doneChecklist / totalChecklist) * 100) : 0;

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/admin/financiamentos" className="flex items-center gap-1 text-sm text-gray-400 hover:text-[var(--brand-dark)]">
          <ArrowLeft size={14} /> Financiamentos
        </Link>
        <h1 className="font-black text-[var(--brand-dark)] text-xl uppercase">{f.clienteNome}</h1>
        <span className={`text-xs font-bold px-2 py-0.5 uppercase ${cfg.bgColor} ${cfg.color}`}>{cfg.label}</span>
      </div>

      {/* Pipeline */}
      <div className="bg-white border border-gray-100 p-4 overflow-x-auto">
        <div className="flex items-center gap-0 min-w-max">
          {stageOrder.map((stage, i, arr) => {
            const sc = STATUS_CONFIG[stage];
            const isActive = stage === f.status;
            const isPast = sc.order < currentOrder && f.status !== "cancelado";
            return (
              <div key={stage} className="flex items-center">
                <div className={`flex flex-col items-center px-2 py-1 ${isActive ? "opacity-100" : "opacity-50"}`}>
                  <div className={`w-3 h-3 rounded-full border-2 ${isActive ? "border-[var(--brand-yellow)] bg-[var(--brand-yellow)]" : isPast ? "border-green-500 bg-green-500" : "border-gray-300 bg-white"}`} />
                  <span className={`text-[10px] font-bold mt-1 uppercase text-center ${isActive ? "text-[var(--brand-dark)]" : "text-gray-400"}`}>{sc.label}</span>
                </div>
                {i < arr.length - 1 && <div className={`h-0.5 w-6 ${isPast || isActive ? "bg-[var(--brand-yellow)]" : "bg-gray-200"}`} />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: checklist */}
        <div className="lg:col-span-2 space-y-5">
          {/* Checklist progress */}
          <div className="bg-white border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest">Checklist Documental</h2>
              <span className="text-xs font-bold text-gray-500">{doneChecklist}/{totalChecklist} concluídos</span>
            </div>
            <div className="h-2 bg-gray-100 mb-5 overflow-hidden">
              <div className={`h-full transition-all ${progressPct === 100 ? "bg-green-500" : "bg-[var(--brand-yellow)]"}`} style={{ width: `${progressPct}%` }} />
            </div>

            {totalChecklist === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Nenhum item no checklist.</p>
            ) : (
              Object.entries(checklistByGroup).map(([grupo, items]) => (
                <div key={grupo} className="mb-4">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{grupo}</p>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 p-2.5 bg-gray-50">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {item.concluido
                            ? <CheckCircle2 size={14} className="text-green-600" />
                            : <AlertCircle size={14} className="text-orange-400" />
                          }
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[var(--brand-dark)] truncate">{item.item}</p>
                            {item.concluidoEm && (
                              <p className="text-xs text-gray-400">
                                Concluído em {new Date(item.concluidoEm).toLocaleDateString("pt-BR")}
                              </p>
                            )}
                            {item.notas && <p className="text-xs text-red-500">{item.notas}</p>}
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 uppercase shrink-0 ${item.concluido ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-600"}`}>
                          {item.concluido ? "Concluído" : "Pendente"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: sidebar */}
        <div className="space-y-4">
          {/* Client */}
          <div className="bg-[var(--brand-dark)] p-5">
            <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-3">Cliente</p>
            <p className="text-white font-bold">{f.clienteNome}</p>
            <p className="text-gray-400 text-sm mt-0.5">{f.imovel}</p>
            <div className="mt-4 space-y-2">
              <a href={`tel:${f.clienteTel}`} className="flex items-center gap-2 w-full bg-white/10 hover:bg-[var(--brand-yellow)] hover:text-[var(--brand-dark)] text-gray-300 font-bold text-xs uppercase tracking-wider py-2 px-3 transition-colors">
                <Phone size={14} /> {f.clienteTel}
              </a>
              {f.clienteEmail && (
                <a href={`mailto:${f.clienteEmail}`} className="flex items-center gap-2 w-full bg-white/10 hover:bg-[var(--brand-yellow)] hover:text-[var(--brand-dark)] text-gray-300 font-bold text-xs uppercase tracking-wider py-2 px-3 transition-colors">
                  <Mail size={14} /> E-mail
                </a>
              )}
            </div>
          </div>

          {/* Financial summary */}
          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Resumo Financeiro</p>
            {[
              { label: "Valor do imóvel", value: formatCurrency(f.valorImovel) },
              { label: "Valor financiado", value: formatCurrency(f.valorFinanciado) },
              { label: "Entrada", value: formatCurrency(f.entrada) },
              f.parcela ? { label: "Parcela", value: formatCurrency(f.parcela) } : null,
              { label: "Prazo", value: `${f.prazo} meses` },
              { label: "Taxa", value: `${f.taxa}% a.a.` },
            ].filter(Boolean).map((item) => item && (
              <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-500">{item.label}</span>
                <span className="font-bold text-xs text-[var(--brand-dark)]">{item.value}</span>
              </div>
            ))}
          </div>

          {/* Process info */}
          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Processo</p>
            {[
              { label: "Tipo", value: tipoLabel },
              { label: "Banco", value: bancoLabel },
              f.corretor ? { label: "Corretor", value: f.corretor.nome } : null,
              f.clienteCpf ? { label: "CPF", value: f.clienteCpf } : null,
              f.protocolo ? { label: "Protocolo", value: f.protocolo } : null,
              { label: "Cadastrado em", value: new Date(f.criadoEm).toLocaleDateString("pt-BR") },
            ].filter(Boolean).map((item) => item && (
              <div key={item.label} className="flex items-start justify-between py-1.5 border-b border-gray-50 last:border-0 gap-2">
                <span className="text-xs text-gray-500 shrink-0">{item.label}</span>
                <span className="text-xs font-medium text-[var(--brand-dark)] text-right">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
