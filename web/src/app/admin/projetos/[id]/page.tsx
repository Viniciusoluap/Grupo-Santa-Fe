import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, Mail, Clock } from "lucide-react";
import { getProjetoById } from "@/lib/data/projetos";
import { PROJETO_STATUS_CONFIG, PROJETO_TIPO_CONFIG } from "@/lib/types/projeto";
import { formatCurrency } from "@/lib/utils";

interface PageProps { params: Promise<{ id: string }> }

export default async function ProjetoDetailPage({ params }: PageProps) {
  const { id } = await params;
  const p = getProjetoById(id);
  if (!p) notFound();

  const cfg = PROJETO_STATUS_CONFIG[p.status];
  const tipo = PROJETO_TIPO_CONFIG[p.tipo];
  const totalOrcamento = p.orcamento.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/admin/projetos" className="flex items-center gap-1 text-sm text-gray-400 hover:text-[var(--brand-dark)]">
          <ArrowLeft size={14} /> Projetos
        </Link>
        <h1 className="font-black text-[var(--brand-dark)] text-xl uppercase flex-1">{p.name}</h1>
        <span className={`text-xs font-bold px-2 py-0.5 uppercase ${cfg.bgColor} ${cfg.color}`}>{cfg.label}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main */}
        <div className="lg:col-span-2 space-y-5">
          {/* Description */}
          <div className="bg-white border border-gray-100 p-5">
            <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest mb-3 pb-2 border-b border-gray-100">Descrição</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{p.description}</p>
            {p.deliverables.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Entregáveis</p>
                <ul className="space-y-1">
                  {p.deliverables.map((d) => (
                    <li key={d} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="w-1.5 h-1.5 bg-[var(--brand-yellow)] rounded-full shrink-0" />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Orçamento */}
          {p.orcamento.length > 0 && (
            <div className="bg-white border border-gray-100">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest">Orçamento Detalhado</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-bold text-gray-400 uppercase">Descrição</th>
                      <th className="px-4 py-2 text-center text-xs font-bold text-gray-400 uppercase">Und</th>
                      <th className="px-4 py-2 text-right text-xs font-bold text-gray-400 uppercase">Qtd</th>
                      <th className="px-4 py-2 text-right text-xs font-bold text-gray-400 uppercase">Valor Unit.</th>
                      <th className="px-4 py-2 text-right text-xs font-bold text-gray-400 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {p.orcamento.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-700">{item.description}</td>
                        <td className="px-4 py-2.5 text-center text-gray-500 uppercase text-xs">{item.unit}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{item.quantity}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{formatCurrency(item.unitPrice)}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-[var(--brand-dark)]">{formatCurrency(item.quantity * item.unitPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-200">
                    <tr>
                      <td colSpan={4} className="px-4 py-2.5 text-right font-bold text-sm text-[var(--brand-dark)]">Total</td>
                      <td className="px-4 py-2.5 text-right font-black text-[var(--brand-dark)]">{formatCurrency(totalOrcamento)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Revisions */}
          {p.revisions.length > 0 && (
            <div className="bg-white border border-gray-100 p-5">
              <h2 className="font-bold text-[var(--brand-dark)] text-xs uppercase tracking-widest mb-4 pb-2 border-b border-gray-100">
                Histórico de Revisões ({p.revisions.length})
              </h2>
              <div className="space-y-3">
                {[...p.revisions].reverse().map((rev) => (
                  <div key={rev.id} className="flex gap-3 p-3 bg-gray-50">
                    <div className="flex items-center justify-center w-12 h-8 bg-[var(--brand-yellow)] text-[var(--brand-dark)] font-black text-xs shrink-0">
                      {rev.version}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-medium text-[var(--brand-dark)]">{rev.changes}</p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><Clock size={10} /> {new Date(rev.date).toLocaleDateString("pt-BR")}</span>
                        <span>por {rev.author}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Client */}
          <div className="bg-[var(--brand-dark)] p-5">
            <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-3">Cliente</p>
            <p className="text-white font-bold">{p.clientName}</p>
            <div className="mt-3 space-y-2">
              <a href={`tel:${p.clientPhone}`} className="flex items-center gap-2 w-full bg-white/10 hover:bg-[var(--brand-yellow)] hover:text-[var(--brand-dark)] text-gray-300 font-bold text-xs uppercase tracking-wider py-2 px-3 transition-colors">
                <Phone size={14} /> {p.clientPhone}
              </a>
              <a href={`mailto:${p.clientEmail}`} className="flex items-center gap-2 w-full bg-white/10 hover:bg-[var(--brand-yellow)] hover:text-[var(--brand-dark)] text-gray-300 font-bold text-xs uppercase tracking-wider py-2 px-3 transition-colors">
                <Mail size={14} /> E-mail
              </a>
            </div>
          </div>

          {/* Info */}
          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Informações</p>
            {[
              { label: "Tipo", value: `${tipo.icon} ${tipo.label}` },
              { label: "Engenheiro", value: p.engineer },
              { label: "Endereço", value: p.address },
              p.area ? { label: "Área", value: `${p.area} m²` } : null,
              { label: "Iniciado em", value: new Date(p.startDate).toLocaleDateString("pt-BR") },
              p.deliveryDate ? { label: "Previsão entrega", value: new Date(p.deliveryDate).toLocaleDateString("pt-BR") } : null,
              p.actualDelivery ? { label: "Entregue em", value: new Date(p.actualDelivery).toLocaleDateString("pt-BR") } : null,
              p.artNumber ? { label: "ART/RRT nº", value: p.artNumber } : null,
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
              { label: "Valor contratado", value: formatCurrency(p.projectValue), color: "text-[var(--brand-dark)]" },
              { label: "Pago", value: formatCurrency(p.paidValue), color: "text-green-600" },
              { label: "A receber", value: formatCurrency(p.projectValue - p.paidValue), color: p.projectValue - p.paidValue > 0 ? "text-orange-500" : "text-gray-400" },
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
