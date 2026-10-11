import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  dadosClienteDoLead,
  gerarNumeroAvaliacao,
  incluirServico,
  parseServicosLead,
  servicoDoModulo,
  servicosSemRegistro,
  type ModuloServico,
  type ServicoOperacional,
} from "./servicos-lead";
import { PAPEIS_RESPONSAVEL, podeSerResponsavel } from "./responsavel";

// Acesso a banco do vínculo real Lead ↔ serviços (EPIC-007). Chamado pelas
// server actions — não é "use server" (não deve ser exposto como endpoint).

export const CHECKLIST_FINANCIAMENTO_PADRAO = [
  // Documento do Comprador
  { grupo: "Comprador", item: "RG e CPF (cópia autenticada)" },
  { grupo: "Comprador", item: "Certidão de nascimento ou casamento" },
  { grupo: "Comprador", item: "Comprovante de residência (últimos 3 meses)" },
  { grupo: "Comprador", item: "Comprovante de renda (holerite ou IR)" },
  { grupo: "Comprador", item: "Extrato bancário (3 meses)" },
  { grupo: "Comprador", item: "CTPS ou contrato de trabalho" },
  // Documento do Imóvel
  { grupo: "Imóvel", item: "Matrícula atualizada do imóvel" },
  { grupo: "Imóvel", item: "Certidão de ônus e ações reais" },
  { grupo: "Imóvel", item: "IPTU (exercício atual)" },
  { grupo: "Imóvel", item: "Planta baixa aprovada" },
  { grupo: "Imóvel", item: "Habite-se ou auto de conclusão" },
  // Banco
  { grupo: "Banco", item: "Proposta de financiamento assinada" },
  { grupo: "Banco", item: "Laudo de avaliação do imóvel" },
  { grupo: "Banco", item: "Aprovação de crédito" },
  { grupo: "Banco", item: "Minuta do contrato assinada" },
];

const A_DEFINIR = "A definir";

/**
 * Carrega o lead que será vinculado a um serviço. O vínculo é obrigatório:
 * nenhum serviço operacional nasce sem cliente do CRM (sem cadastro avulso).
 */
export async function carregarLeadParaVinculo(leadId: string | null | undefined) {
  if (!leadId) throw new Error("Selecione um cliente (lead) já cadastrado no CRM.");
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, nome: true, telefone: true, email: true },
  });
  if (!lead) throw new Error("Lead não encontrado — selecione um cliente cadastrado no CRM.");
  return lead;
}

async function criarRegistro(
  lead: { id: string; nome: string; telefone: string; email: string | null },
  op: ServicoOperacional,
) {
  const cliente = dadosClienteDoLead(lead);
  switch (op.modulo) {
    case "financiamento": {
      const fin = await prisma.financiamento.create({
        data: {
          ...cliente,
          imovel: A_DEFINIR,
          tipo: op.tipoFinanciamento ?? "mcmv",
          banco: A_DEFINIR,
          valorImovel: 0,
          valorFinanciado: 0,
          entrada: 0,
          taxa: 0,
          prazo: 0,
          leadId: lead.id,
        },
      });
      await prisma.checklistItem.createMany({
        data: CHECKLIST_FINANCIAMENTO_PADRAO.map((c) => ({ financiamentoId: fin.id, ...c })),
      });
      return;
    }
    case "obra":
      await prisma.obra.create({
        data: {
          nome: `Obra — ${cliente.clienteNome}`,
          tipo: "reforma",
          clienteNome: cliente.clienteNome,
          clienteTel: cliente.clienteTel,
          endereco: A_DEFINIR,
          area: 0,
          valorTotal: 0,
          engenheiroResp: A_DEFINIR,
          leadId: lead.id,
        },
      });
      return;
    case "projeto":
      await prisma.projeto.create({
        data: {
          nome: `Projeto — ${cliente.clienteNome}`,
          tipo: JSON.stringify(["projeto_completo"]),
          clienteNome: cliente.clienteNome,
          clienteTel: cliente.clienteTel,
          engenheiro: A_DEFINIR,
          valorProjeto: 0,
          leadId: lead.id,
        },
      });
      return;
    case "regularizacao":
      await prisma.regularizacao.create({
        data: {
          nome: `Regularização — ${cliente.clienteNome}`,
          tipo: JSON.stringify(["regularizacao_escritura"]),
          clienteNome: cliente.clienteNome,
          clienteTel: cliente.clienteTel,
          endereco: A_DEFINIR,
          responsavel: A_DEFINIR,
          valorServico: 0,
          leadId: lead.id,
        },
      });
      return;
    case "avaliacao":
      await prisma.avaliacao.create({
        data: {
          numero: gerarNumeroAvaliacao(),
          tipo: "mercado",
          finalidade: "compra_venda",
          ...cliente,
          endereco: A_DEFINIR,
          bairro: A_DEFINIR,
          avaliador: A_DEFINIR,
          leadId: lead.id,
        },
      });
      return;
  }
}

