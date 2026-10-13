import { prisma } from "@/lib/db";

export async function getPortalDashboard(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      imovelInteresse: { select: { titulo: true, bairro: true, cidade: true } },
      corretor: { select: { nome: true, telefone: true, email: true } },
      financiamentos: {
        orderBy: { criadoEm: "desc" },
        take: 1,
        select: { status: true, tipo: true, banco: true, valorFinanciado: true },
      },
      interacoes: {
        orderBy: { criadoEm: "desc" },
        take: 1,
        select: { descricao: true, criadoEm: true },
      },
    },
  });
  return lead;
}

export async function getPortalVisitas(leadId: string) {
  return prisma.visita.findMany({
    where: { leadId },
    orderBy: { agendadaPara: "desc" },
    include: {
      imovel: { select: { titulo: true, bairro: true } },
      corretor: { select: { nome: true } },
    },
  });
}

export async function getPortalInteracoes(leadId: string) {
  return prisma.interacao.findMany({
    where: { leadId },
    orderBy: { criadoEm: "desc" },
  });
}

export async function getPortalFinanciamentos(leadId: string) {
  return prisma.financiamento.findMany({
    where: { leadId },
    orderBy: { criadoEm: "desc" },
  });
}

export async function getPortalDocumentos(leadId: string) {
  return prisma.contrato.findMany({
    where: { leadId },
    orderBy: { criadoEm: "desc" },
    select: {
      id: true,
      numero: true,
      tipo: true,
      status: true,
      assinaturaStatus: true,
      criadoEm: true,
      documentos: {
        orderBy: { criadoEm: "desc" },
        select: { id: true, nome: true, url: true, tipo: true, criadoEm: true },
      },
    },
  });
}

/** A consulta é delimitada pelo lead da sessão; nunca recebe um id de obra da URL. */
export async function getPortalObras(leadId: string) {
  return prisma.obra.findMany({
    where: { leadId },
    orderBy: { criadoEm: "desc" },
    select: {
      id: true, nome: true, endereco: true, status: true, progresso: true,
      progressoMedido: true, dataPrevisaoFim: true,
      fotos: {
        orderBy: { tiradaEm: "desc" }, take: 6,
        select: { id: true, legenda: true, tiradaEm: true },
      },
    },
  });
}
