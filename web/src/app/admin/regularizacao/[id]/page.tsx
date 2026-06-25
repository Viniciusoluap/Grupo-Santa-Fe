import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone } from "lucide-react";
import { prisma } from "@/lib/db";
import { REG_STATUS_CONFIG, REG_TIPO_CONFIG } from "@/lib/types/regularizacao";
import { formatCurrency, formatTelefone } from "@/lib/utils";
import { alterarStatusRegularizacao } from "@/lib/actions/regularizacao";
import RegDocumentosClient from "./_components/reg-documentos-client";

interface PageProps { params: Promise<{ id: string }> }

const stageOrder: Array<import("@/lib/types/regularizacao").RegStatus> = [
  "analise_inicial", "documentacao", "protocolo", "em_analise_orgao", "pendencias", "aprovado", "registrado", "concluido"
];

export default async function RegDetailPage({ params }: PageProps) {
  const { id } = await params;
  const r = await prisma.regularizacao.findUnique({
    where: { id },
    include: { documentos: true },
  });
  if (!r) notFound();

  const cfg = REG_STATUS_CONFIG[r.status as keyof typeof REG_STATUS_CONFIG] ?? {
    label: r.status,
    bgColor: "bg-gray-100",
    color: "text-gray-600",
    order: 0,
  };
  function parseTiposLabelReg(tipoStr: string): string {
    try {
      const arr = JSON.parse(tipoStr);
      if (Array.isArray(arr)) {
        return arr.map((t: string) => REG_TIPO_CONFIG[t as keyof typeof REG_TIPO_CONFIG]?.label ?? t).join(", ");
      }
    } catch {}
    return REG_TIPO_CONFIG[tipoStr as keyof typeof REG_TIPO_CONFIG]?.label ?? tipoStr;
  }
  function parseTipoIconReg(tipoStr: string): string {
    try {
      const arr = JSON.parse(tipoStr);
      if (Array.isArray(arr) && arr.length > 0) {
        return REG_TIPO_CONFIG[arr[0] as keyof typeof REG_TIPO_CONFIG]?.icon ?? "📁";
      }
    } catch {}
    return REG_TIPO_CONFIG[tipoStr as keyof typeof REG_TIPO_CONFIG]?.icon ?? "📁";
  }
  const tipo = { label: parseTiposLabelReg(r.tipo), icon: parseTipoIconReg(r.tipo) };
  const currentOrder = cfg.order;

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/admin/regularizacao" className="flex items-center gap-1 text-sm text-gray-400 hover:text-[var(--brand-dark)]">
          <ArrowLeft size={14} /> Regularização
        </Link>
        <h1 className="font-black text-[var(--brand-dark)] text-xl uppercase flex-1">{r.nome}</h1>
        <span className={`text-xs font-bold px-2 py-0.5 uppercase ${cfg.bgColor} ${cfg.color}`}>{cfg.label}</span>
      </div>

      {/* Pipeline */}
      <div className="bg-white border border-gray-100 p-4 overflow-x-auto">
        <div className="flex items-center gap-0 min-w-max">
          {stageOrder.map((stage, i, arr) => {
            const sc = REG_STATUS_CONFIG[stage];
            const isActive = stage === r.status;
            const isPast = sc.order < currentOrder && r.status !== "cancelado";
            return (
              <div key={stage} className="flex items-center">
                <div className={`flex flex-col items-center px-2 py-1 ${isActive ? "opacity-100" : "opacity-50"}`}>
                  <div className={`w-3 h-3 rounded-full border-2 ${isActive ? "border-[var(--brand-yellow)] bg-[var(--brand-yellow)]" : isPast ? "border-green-500 bg-green-500" : "border-gray-300 bg-white"}`} />
                  <span className={`text-[9px] font-bold mt-1 uppercase text-center max-w-[52px] leading-tight ${isActive ? "text-[var(--brand-dark)]" : "text-gray-400"}`}>{sc.label}</span>
                </div>
                {i < arr.length - 1 && <div className={`h-0.5 w-5 ${isPast || isActive ? "bg-[var(--brand-yellow)]" : "bg-gray-200"}`} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Status change */}
      <div className="bg-white border border-gray-100 p-4 flex items-center gap-4 flex-wrap">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Alterar Status:</span>
        <div className="flex flex-wrap gap-2">
          {Object.entries(REG_STATUS_CONFIG).map(([status, sc]) => {
            const isActive = status === r.status;
            return (
              <form key={status} action={alterarStatusRegularizacao.bind(null, r.id, status)}>
                <button
                  type="submit"
                  className={`text-[10px] font-bold px-3 py-1.5 uppercase transition-colors border ${isActive ? `${sc.bgColor} ${sc.color} border-transparent cursor-default` : "border-gray-200 text-gray-400 hover:bg-gray-50"}`}
                  disabled={isActive}
                >
                  {sc.label}
                </button>
              </form>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main */}
        <div className="lg:col-span-2 space-y-5">
          {/* Documents — interactive client component */}
          <RegDocumentosClient
            regularizacaoId={r.id}
            documentos={r.documentos.map((d) => ({
              id: d.id,
              nome: d.nome,
              status: d.status,
              observacao: d.observacao,
            }))}
            currentStatus={r.status}
          />

          {/* Descrição */}
          {r.descricao && (
            <div className="bg-white border border-gray-100 p-5">
              <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest mb-3 pb-2 border-b border-gray-100">Descrição</h2>
              <p className="text-sm text-gray-600 leading-relaxed">{r.descricao}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-[var(--brand-dark)] p-5">
            <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-3">Cliente</p>
            <p className="text-white font-bold">{r.clienteNome}</p>
            <p className="text-gray-400 text-xs mt-1">{r.endereco}</p>
            {r.matricula && <p className="text-gray-400 text-xs mt-0.5">{r.matricula}</p>}
            <a href={`tel:${r.clienteTel}`} className="mt-3 flex items-center gap-2 w-full bg-white/10 hover:bg-[var(--brand-yellow)] hover:text-[var(--brand-dark)] text-gray-300 font-bold text-xs uppercase tracking-wider py-2 px-3 transition-colors">
              <Phone size={14} /> {formatTelefone(r.clienteTel)}
            </a>
          </div>

          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Informações</p>
            {[
              { label: "Tipo", value: `${tipo.icon} ${tipo.label}` },
              { label: "Responsável", value: r.responsavel },
              r.cartorio ? { label: "Cartório", value: r.cartorio } : null,
              r.previsaoFim ? { label: "Previsão", value: new Date(r.previsaoFim).toLocaleDateString("pt-BR") } : null,
            ].filter(Boolean).map((item) => item && (
              <div key={item.label} className="flex items-start justify-between py-1.5 border-b border-gray-50 last:border-0 gap-2">
                <span className="text-xs text-gray-500 shrink-0">{item.label}</span>
                <span className="text-xs font-medium text-[var(--brand-dark)] text-right">{item.value}</span>
              </div>
            ))}
          </div>

          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Financeiro</p>
            {[
              { label: "Valor do serviço", value: formatCurrency(r.valorServico), color: "text-[var(--brand-dark)]" },
              { label: "Pago", value: formatCurrency(r.valorPago), color: "text-green-600" },
              { label: "A receber", value: formatCurrency(r.valorServico - r.valorPago), color: r.valorServico - r.valorPago > 0 ? "text-orange-500" : "text-gray-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-500">{label}</span>
                <span className={`text-xs font-bold ${color}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