/**
 * Garante que cada serviço operacional marcado no lead tenha um registro real
 * vinculado (com os dados do cliente já copiados). Idempotente — roda no
 * cadastro e em toda edição do lead, criando só o que falta.
 * Retorna quantos registros foram criados.
 */
export async function sincronizarServicosDoLead(leadId: string): Promise<number> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      nome: true,
      telefone: true,
      email: true,
      servico: true,
      financiamentos: { select: { tipo: true } },
      _count: { select: { obras: true, projetos: true, regularizacoes: true, avaliacoes: true } },
    },
  });
  if (!lead) return 0;

  const pendentes = servicosSemRegistro(parseServicosLead(lead.servico), {
    financiamentoTipos: lead.financiamentos.map((f) => f.tipo),
    obras: lead._count.obras,
    projetos: lead._count.projetos,
    regularizacoes: lead._count.regularizacoes,
    avaliacoes: lead._count.avaliacoes,
  });

  let criados = 0;
  for (const op of pendentes) {
    try {
      await criarRegistro(lead, op);
      criados++;
    } catch (err) {
      console.error(`Erro ao criar registro de ${op.modulo} para o lead ${lead.id}:`, err);
    }
  }
  return criados;
}

/**
 * Mantém os dados do cliente dos registros vinculados em sincronia com o lead
 * (fonte única). Chamado sempre que nome/telefone/e-mail do lead mudam.
 */
export async function propagarDadosClienteDoLead(lead: {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
}) {
  const c = dadosClienteDoLead(lead);
  const base = { clienteNome: c.clienteNome, clienteTel: c.clienteTel };
  await prisma.$transaction([
    prisma.financiamento.updateMany({ where: { leadId: lead.id }, data: { ...base, clienteEmail: c.clienteEmail } }),
    prisma.avaliacao.updateMany({ where: { leadId: lead.id }, data: { ...base, clienteEmail: c.clienteEmail } }),
    prisma.obra.updateMany({ where: { leadId: lead.id }, data: base }),
    prisma.projeto.updateMany({ where: { leadId: lead.id }, data: base }),
    prisma.regularizacao.updateMany({ where: { leadId: lead.id }, data: base }),
  ]);
}

/** Usuários reais (ativos, internos) que podem ser responsáveis por um lead. */
export async function listarResponsaveis() {
  return prisma.usuario.findMany({
    where: { ativo: true, papel: { in: [...PAPEIS_RESPONSAVEL] } },
    select: { id: true, nome: true, papel: true },
    orderBy: { nome: "asc" },
  });
}

/**
 * Valida o responsável vindo do formulário (nunca confiar no client): só
 * aceita usuário existente, ativo e com papel interno. Inválido → null.
 */
export async function resolverResponsavelId(id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  const usuario = await prisma.usuario.findUnique({ where: { id }, select: { papel: true, ativo: true } });
  return podeSerResponsavel(usuario) ? id : null;
}

/**
 * Dados do cliente para gravar num registro operacional na edição: se o
 * registro está vinculado a um lead, vêm SEMPRE do lead (fonte única); só
 * registros legados sem vínculo usam o que foi digitado no formulário.
 */
export async function clienteParaRegistro(leadId: string | null | undefined, formData: FormData) {
  if (leadId) {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { nome: true, telefone: true, email: true },
    });
    if (lead) return dadosClienteDoLead(lead);
  }
  return {
    clienteNome: (formData.get("clienteNome") as string) ?? "",
    clienteTel: (formData.get("clienteTel") as string) ?? "",
    clienteEmail: (formData.get("clienteEmail") as string) || null,
  };
}

/**
 * Serviço aberto direto no módulo (com lead selecionado) passa a constar
 * também no cadastro do lead — vínculo nos dois sentidos.
 */
export async function registrarServicoNoLead(
  leadId: string,
  modulo: ModuloServico,
  tipoFinanciamento?: string | null,
) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { servico: true } });
  if (!lead) return;
  const novos = incluirServico(parseServicosLead(lead.servico), servicoDoModulo(modulo, tipoFinanciamento));
  if (novos) await prisma.lead.update({ where: { id: leadId }, data: { servico: JSON.stringify(novos) } });
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin/leads");
  revalidatePath("/admin");
}
