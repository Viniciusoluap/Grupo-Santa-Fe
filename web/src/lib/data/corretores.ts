import { Corretor } from "@/lib/types/corretor";

export const corretores: Corretor[] = [
  {
    id: "c1",
    name: "João Santos",
    creci: "CRECI-GO 0001",
    phone: "(62) 9 9999-1111",
    email: "joao@gruposantafe.com.br",
    active: true,
    hireDate: "2021-03-15",
    specialties: ["Compra e Venda", "Financiamento MCMV", "Lotes"],
    leadsCount: 18,
    closedDeals: 5,
    conversionRate: 27.8,
    commissions: [
      { id: "cm1", type: "venda", property: "Residencial Jardim Novo", client: "Carlos Mendes", saleValue: 350000, rate: 3, amount: 10500, status: "paga", dueDate: "2026-01-15", paidAt: "2026-01-20" },
      { id: "cm2", type: "venda", property: "Casa Setor Bueno", client: "Ana Paula Lima", saleValue: 420000, rate: 3, amount: 12600, status: "aprovada", dueDate: "2026-02-28" },
      { id: "cm3", type: "captacao", property: "Lote Jardim América", client: "Proprietário Silva", saleValue: 180000, rate: 1.5, amount: 2700, status: "pendente", dueDate: "2026-03-15" },
      { id: "cm4", type: "venda", property: "Apto Alto da Glória", client: "Roberto Alves", saleValue: 290000, rate: 3, amount: 8700, status: "paga", dueDate: "2025-11-30", paidAt: "2025-12-05" },
      { id: "cm5", type: "indicacao", property: "Ref. Financiamento MCMV", client: "Fernanda Costa", saleValue: 150000, rate: 1, amount: 1500, status: "paga", dueDate: "2025-12-20", paidAt: "2025-12-22" },
    ],
    monthlyTargets: [
      { month: "2026-01", target: 15000, achieved: 10500 },
      { month: "2026-02", target: 15000, achieved: 12600 },
      { month: "2026-03", target: 15000, achieved: 2700 },
      { month: "2026-04", target: 15000, achieved: 0 },
      { month: "2026-05", target: 15000, achieved: 0 },
      { month: "2026-06", target: 15000, achieved: 0 },
    ],
  },
  {
    id: "c2",
    name: "Maria Oliveira",
    creci: "CRECI-GO 0002",
    phone: "(62) 9 9999-2222",
    email: "maria@gruposantafe.com.br",
    active: true,
    hireDate: "2020-07-01",
    specialties: ["Compra e Venda", "Imóveis de Alto Padrão", "Locação"],
    leadsCount: 24,
    closedDeals: 7,
    conversionRate: 29.2,
    commissions: [
      { id: "cm6", type: "venda", property: "Cobertura Setor Marista", client: "Grupo Invest", saleValue: 890000, rate: 3, amount: 26700, status: "paga", dueDate: "2026-01-10", paidAt: "2026-01-15" },
      { id: "cm7", type: "venda", property: "Casa Jardim Goiás", client: "Marco Vieira", saleValue: 560000, rate: 3, amount: 16800, status: "aprovada", dueDate: "2026-02-20" },
      { id: "cm8", type: "locacao", property: "Sala Comercial Centro", client: "Empresa XYZ", saleValue: 48000, rate: 5, amount: 2400, status: "paga", dueDate: "2026-01-31", paidAt: "2026-02-01" },
      { id: "cm9", type: "venda", property: "Lote Alphaville Goiás", client: "Marcelo Lima", saleValue: 320000, rate: 3, amount: 9600, status: "pendente", dueDate: "2026-03-30" },
    ],
    monthlyTargets: [
      { month: "2026-01", target: 20000, achieved: 29100 },
      { month: "2026-02", target: 20000, achieved: 16800 },
      { month: "2026-03", target: 20000, achieved: 9600 },
      { month: "2026-04", target: 20000, achieved: 0 },
      { month: "2026-05", target: 20000, achieved: 0 },
      { month: "2026-06", target: 20000, achieved: 0 },
    ],
  },
  {
    id: "c3",
    name: "Ana Lima",
    creci: "CRECI-GO 0003",
    phone: "(62) 9 9999-3333",
    email: "ana@gruposantafe.com.br",
    active: true,
    hireDate: "2022-01-10",
    specialties: ["Financiamento Habitacional", "MCMV", "Regularização"],
    leadsCount: 12,
    closedDeals: 3,
    conversionRate: 25.0,
    commissions: [
      { id: "cm10", type: "venda", property: "Cond. Parque das Flores", client: "Beatriz Santos", saleValue: 210000, rate: 3, amount: 6300, status: "paga", dueDate: "2026-02-15", paidAt: "2026-02-18" },
      { id: "cm11", type: "venda", property: "Casa MCMV Bairro Novo", client: "José Pereira", saleValue: 185000, rate: 3, amount: 5550, status: "aprovada", dueDate: "2026-03-10" },
      { id: "cm12", type: "indicacao", property: "Ref. Regularização", client: "Sra. Ferreira", saleValue: 45000, rate: 2, amount: 900, status: "paga", dueDate: "2025-12-30", paidAt: "2026-01-02" },
    ],
    monthlyTargets: [
      { month: "2026-01", target: 10000, achieved: 900 },
      { month: "2026-02", target: 10000, achieved: 6300 },
      { month: "2026-03", target: 10000, achieved: 5550 },
      { month: "2026-04", target: 10000, achieved: 0 },
      { month: "2026-05", target: 10000, achieved: 0 },
      { month: "2026-06", target: 10000, achieved: 0 },
    ],
  },
  {
    id: "c4",
    name: "Pedro Souza",
    creci: "CRECI-GO 0004",
    phone: "(62) 9 9999-4444",
    email: "pedro@gruposantafe.com.br",
    active: false,
    hireDate: "2023-05-20",
    specialties: ["Lotes", "Compra e Venda"],
    leadsCount: 8,
    closedDeals: 2,
    conversionRate: 25.0,
    commissions: [
      { id: "cm13", type: "venda", property: "Lote Industrial", client: "Indústria ABC", saleValue: 280000, rate: 3, amount: 8400, status: "paga", dueDate: "2025-10-15", paidAt: "2025-10-20" },
      { id: "cm14", type: "venda", property: "Lote Residencial SUL", client: "João Neto", saleValue: 120000, rate: 3, amount: 3600, status: "paga", dueDate: "2025-11-20", paidAt: "2025-11-25" },
    ],
    monthlyTargets: [
      { month: "2025-10", target: 8000, achieved: 8400 },
      { month: "2025-11", target: 8000, achieved: 3600 },
      { month: "2025-12", target: 8000, achieved: 0 },
    ],
  },
];

export function getCorretorById(id: string) {
  return corretores.find((c) => c.id === id);
}

export function getTotalCommissions(corretorId: string) {
  const c = getCorretorById(corretorId);
  if (!c) return 0;
  return c.commissions.reduce((sum, cm) => sum + (cm.status !== "cancelada" ? cm.amount : 0), 0);
}

export function getPendingCommissions(corretorId: string) {
  const c = getCorretorById(corretorId);
  if (!c) return 0;
  return c.commissions
    .filter((cm) => cm.status === "pendente" || cm.status === "aprovada")
    .reduce((sum, cm) => sum + cm.amount, 0);
}
