import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone } from "lucide-react";
import { prisma } from "@/lib/db";
import { PROJETO_STATUS_CONFIG, PROJETO_TIPO_CONFIG } from "@/lib/types/projeto";
import { formatCurrency, formatTelefone } from "@/lib/utils";
import ProjetoDetailClient from "./_components/projeto-detail-client";

interface PageProps { params: Promise<{ id: string }> }

export default async function ProjetoDetailPage({ params }: PageProps) {
  const { id } = await params;
  const p = await prisma.projeto.findUnique({ where: { id } });
  if (!p) notFound();

  const cfg = PROJETO_STATUS_CONFIG[p.status as keyof typeof PROJETO_STATUS_CONFIG] ?? {
    label: p.status,
    bgColor: "bg-gray-100",
    color: "text-gray-600",
  };
  function parseTiposLabel(tipoStr: string): string {
    try {
      const arr = JSON.parse(tipoStr);
      if (Array.isArray(arr)) {
        return arr.map((t: string) => PROJETO_TIPO_CONFIG[t as keyof typeof PROJETO_TIPO_CONFIG]?.label ?? t).join(", ");
      }
    } catch {}
    return PROJETO_TIPO_CONFIG[tipoStr as keyof typeof PROJETO_TIPO_CONFIG]?.label ?? tipoStr;
  }
  function parseTipoIcon(tipoStr: string): string {
    try {
      const arr = JSON.parse(tipoStr);
      if (Array.isArray(arr) && arr.length > 0) {
        return PROJETO_TIPO_CONFIG[arr[0] as keyof typeof PROJETO_TIPO_CONFIG]?.icon ?? "📁";
      }
    } catch {}
    return PROJETO_TIPO_CONFIG[tipoStr as keyof typeof PROJETO_TIPO_CONFIG]?.icon ?? "📁";
  }
  const tipo = { label: parseTiposLabel(p.tipo), icon: parseTipoIcon(p.tipo) };

  // Strip non-serializable fields from statusConfig
  const statusConfig = Object.fromEntries(
    Object.entries(PROJETO_STATUS_CONFIG).map(([k, v]) => [
      k,
      { label: v.label, bgColor: v.bgColor, color: v.color },
    ])
  );

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/admin/projetos" className="flex items-center gap-1 text-sm text-gray-400 hover:text-[var(--brand-dark)]">
          <ArrowLeft size={14} /> Projetos
        </Link>
        <h1 className="font-black text-[var(--brand-dark)] text-xl uppercase flex-1">{p.nome}</h1>
        <span className={`text-xs font-bold px-2 py-0.5 uppercase ${cfg.bgColor} ${cfg.color}`}>{cfg.label}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main */}
        <div className="lg:col-span-2 space-y-5">
          {/* Interactive sections: status, checklist, arquivos */}
          <ProjetoDetailClient
            projetoId={p.id}
            checklistJson={p.checklist}
            arquivosJson={p.arquivos}
            status={p.status}
            statusConfig={statusConfig}
          />

          {/* Description */}
          <div className="bg-white border border-gray-100 p-5">
            <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest mb-3 pb-2 border-b border-gray-100">Descrição</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{p.descricao || "Sem descrição."}</p>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Client */}
          <div className="bg-[var(--brand-dark)] p-5">
            <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-3">Cliente</p>
            <p className="text-white font-bold">{p.clienteNome}</p>
            <div className="mt-3 space-y-2">
              <a href={`tel:${p.clienteTel}`} className="flex items-center gap-2 w-full bg-white/10 hover:bg-[var(--brand-yellow)] hover:text-[var(--brand-dark)] text-gray-300 font-bold text-xs uppercase tracking-wider py-2 px-3 transition-colors">
                <Phone size={14} /> {formatTelefone(p.clienteTel)}
              </a>
            </div>
          </div>

          {/* Info */}
          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Informações</p>
            {[
              { label: "Tipo", value: `${tipo.icon} ${tipo.label}` },
              { label: "Engenheiro", value: p.engenheiro },
              p.prazoEntrega ? { label: "Prazo de entrega", value: new Date(p.prazoEntrega).toLocaleDateString("pt-BR") } : null,
            ].filter(Boolean).map((item) => item && (
              <div key={item.label} className="flex items-start justify-between py-1.5 border-b border-gray-50 last:border-0 gap-2">
                <span className="text-xs text-gray-500 shrink-0">{item.label}</span>
                <span className="text-xs font-medium text-[var(--brand-dark)] text-right">{item.value}</span>
              </div>
            ))}
          </div>

          {/* Financial */}
          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Financeiro</p>
            {[
              { label: "Valor contratado", value: formatCurrency(p.valorProjeto), color: "text-[var(--brand-dark)]" },
              { label: "Pago", value: formatCurrency(p.valorPago), color: "text-green-600" },
              { label: "A receber", value: formatCurrency(p.valorProjeto - p.valorPago), color: p.valorProjeto - p.valorPago > 0 ? "text-orange-500" : "text-gray-400" },
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
