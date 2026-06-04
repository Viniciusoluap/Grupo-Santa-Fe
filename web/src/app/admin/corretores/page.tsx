import { Plus, Phone, TrendingUp, Building2, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const corretores = [
  { id: 1, name: "João Santos", creci: "CRECI-GO 0001", phone: "(62) 9 9999-1111", email: "joao@gruposantafe.com.br", leads: 18, sales: 5, revenue: 22500, active: true },
  { id: 2, name: "Maria Oliveira", creci: "CRECI-GO 0002", phone: "(62) 9 9999-2222", email: "maria@gruposantafe.com.br", leads: 24, sales: 7, revenue: 31500, active: true },
  { id: 3, name: "Ana Lima", creci: "CRECI-GO 0003", phone: "(62) 9 9999-3333", email: "ana@gruposantafe.com.br", leads: 12, sales: 3, revenue: 13500, active: true },
  { id: 4, name: "Pedro Souza", creci: "CRECI-GO 0004", phone: "(62) 9 9999-4444", email: "pedro@gruposantafe.com.br", leads: 8, sales: 2, revenue: 9000, active: false },
];

export default function AdminCorretoresPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">
            Corretores
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {corretores.filter((c) => c.active).length} ativos de {corretores.length} cadastrados
          </p>
        </div>
        <button className="flex items-center gap-1.5 bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-4 py-2.5 transition-colors">
          <Plus size={14} />
          Novo Corretor
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {corretores.map((c) => (
          <div
            key={c.id}
            className={`bg-white border p-5 ${c.active ? "border-gray-100" : "border-gray-100 opacity-60"}`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-11 h-11 bg-[var(--brand-yellow)] flex items-center justify-center">
                <span className="text-[var(--brand-dark)] font-black text-lg">
                  {c.name[0]}
                </span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 uppercase ${c.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {c.active ? "Ativo" : "Inativo"}
              </span>
            </div>

            <h3 className="font-bold text-[var(--brand-dark)] leading-tight">{c.name}</h3>
            <p className="text-gray-400 text-xs mt-0.5">{c.creci}</p>

            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-gray-400">
                  <Building2 size={11} /> Leads
                </span>
                <span className="font-bold text-[var(--brand-dark)]">{c.leads}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-gray-400">
                  <TrendingUp size={11} /> Vendas
                </span>
                <span className="font-bold text-[var(--brand-dark)]">{c.sales}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-gray-400">
                  <DollarSign size={11} /> Comissão
                </span>
                <span className="font-bold text-green-600">{formatCurrency(c.revenue)}</span>
              </div>
            </div>

            <a
              href={`tel:${c.phone}`}
              className="mt-4 flex items-center justify-center gap-1.5 w-full border border-gray-200 hover:border-[var(--brand-yellow)] text-gray-500 hover:text-[var(--brand-dark)] text-xs font-medium py-2 transition-colors"
            >
              <Phone size={12} /> {c.phone}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
