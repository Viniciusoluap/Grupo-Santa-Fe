// Lote 23/10, etapa 6 — grava a duplicação do lead (servidor). Regras em
// lead-duplicar.ts; gêmeo de Prospecta/server/lead-duplicar.ts.
import type { TransacaoCRM } from "@/lib/crm/vinculo-lead";
import { MODELO_NOTA_LEAD_NOVO, MODELO_NOTA_LEAD_ORIGEM, preencherModelo } from "@/lib/crm/lead-duplicar";

/**
 * Dentro de uma transação: cria o lead novo (dados e informações; etapa e andamento
 * reiniciados; sem serviços, sem senha/conta do portal) e copia os documentos do
 * checklist apontando para o MESMO arquivo (nunca apagado por nenhum fluxo).
 * Solicitações (datas de pedido/e-mail) e versões antigas não são copiadas.
 */
export async function duplicarLeadNoBanco(tx: TransacaoCRM, leadId: string, ator: { id: string; nome: string }) {
  const o = await tx.lead.findUnique({ where: { id: leadId } });
  if (!o || o.excluidoEm) throw new Error("Lead não encontrado ou excluído.");
  const novo = await tx.lead.create({
    data: {
      nome: o.nome, telefone: o.telefone, email: o.email, cpf: o.cpf,
      servico: "[]",
      temperatura: o.temperatura, origem: o.origem, corretorId: o.corretorId, responsavelId: o.responsavelId,
      imovelInteresseId: o.imovelInteresseId, orcamento: o.orcamento, valorAprovado: o.valorAprovado, notas: o.notas,
      status: "novo",
      duplicadoDeId: o.id, duplicadoEm: new Date(), duplicadoPorId: ator.id,
    },
    select: { id: true },
  });
  const docs = await tx.documentoCliente.findMany({ where: { leadId } });
  if (docs.length)
    await tx.documentoCliente.createMany({
      data: docs.map((d) => ({
        leadId: novo.id, tipo: d.tipo, visivelCliente: d.visivelCliente,
        arquivoId: d.arquivoId, enviadoEm: d.arquivoId ? d.enviadoEm : null, copiadoDeId: d.id,
      })),
    });
  const documentos = docs.filter((d) => d.arquivoId).length;
  await tx.interacao.createMany({
    data: [
      { leadId: novo.id, tipo: "nota", descricao: preencherModelo(MODELO_NOTA_LEAD_NOVO, o.id, o.nome, documentos), criadoPor: ator.nome },
      { leadId: o.id, tipo: "nota", descricao: preencherModelo(MODELO_NOTA_LEAD_ORIGEM, novo.id), criadoPor: ator.nome },
    ],
  });
  return { id: novo.id, documentos };
}
