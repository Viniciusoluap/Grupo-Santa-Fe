// Funcao pura que decide quais destinatarios de um envio de WhatsApp sao
// legitimos: o lead precisa existir no banco e, para role="corretor", precisar
// pertencer a ele. Extraida de src/app/api/whatsapp/enviar/route.ts para ser
// testavel sem banco. O telefone/nome retornados sempre vem do lead encontrado,
// nunca do destinatario original (que e' controlado pelo cliente da requisicao).
export interface DestinatarioBruto {
  leadId?: string;
}

export interface LeadParaEnvio {
  id: string;
  nome: string;
  telefone: string;
  corretorId: string | null;
}

export interface DestinatarioValidado {
  telefone: string;
  nome: string;
  leadId: string;
}

export function filtrarDestinatariosValidos(
  destinatarios: DestinatarioBruto[],
  leadsEncontrados: LeadParaEnvio[],
  role: string | undefined,
  corretorIdDaSessao: string | undefined,
): DestinatarioValidado[] {
  const leadsPorId = new Map(leadsEncontrados.map((l) => [l.id, l]));
  const validados: DestinatarioValidado[] = [];

  for (const dest of destinatarios) {
    if (!dest.leadId) continue;
    const lead = leadsPorId.get(dest.leadId);
    if (!lead) continue;
    if (role === "corretor" && lead.corretorId !== corretorIdDaSessao) continue;
    validados.push({ telefone: lead.telefone, nome: lead.nome, leadId: lead.id });
  }

  return validados;
}
