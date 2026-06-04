import { Plus, Phone, MessageSquare } from "lucide-react";

const leads = [
  { id: 1, name: "Carlos Mendes", phone: "(62) 9 8765-4321", email: "carlos@email.com", service: "Financiamento MCMV", status: "Novo", source: "Site", created: "04/06/2026 08:15" },
  { id: 2, name: "Ana Paula Santos", phone: "(62) 9 9876-5432", email: "ana@email.com", service: "Compra de imóvel", status: "Em contato", source: "WhatsApp", created: "04/06/2026 07:30" },
  { id: 3, name: "Roberto Lima", phone: "(62) 9 7654-3210", email: "roberto@email.com", service: "Avaliação de imóvel", status: "Visita agendada", source: "Indicação", created: "03/06/2026 16:45" },
  { id: 4, name: "Fernanda Costa", phone: "(62) 9 6543-2109", email: "fernanda@email.com", service: "Regularização imobiliária", status: "Proposta enviada", source: "Site", created: "03/06/2026 14:20" },
  { id: 5, name: "Marcos Oliveira", phone: "(62) 9 5432-1098", email: "marcos@email.com", service: "Obra e reforma", status: "Novo", source: "Instagram", created: "03/06/2026 11:10" },
  { id: 6, name: "Juliana Ferreira", phone: "(62) 9 4321-0987", email: "juliana@email.com", service: "Compra de lote", status: "Negociação", source: "Site", created: "02/06/2026 15:30" },
  { id: 7, name: "Pedro Alves", phone: "(62) 9 3210-9876", email: "pedro@email.com", service: "Financiamento MCMV", status: "Ganho", source: "WhatsApp", created: "01/06/2026 09:00" },
  { id: 8, name: "Luciana Rocha", phone: "(62) 9 2109-8765", email: "luciana@email.com", service: "Compra de apartamento", status: "Perdido", source: "Indicação", created: "30/05/2026 14:00" },
];

const statusConfig: Record<string, { color: string; order: number }> = {
  "Novo": { color: "bg-[var(--brand-yellow)] text-[var(--brand-dark)]", order: 0 },
  "Em contato": { color: "bg-blue-100 text-blue-700", order: 1 },
  "Visita agendada": { color: "bg-purple-100 text-purple-700", order: 2 },
  "Proposta enviada": { color: "bg-orange-100 text-orange-700", order: 3 },
  "Negociação": { color: "bg-amber-100 text-amber-700", order: 4 },
  "Ganho": { color: "bg-green-100 text-green-700", order: 5 },
  "Perdido": { color: "bg-red-100 text-red-500", order: 6 },
};

const statusCounts = leads.reduce((acc, l) => {
  acc[l.status] = (acc[l.status] ?? 0) + 1;
  return acc;
}, {} as Record<string, number>);

export default function AdminLeadsPage() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">
            Leads
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {leads.length} leads no total
          </p>
        </div>
        <button className="flex items-center gap-1.5 bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-4 py-2.5 transition-colors">
          <Plus size={14} />
          Novo Lead
        </button>
      </div>

      {/* Status funnel */}
      <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
        {Object.entries(statusConfig)
          .sort(([, a], [, b]) => a.order - b.order)
          .map(([status, { color }]) => (
            <div key={status} className="bg-white border border-gray-100 p-3 text-center">
              <p className="font-black text-[var(--brand-dark)] text-xl">
                {statusCounts[status] ?? 0}
              </p>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 uppercase inline-block mt-1 ${color}`}>
                {status}
              </span>
            </div>
          ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wide">
          Lista de Leads
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--brand-dark)] text-xs">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-gray-400 uppercase tracking-wide">Nome</th>
                <th className="px-4 py-3 text-left font-bold text-gray-400 uppercase tracking-wide hidden md:table-cell">Serviço</th>
                <th className="px-4 py-3 text-left font-bold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Origem</th>
                <th className="px-4 py-3 text-left font-bold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Data</th>
                <th className="px-4 py-3 text-center font-bold text-gray-400 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-center font-bold text-gray-400 uppercase tracking-wide">Contato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--brand-dark)]">{lead.name}</p>
                    <p className="text-xs text-gray-400">{lead.email}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-sm text-gray-500">
                    {lead.service}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5">
                      {lead.source}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-400">
                    {lead.created}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-[10px] font-bold px-2 py-0.5 uppercase ${statusConfig[lead.status]?.color ?? "bg-gray-100 text-gray-500"}`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <a
                        href={`tel:${lead.phone}`}
                        title="Ligar"
                        className="p-1.5 text-gray-400 hover:text-[var(--brand-dark)] hover:bg-gray-100 transition-colors"
                      >
                        <Phone size={13} />
                      </a>
                      <a
                        href={`https://wa.me/55${lead.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="WhatsApp"
                        className="p-1.5 text-gray-400 hover:text-green-500 hover:bg-green-50 transition-colors"
                      >
                        <MessageSquare size={13} />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
