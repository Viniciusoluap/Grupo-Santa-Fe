// Lista pura (usada no servidor e nas telas): módulos do painel do Santa Fé.
/** Módulos que o admin pode liberar para colaboradores (Configurações fica só com o admin). */
export const MODULOS_PAINEL = [
  { id: "leads", label: "Leads / CRM", rota: "/admin/leads" },
  { id: "imoveis", label: "Imóveis", rota: "/admin/imoveis" },
  { id: "agenda", label: "Agenda de Visitas", rota: "/admin/agenda" },
  { id: "obras", label: "Obras", rota: "/admin/obras" },
  { id: "projetos", label: "Projetos", rota: "/admin/projetos" },
  { id: "regularizacao", label: "Regularização", rota: "/admin/regularizacao" },
  { id: "financiamentos", label: "Financiamentos", rota: "/admin/financiamentos" },
  { id: "avaliacao", label: "Avaliações", rota: "/admin/avaliacoes" },
  { id: "incorporacao", label: "Incorporação", rota: "/admin/incorporacao" },
  { id: "comissoes", label: "Comissões", rota: "/admin/comissoes" },
  { id: "corretores", label: "Corretores", rota: "/admin/corretores" },
  { id: "bpo", label: "BPO Financeiro", rota: "/admin/bpo" },
  { id: "juridico", label: "Jurídico", rota: "/admin/juridico" },
  { id: "mapa", label: "Mapa", rota: "/admin/mapa" },
  { id: "whatsapp", label: "WhatsApp", rota: "/admin/whatsapp" },
] as const;

export const IDS_MODULOS_PAINEL: readonly string[] = MODULOS_PAINEL.map((m) => m.id);
