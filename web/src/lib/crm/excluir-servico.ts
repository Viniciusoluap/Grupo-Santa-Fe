import { transacaoCRM, type TransacaoCRM } from "@/lib/crm/vinculo-lead";
import type { ModuloExclusao } from "@/lib/exclusao";

// Exclusão definitiva (item 03 + pedido A6; mesma regra da Prospecta:
// server/exclusao-definitiva.ts). Remove o registro e tudo o que só existe por
// causa dele (lançamentos, comissões, aportes, unidades); o lead/cliente fica.

async function existe(tx: TransacaoCRM, modulo: ModuloExclusao, id: string): Promise<boolean> {
  const sel = { where: { id }, select: { id: true } } as const;
  switch (modulo) {
    case "obra": return Boolean(await tx.obra.findUnique(sel));
    case "financiamento": return Boolean(await tx.financiamento.findUnique(sel));
    case "regularizacao": return Boolean(await tx.regularizacao.findUnique(sel));
    case "projeto": return Boolean(await tx.projeto.findUnique(sel));
    case "avaliacao": return Boolean(await tx.avaliacao.findUnique(sel));
    case "estudo": return Boolean(await tx.estudoIncorporacao.findUnique(sel));
    case "comissao": return Boolean(await tx.comissao.findUnique(sel));
  }
}

async function apagar(tx: TransacaoCRM, modulo: ModuloExclusao, id: string): Promise<string | null> {
  switch (modulo) {
    case "obra": {
      const { servicoLeadId } = await tx.obra.findUniqueOrThrow({ where: { id }, select: { servicoLeadId: true } });
      // Fotos guardam os bytes em `arquivos`; apagar o arquivo apaga a foto.
      const fotos = await tx.obraFoto.findMany({ where: { obraId: id }, select: { arquivoId: true } });
      if (fotos.length) await tx.arquivo.deleteMany({ where: { id: { in: fotos.map((f) => f.arquivoId) } } });
      // Pedido A6: lançamentos e comissões da obra saem junto (histórico em cascata).
      await tx.obraMovimento.deleteMany({ where: { obraId: id } });
      await tx.comissao.deleteMany({ where: { tipoNegocio: "obra", negocioId: id } });
      await tx.obra.delete({ where: { id } }); // etapas, diário, progresso e aportes saem em cascata
      return servicoLeadId;
    }
    case "financiamento": {
      const { servicoLeadId } = await tx.financiamento.findUniqueOrThrow({ where: { id }, select: { servicoLeadId: true } });
      await tx.comissao.deleteMany({ where: { tipoNegocio: "financiamento", negocioId: id } });
      // Documentos enviados pelo cliente no checklist guardam os bytes em `arquivos`.
      const docs = await tx.checklistItem.findMany({ where: { financiamentoId: id, arquivoId: { not: null } }, select: { arquivoId: true } });
      const arquivos = docs.map((d) => d.arquivoId).filter((a): a is string => Boolean(a));
      if (arquivos.length) await tx.arquivo.deleteMany({ where: { id: { in: arquivos } } });
      await tx.financiamento.delete({ where: { id } }); // checklist sai em cascata
      return servicoLeadId;
    }
    case "regularizacao": {
      const { servicoLeadId } = await tx.regularizacao.findUniqueOrThrow({ where: { id }, select: { servicoLeadId: true } });
      await tx.regularizacaoRecebimento.deleteMany({ where: { regularizacaoId: id } });
      await tx.regularizacao.delete({ where: { id } }); // etapas, itens e documentos saem em cascata
      return servicoLeadId;
    }
    case "projeto": {
      const { servicoLeadId } = await tx.projeto.findUniqueOrThrow({ where: { id }, select: { servicoLeadId: true } });
      await tx.projeto.delete({ where: { id } });
      return servicoLeadId;
    }
    case "avaliacao": {
      const { servicoLeadId } = await tx.avaliacao.findUniqueOrThrow({ where: { id }, select: { servicoLeadId: true } });
      await tx.avaliacao.delete({ where: { id } });
      return servicoLeadId;
    }
    case "estudo": {
      // Unidades (inclusive vendidas/reservadas), seus eventos e as referências de
      // documentos; os bytes guardados no banco saem junto. Arquivos no Drive ficam lá.
      await tx.estudoUnidadeEvento.deleteMany({ where: { unidade: { estudoId: id } } });
      await tx.estudoUnidade.deleteMany({ where: { estudoId: id } });
      const docs = await tx.estudoDocumentoRegistro.findMany({ where: { estudoId: id }, select: { arquivoId: true } });
      await tx.estudoDocumentoRegistro.deleteMany({ where: { estudoId: id } });
      const arquivos = docs.map((d) => d.arquivoId).filter((a): a is string => Boolean(a));
      if (arquivos.length) await tx.arquivo.deleteMany({ where: { id: { in: arquivos } } });
      await tx.estudoIncorporacao.delete({ where: { id } });
      return null;
    }
    case "comissao": {
      await tx.comissao.delete({ where: { id } });
      return null;
    }
  }
}

/**
 * Exclui definitivamente o registro e tudo o que só existe por causa dele.
 * Registro inexistente (já excluído) não é erro: a operação é idempotente.
 */
export async function excluirServicoDefinitivo(modulo: ModuloExclusao, id: string): Promise<{ excluido: boolean }> {
  if (!id || id.length > 100) throw new Error("Registro inválido.");
  return transacaoCRM(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`excluir:${modulo}:${id}`}))`;
    if (!(await existe(tx, modulo, id))) return { excluido: false };
    const servicoLeadId = await apagar(tx, modulo, id);
    // O vínculo de serviço só existia para este registro; o lead permanece.
    if (servicoLeadId) await tx.servicoLead.deleteMany({ where: { id: servicoLeadId } });
    return { excluido: true };
  });
}
