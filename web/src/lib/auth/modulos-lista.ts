// Lista pura (usada no servidor e nas telas): módulos do painel do Santa Fé.
/**
 * Módulos que o admin libera ao colaborador (pedido de 17/10/2026): as mesmas 15
 * opções e a mesma ordem do Painel Administrativo da Prospecta (lá há também o
 * Ecossistema de Sorteio, exclusivo dela). Configurações (Usuários e Acessos e
 * integrações) fica só com o admin. Os ids são os já gravados no banco.
 */
export const MODULOS_PAINEL = [
  { id: "leads", label: "CRM / Pipeline", rota: "/admin/leads" },
  { id: "obras", label: "Obras", rota: "/admin/obras" },
  { id: "agenda", label: "Tarefas e Agenda", rota: "/admin/agenda" },
  { id: "corretores", label: "Corretores", rota: "/admin/corretores" },
  { id: "regularizacao", label: "Regularizações", rota: "/admin/regularizacao" },
  { id: "comissoes", label: "Comissões", rota: "/admin/comissoes" },
  { id: "projetos", label: "Projetos", rota: "/admin/projetos" },
  { id: "mapa", label: "Mapa operacional", rota: "/admin/mapa" },
  { id: "avaliacao", label: "Avaliações", rota: "/admin/avaliacoes" },
  { id: "imoveis", label: "Imóveis", rota: "/admin/imoveis" },
  { id: "incorporacao", label: "Incorporação", rota: "/admin/incorporacao" },
  { id: "whatsapp", label: "WhatsApp", rota: "/admin/whatsapp" },
  { id: "bpo", label: "BPO Financeiro", rota: "/admin/bpo" },
  { id: "financiamentos", label: "Financiamentos", rota: "/admin/financiamentos" },
  { id: "juridico", label: "Jurídico", rota: "/admin/juridico" },
] as const;

export const IDS_MODULOS_PAINEL: readonly string[] = MODULOS_PAINEL.map((m) => m.id);
