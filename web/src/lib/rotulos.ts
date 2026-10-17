// Pedido de 18/10 (item 16): nenhuma tela mostra código interno em inglês ou
// com sublinhado ("planning", "lead new", "pre analise"). Dicionário único dos
// códigos que chegam às telas; o que não estiver aqui cai no tratamento
// genérico (sem sublinhado, primeira letra maiúscula).
// Mesmo arquivo em Prospecta/shared/rotulos.ts (as fontes de cada domínio são as do Santa Fé).

import { LEAD_STAGES, LEAD_STAGE_CONFIG } from "@/lib/types/crm";
import { OBRA_STATUS_CONFIG } from "@/lib/types/obra";
import { BANCO_CONFIG, STATUS_CONFIG, TIPO_CONFIG } from "@/lib/types/financiamento";

const titulo = (texto: string) => texto.charAt(0) + texto.slice(1).toLowerCase();

const GENERICOS: Record<string, string> = {
  // Situações genéricas (etapas, pagamentos, conversões, revisão).
  pending: "Pendente",
  in_progress: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
  confirmed: "Confirmado",
  failed: "Falhou",
  chargeback: "Estornado",
  active: "Ativo",
  inactive: "Inativo",
  draft: "Rascunho",
  approved: "Aprovado",
  rejected: "Recusado",
  pendente: "Pendente",
  solicitado: "Assinatura solicitada",
  assinado: "Assinado",
  em_assinatura: "Em assinatura",
  aguardando_assinatura: "Aguardando assinatura",
  recusado: "Recusado",
  aprovado: "Aprovado",
  aprovada: "Aprovada",
  paga: "Paga",
  cancelada: "Cancelada",
  cancelado: "Cancelado",
  // Visitas.
  agendada: "Agendada",
  confirmada: "Confirmada",
  realizada: "Realizada",
  imovel: "Imóvel",
  lote: "Lote",
  obra: "Obra",
  escritorio: "Escritório",
  regularizacao: "Regularização",
  avaliacao: "Avaliação",
  financiamento: "Financiamento",
  terreno: "Terreno",
  reuniao: "Reunião",
  outro: "Outro",
  // Projetos.
  orcamento: "Orçamento",
  em_elaboracao: "Em elaboração",
  revisao: "Revisão",
  entregue: "Entregue",
  // Comissões.
  corretor: "Corretor",
  empresa: "Empresa",
  // Tipos de imóvel.
  casa: "Casa",
  apartamento: "Apartamento",
  sala_comercial: "Sala comercial",
  galpao: "Galpão",
  // Atividades do lead.
  message: "Mensagem",
  call: "Ligação",
  document: "Documento",
  status_change: "Mudança de etapa",
  note: "Anotação",
  handoff: "Transferência",
  follow_up: "Acompanhamento",
  simulation: "Simulação",
  caixa_register: "Cadastro Caixa",
  new_lead: "Novo lead",
  // Contratos.
  compra_venda: "Compra e venda",
  locacao: "Locação",
  prestacao_servico: "Prestação de serviço",
  empreitada: "Empreitada",
  construcao: "Construção",
  prestacao_servicos: "Prestação de serviços",
  corretagem: "Corretagem",
  permuta: "Permuta",
  consultoria_juridica: "Consultoria jurídica",
  rascunho: "Rascunho",
  ativo: "Ativo",
  vencido: "Vencido",
  concluido: "Concluído",
  rejeitado: "Recusado",
  contrato_gerado: "Contrato gerado",
  anexo: "Anexo",
  // Documentos do lead.
  requested: "Solicitado",
  received: "Recebido",
  uploaded: "Enviado",
  validated: "Validado",
};

// Os rótulos de cada domínio prevalecem sobre os genéricos.
const ROTULOS: Record<string, string> = {
  ...GENERICOS,
  ...Object.fromEntries(LEAD_STAGES.map((s) => [s, titulo(LEAD_STAGE_CONFIG[s].label)])),
  ...Object.fromEntries(Object.entries(OBRA_STATUS_CONFIG).map(([k, v]) => [k, v.label])),
  ...Object.fromEntries(Object.entries(STATUS_CONFIG).map(([k, v]) => [k, v.label])),
  ...Object.fromEntries(Object.entries(TIPO_CONFIG).map(([k, v]) => [k, v.label])),
  ...Object.fromEntries(Object.entries(BANCO_CONFIG).map(([k, v]) => [k, v.label])),
  analise_credito: "Análise de crédito",
};

/** Nome em português de um código interno; nunca devolve o código cru com "_". */
export function rotulo(codigo: string | null | undefined): string {
  if (!codigo) return "—";
  const conhecido = ROTULOS[codigo];
  if (conhecido) return conhecido;
  const texto = codigo.replaceAll("_", " ").trim();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
