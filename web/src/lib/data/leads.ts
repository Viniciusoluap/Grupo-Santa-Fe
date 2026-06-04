import { Lead } from "@/lib/types/crm";

export const leads: Lead[] = [
  {
    id: "1",
    name: "Carlos Mendes",
    phone: "(62) 9 8765-4321",
    email: "carlos@email.com",
    service: "Financiamento MCMV",
    status: "novo",
    source: "site",
    assignedTo: "João Santos",
    budget: 300000,
    notes: "Interessado em casa no Setor Bueno. Tem FGTS disponível.",
    interactions: [
      {
        id: "i1",
        type: "nota",
        description: "Lead chegou pelo formulário do site. Interesse em financiamento MCMV para casa de até R$ 300k.",
        createdAt: "2026-06-04T08:15:00",
        createdBy: "Sistema",
      },
    ],
    visits: [],
    createdAt: "2026-06-04T08:15:00",
    updatedAt: "2026-06-04T08:15:00",
  },
  {
    id: "2",
    name: "Ana Paula Santos",
    phone: "(62) 9 9876-5432",
    email: "ana@email.com",
    service: "Compra de imóvel",
    status: "contato",
    source: "whatsapp",
    assignedTo: "Maria Oliveira",
    budget: 450000,
    notes: "Quer apartamento com 3 quartos na região sul. Prefere Setor Bueno ou Marista.",
    interactions: [
      {
        id: "i2",
        type: "whatsapp",
        description: "Primeiro contato pelo WhatsApp. Cliente perguntou sobre aptos no Setor Bueno.",
        createdAt: "2026-06-04T07:30:00",
        createdBy: "Maria Oliveira",
      },
      {
        id: "i3",
        type: "ligacao",
        description: "Ligação de qualificação. Orçamento confirmado de até R$ 450k. Precisa de 3 quartos com suite.",
        createdAt: "2026-06-04T09:00:00",
        createdBy: "Maria Oliveira",
      },
    ],
    visits: [],
    createdAt: "2026-06-04T07:30:00",
    updatedAt: "2026-06-04T09:00:00",
  },
  {
    id: "3",
    name: "Roberto Lima",
    phone: "(62) 9 7654-3210",
    email: "roberto@email.com",
    service: "Compra de imóvel",
    status: "visita_agendada",
    source: "indicacao",
    assignedTo: "João Santos",
    propertyInterestId: "1",
    budget: 500000,
    notes: "Indicado pela família Ferreira. Quer casa com quintal.",
    interactions: [
      {
        id: "i4",
        type: "ligacao",
        description: "Primeiro contato. Indicação da família Ferreira. Interesse em casa com quintal.",
        createdAt: "2026-06-03T16:45:00",
        createdBy: "João Santos",
      },
      {
        id: "i5",
        type: "whatsapp",
        description: "Enviou fotos do imóvel GSF-0001. Cliente gostou. Agendou visita.",
        createdAt: "2026-06-03T17:30:00",
        createdBy: "João Santos",
      },
    ],
    visits: [
      {
        id: "v1",
        propertyId: "1",
        propertyTitle: "Casa 3 Quartos — Setor Bueno",
        scheduledAt: "2026-06-05T10:00:00",
        status: "agendada",
        notes: "Cliente vem com esposa. Chegar 10 min antes.",
      },
    ],
    createdAt: "2026-06-03T16:45:00",
    updatedAt: "2026-06-03T17:30:00",
  },
  {
    id: "4",
    name: "Fernanda Costa",
    phone: "(62) 9 6543-2109",
    email: "fernanda@email.com",
    service: "Regularização imobiliária",
    status: "proposta",
    source: "site",
    assignedTo: "Ana Lima",
    budget: 8000,
    notes: "Casa construída sem alvará. Precisa regularizar para vender.",
    interactions: [
      {
        id: "i6",
        type: "email",
        description: "Enviou documentos da propriedade. Verificou pendências na prefeitura.",
        createdAt: "2026-06-03T14:20:00",
        createdBy: "Ana Lima",
      },
      {
        id: "i7",
        type: "nota",
        description: "Proposta de regularização enviada por e-mail. Valor: R$ 6.500 + taxas municipais.",
        createdAt: "2026-06-03T16:00:00",
        createdBy: "Ana Lima",
      },
    ],
    visits: [],
    createdAt: "2026-06-03T14:20:00",
    updatedAt: "2026-06-03T16:00:00",
  },
  {
    id: "5",
    name: "Marcos Oliveira",
    phone: "(62) 9 5432-1098",
    email: "marcos@email.com",
    service: "Obra e reforma",
    status: "novo",
    source: "instagram",
    assignedTo: "João Santos",
    budget: 80000,
    notes: "Quer reformar cozinha e banheiros. Casa de 150m².",
    interactions: [
      {
        id: "i8",
        type: "nota",
        description: "Lead vindo pelo Instagram (stories). Mencionou reforma de cozinha e banheiros.",
        createdAt: "2026-06-03T11:10:00",
        createdBy: "Sistema",
      },
    ],
    visits: [],
    createdAt: "2026-06-03T11:10:00",
    updatedAt: "2026-06-03T11:10:00",
  },
  {
    id: "6",
    name: "Juliana Ferreira",
    phone: "(62) 9 4321-0987",
    email: "juliana@email.com",
    service: "Compra de lote",
    status: "negociacao",
    source: "site",
    assignedTo: "Maria Oliveira",
    propertyInterestId: "2",
    budget: 200000,
    notes: "Quer lote para construir casa própria. Prefere lote plano.",
    interactions: [
      {
        id: "i9",
        type: "visita",
        description: "Visita realizada ao lote GSF-0002 no Jardim Europa. Cliente gostou mas pediu desconto.",
        createdAt: "2026-06-02T15:30:00",
        createdBy: "Maria Oliveira",
      },
      {
        id: "i10",
        type: "ligacao",
        description: "Contra-proposta: cliente ofereceu R$ 165k. Proprietário aceitou R$ 172k. Aguardando confirmação.",
        createdAt: "2026-06-03T10:00:00",
        createdBy: "Maria Oliveira",
      },
    ],
    visits: [
      {
        id: "v2",
        propertyId: "2",
        propertyTitle: "Lote Residencial — Jardim Europa",
        scheduledAt: "2026-06-02T15:30:00",
        status: "realizada",
        notes: "Visita realizada com sucesso.",
      },
    ],
    createdAt: "2026-06-02T15:30:00",
    updatedAt: "2026-06-03T10:00:00",
  },
  {
    id: "7",
    name: "Pedro Alves",
    phone: "(62) 9 3210-9876",
    email: "pedro@email.com",
    service: "Financiamento MCMV",
    status: "ganho",
    source: "whatsapp",
    assignedTo: "João Santos",
    propertyInterestId: "7",
    budget: 310000,
    notes: "Negócio fechado! Casa no lançamento Vila Rosa.",
    interactions: [
      {
        id: "i11",
        type: "nota",
        description: "Contrato assinado. Financiamento aprovado pela Caixa Econômica. Entrega em 18 meses.",
        createdAt: "2026-06-01T09:00:00",
        createdBy: "João Santos",
      },
    ],
    visits: [],
    createdAt: "2026-05-20T09:00:00",
    updatedAt: "2026-06-01T09:00:00",
  },
  {
    id: "8",
    name: "Luciana Rocha",
    phone: "(62) 9 2109-8765",
    email: "luciana@email.com",
    service: "Compra de apartamento",
    status: "perdido",
    source: "indicacao",
    assignedTo: "Maria Oliveira",
    budget: 320000,
    notes: "Desistiu — comprou com outra imobiliária.",
    interactions: [
      {
        id: "i12",
        type: "nota",
        description: "Cliente informou que fechou negócio com outra imobiliária. Motivo: preço mais baixo.",
        createdAt: "2026-05-30T14:00:00",
        createdBy: "Maria Oliveira",
      },
    ],
    visits: [],
    createdAt: "2026-05-25T14:00:00",
    updatedAt: "2026-05-30T14:00:00",
  },
];

export function getLeadById(id: string): Lead | undefined {
  return leads.find((l) => l.id === id);
}

export function getLeadsByStatus(status: string): Lead[] {
  return leads.filter((l) => l.status === status);
}

export function getUpcomingVisits(): { lead: Lead; visit: (typeof leads[0]["visits"][0]) }[] {
  const result: { lead: Lead; visit: (typeof leads[0]["visits"][0]) }[] = [];
  for (const lead of leads) {
    for (const visit of lead.visits) {
      if (visit.status === "agendada") {
        result.push({ lead, visit });
      }
    }
  }
  return result.sort((a, b) =>
    new Date(a.visit.scheduledAt).getTime() - new Date(b.visit.scheduledAt).getTime()
  );
}
