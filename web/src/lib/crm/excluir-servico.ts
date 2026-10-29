import { transacaoCRM, type TransacaoCRM } from "@/lib/crm/vinculo-lead";
import type { ModuloExclusao } from "@/lib/exclusao";
import { chaveEstudo, chaveObra } from "@/lib/drive-estrutura";

/** Pedido de 29/10: o que vai para a lixeira do Drive depois da exclusão no banco. */
interface LixeiraDrive { pastas: string[]; arquivos: (string | null)[] }

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

async function apagar(tx: TransacaoCRM, modulo: ModuloExclusao, id: string, lixeira: LixeiraDrive): Promise<string | null> {
  switch (modulo) {
    case "obra": {
      const { servicoLeadId } = await tx.obra.findUniqueOrThrow({ where: { id }, select: { servicoLeadId: true } });
      lixeira.pastas.push(chaveObra(id));
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
      if (arquivos.length) {
        const noDrive = await tx.arquivo.findMany({ where: { id: { in: arquivos }, driveFileId: { not: null } }, select: { driveFileId: true } });
        lixeira.arquivos.push(...noDrive.map((a) => a.driveFileId));
        await tx.arquivo.deleteMany({ where: { id: { in: arquivos } } });
      }
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
      lixeira.pastas.push(`projeto-${id}`); // Portfólio de projetos (registro-drive.ts)
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
      // documentos; os bytes guardados no banco saem junto. A pasta do estudo no
      // Drive vai para a lixeira depois (pedido de 29/10).
      await tx.estudoUnidadeEvento.deleteMany({ where: { unidade: { estudoId: id } } });
      await tx.estudoUnidade.deleteMany({ where: { estudoId: id } });
      const docs = await tx.estudoDocumentoRegistro.findMany({ where: { estudoId: id }, select: { arquivoId: true } });
      await tx.estudoDocumentoRegistro.deleteMany({ where: { estudoId: id } });
      const arquivos = docs.map((d) => d.arquivoId).filter((a): a is string => Boolean(a));
      if (arquivos.length) await tx.arquivo.deleteMany({ where: { id: { in: arquivos } } });
      await tx.estudoIncorporacao.delete({ where: { id } });
      lixeira.pastas.push(chaveEstudo(id));
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
  const lixeira: LixeiraDrive = { pastas: [], arquivos: [] };
  const r = await transacaoCRM(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`excluir:${modulo}:${id}`}))`;
    if (!(await existe(tx, modulo, id))) return { excluido: false };
    const servicoLeadId = await apagar(tx, modulo, id, lixeira);
    // O vínculo de serviço só existia para este registro; o lead permanece.
    if (servicoLeadId) await tx.servicoLead.deleteMany({ where: { id: servicoLeadId } });
    return { excluido: true };
  });
  // Pedido de 29/10: depois do banco, pasta/arquivos para a lixeira do Drive (30 dias).
  // Falha no Drive não desfaz a exclusão: o sincronizador "Organizar Drive" resolve.
  if (r.excluido && (lixeira.pastas.length || lixeira.arquivos.length)) {
    const { lixeiraDaPasta, lixeiraDeArquivosSemUso } = await import("@/lib/drive-organizacao");
    for (const chave of lixeira.pastas) await lixeiraDaPasta(chave);
    await lixeiraDeArquivosSemUso(lixeira.arquivos);
  }
  return r;
}
