import { transacaoCRM, type TransacaoCRM } from "@/lib/crm/vinculo-lead";
import { motivoBloqueioExclusao, type DependenciasExclusao, type ModuloExclusao } from "@/lib/exclusao";

// 10 implementações, item 03 — exclusão definitiva (serviços do CRM, estudos, comissões).
// Remove o registro e o que só existe por causa dele; o lead/cliente fica.
// Com guarda obrigatória (financeiro, comissão, investidor), nada é apagado
// e a mensagem orienta a cancelar.

async function dependencias(tx: TransacaoCRM, modulo: ModuloExclusao, id: string): Promise<DependenciasExclusao | null> {
  switch (modulo) {
    case "obra": {
      const obra = await tx.obra.findUnique({ where: { id }, select: { id: true } });
      if (!obra) return null;
      const [movimentosFinanceiros, investidores, comissoes] = await Promise.all([
        tx.obraMovimento.count({ where: { obraId: id } }),
        tx.obraInvestidor.count({ where: { obraId: id } }),
        tx.comissao.count({ where: { tipoNegocio: "obra", negocioId: id } }),
      ]);
      return { movimentosFinanceiros, investidores, comissoes };
    }
    case "financiamento": {
      const fin = await tx.financiamento.findUnique({ where: { id }, select: { id: true } });
      if (!fin) return null;
      return { comissoes: await tx.comissao.count({ where: { tipoNegocio: "financiamento", negocioId: id } }) };
    }
    case "regularizacao": {
      const reg = await tx.regularizacao.findUnique({ where: { id }, select: { id: true } });
      if (!reg) return null;
      return { recebimentos: await tx.regularizacaoRecebimento.count({ where: { regularizacaoId: id } }) };
    }
    case "projeto": {
      const projeto = await tx.projeto.findUnique({ where: { id }, select: { valorPago: true } });
      if (!projeto) return null;
      return { valorPago: projeto.valorPago };
    }
    case "avaliacao": {
      const avaliacao = await tx.avaliacao.findUnique({ where: { id }, select: { id: true } });
      return avaliacao ? {} : null;
    }
    case "estudo": {
      const estudo = await tx.estudoIncorporacao.findUnique({ where: { id }, select: { id: true } });
      if (!estudo) return null;
      return { unidadesComercializadas: await tx.estudoUnidade.count({ where: { estudoId: id, status: { not: "disponivel" } } }) };
    }
    case "comissao": {
      const comissao = await tx.comissao.findUnique({ where: { id }, select: { status: true } });
      if (!comissao) return null;
      return { comissaoPaga: comissao.status === "paga" };
    }
  }
}

async function apagar(tx: TransacaoCRM, modulo: ModuloExclusao, id: string): Promise<string | null> {
  switch (modulo) {
    case "obra": {
      const { servicoLeadId } = await tx.obra.findUniqueOrThrow({ where: { id }, select: { servicoLeadId: true } });
      // Fotos guardam os bytes em `arquivos`; apagar o arquivo apaga a foto.
      const fotos = await tx.obraFoto.findMany({ where: { obraId: id }, select: { arquivoId: true } });
      if (fotos.length) await tx.arquivo.deleteMany({ where: { id: { in: fotos.map((f) => f.arquivoId) } } });
      await tx.obra.delete({ where: { id } }); // etapas, diário e progresso saem em cascata
      return servicoLeadId;
    }
    case "financiamento": {
      const { servicoLeadId } = await tx.financiamento.findUniqueOrThrow({ where: { id }, select: { servicoLeadId: true } });
      await tx.financiamento.delete({ where: { id } }); // checklist sai em cascata
      return servicoLeadId;
    }
    case "regularizacao": {
      const { servicoLeadId } = await tx.regularizacao.findUniqueOrThrow({ where: { id }, select: { servicoLeadId: true } });
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
      // Unidades só disponíveis (sem comprador), seus eventos e as referências de
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
 * Exclui definitivamente. Lança erro com a explicação quando a exclusão é
 * impedida. Registro inexistente (já excluído) não é erro: a operação é idempotente.
 */
export async function excluirServicoDefinitivo(modulo: ModuloExclusao, id: string): Promise<{ excluido: boolean }> {
  if (!id || id.length > 100) throw new Error("Registro inválido.");
  return transacaoCRM(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`excluir:${modulo}:${id}`}))`;
    const deps = await dependencias(tx, modulo, id);
    if (!deps) return { excluido: false };
    const bloqueio = motivoBloqueioExclusao(modulo, deps);
    if (bloqueio) throw new Error(bloqueio);
    const servicoLeadId = await apagar(tx, modulo, id);
    // O vínculo de serviço só existia para este registro; o lead permanece.
    if (servicoLeadId) await tx.servicoLead.deleteMany({ where: { id: servicoLeadId } });
    return { excluido: true };
  });
}
