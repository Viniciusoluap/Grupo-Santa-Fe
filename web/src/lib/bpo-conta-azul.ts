// Paridade BPO (13/11): importação do backup ZIP do Conta Azul Pro no BPO Financeiro e conciliação com o
// extrato/Asaas sem duplicar. Gêmeo de Prospecta/server/bpo-conta-azul.ts (mesma regra; aqui com Prisma).
// O navegador abre o ZIP e manda o texto dos CSVs; aqui eles são lidos de novo (nada do cliente é confiado),
// comparados com o banco (prévia) e gravados numa transação (importação). Reimportar o mesmo backup não
// duplica: cada lançamento leva a chave da linha do Conta Azul no requestKey (único).
// Paridade 17/11 (EPIC-024 S-01 da Prospecta): lançamento ARQUIVADO (exclusaoLoteBackupId) continua segurando a
// chave única; a prévia o mostra à parte ("arquivados que bloqueiam") e "Liberar reimportação" (só admin) o remove
// em definitivo, com cópia em bpo_lancamentos_expurgo, se não tiver nenhum vínculo.
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { normalizarTitular } from "@/lib/bpo-categorias";
import {
  CONFIRMACAO_LIBERAR_REIMPORTACAO, PREFIXO_CHAVE_CONTA_AZUL, conciliarComContaAzul, confirmacaoLiberarValida,
  lerBackupContaAzul, observacoesDoMovimento,
  type BackupContaAzul, type MovimentoParaConciliar, type PessoaContaAzul,
} from "@/lib/financeiro/conta-azul";

type Db = Prisma.TransactionClient | typeof prisma;
type Cliente = { id: string; razaoSocial: string; cpf: string | null; cnpj: string | null };

const LOTE = 200;
const digitos = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
/** Tipo do lançamento no Santa Fé: receita do Conta Azul = "recebimento" (aba Cobranças), despesa = "despesa". */
export const tipoDoContaAzul = (t: "receita" | "despesa") => (t === "receita" ? "recebimento" : "despesa");

/** Cadastra no BPO só quem é Cliente no Conta Azul; fornecedores ficam como nome nos lançamentos. */
const papelCliente = (p: PessoaContaAzul) => p.papel.toLowerCase() === "cliente";

function indiceClientes(clientes: Cliente[]) {
  const porDoc = new Map<string, Cliente>(), porNome = new Map<string, Cliente>();
  for (const c of clientes) {
    for (const d of [digitos(c.cpf), digitos(c.cnpj)]) if (d.length >= 11 && !porDoc.has(d)) porDoc.set(d, c);
    const n = normalizarTitular(c.razaoSocial);
    if (n && !porNome.has(n)) porNome.set(n, c);
  }
  return { porDoc, porNome };
}

function planejar(backup: BackupContaAzul, clientes: Cliente[], chavesExistentes: Map<string, boolean>) {
  const idx = indiceClientes(clientes);
  const novosClientes: PessoaContaAzul[] = [];
  let clientesExistentes = 0;
  const vistos = new Set<string>();
  for (const p of backup.pessoas.filter(papelCliente)) {
    const doc = p.cpf ?? p.cnpj ?? "";
    const chave = doc || p.chaveNome;
    if (!chave || vistos.has(chave)) continue;
    vistos.add(chave);
    if ((doc && idx.porDoc.has(doc)) || idx.porNome.has(p.chaveNome)) clientesExistentes++;
    else novosClientes.push(p);
  }
  const movimentosNovos = backup.movimentos.filter((m) => !chavesExistentes.has(m.chave));
  const movimentosArquivados = backup.movimentos.filter((m) => chavesExistentes.get(m.chave) === true).length;
  return {
    novosClientes, clientesExistentes, movimentosNovos, movimentosArquivados,
    movimentosExistentes: backup.movimentos.length - movimentosNovos.length - movimentosArquivados,
  };
}

/** Chave já gravada → true se o lançamento que a segura está ARQUIVADO (fora das listas, mas bloqueia a chave). */
async function chavesJaImportadas(d: Db, chaves: string[]) {
  const existentes = new Map<string, boolean>();
  for (let i = 0; i < chaves.length; i += 500) {
    const r = await d.bpoLancamento.findMany({ where: { requestKey: { in: chaves.slice(i, i + 500) } }, select: { requestKey: true, exclusaoLoteBackupId: true } });
    for (const x of r) if (x.requestKey) existentes.set(x.requestKey, x.exclusaoLoteBackupId != null);
  }
  return existentes;
}

export type ArquivadoContaAzul = { id: string; descricao: string; valor: number; requestKey: string; outraOrigem: boolean; motivos: string[] };

/**
 * Lançamentos ARQUIVADOS (de qualquer origem) que seguram as chaves deste backup, com o que impede removê-los
 * (outra origem ou qualquer vínculo: banco, Asaas, baixa, obra, regularização ou combinação). Sem motivo = pode liberar.
 * Com `travar`, as linhas ficam presas (FOR UPDATE) até o fim da transação.
 */
async function arquivadosQueBloqueiam(d: Db, chaves: string[], travar = false): Promise<ArquivadoContaAzul[]> {
  const saida: ArquivadoContaAzul[] = [];
  for (let i = 0; i < chaves.length; i += 500) {
    const filtro = { requestKey: { in: chaves.slice(i, i + 500), startsWith: PREFIXO_CHAVE_CONTA_AZUL }, exclusaoLoteBackupId: { not: null } } satisfies Prisma.BpoLancamentoWhereInput;
    // Caso comum (nenhum arquivado): uma consulta leve, sem conferir os vínculos.
    if (!(await d.bpoLancamento.findFirst({ where: filtro, select: { id: true } }))) continue;
    if (travar) {
      const ids = (await d.bpoLancamento.findMany({ where: filtro, select: { id: true } })).map((x) => x.id);
      if (ids.length) await d.$queryRaw`SELECT id FROM bpo_lancamentos WHERE id = ANY(${ids}::text[]) ORDER BY id FOR UPDATE`;
    }
    const linhas = await d.bpoLancamento.findMany({
      where: filtro, orderBy: { id: "asc" },
      select: {
        id: true, descricao: true, valor: true, requestKey: true, origemEfetiva: true, transacaoId: true, asaasPaymentId: true, combinadaEmId: true,
        _count: { select: { baixas: true, movimentosObra: true, recebimentosRegularizacao: true } },
      },
    });
    const combinadas = linhas.length
      ? await d.bpoLancamento.groupBy({ by: ["combinadaEmId"], where: { combinadaEmId: { in: linhas.map((x) => x.id) } }, _count: { _all: true } })
      : [];
    const filhos = new Map(combinadas.map((c) => [c.combinadaEmId!, c._count._all]));
    for (const x of linhas) {
      const motivos: string[] = [];
      // A chave é do Conta Azul, mas a linha mudou de origem: "Liberar" nunca remove outra origem.
      const outraOrigem = x.origemEfetiva !== "conta_azul";
      if (outraOrigem) motivos.push(`origem "${x.origemEfetiva}" (não é do Conta Azul): não é removido por aqui`);
      if (x.transacaoId != null) motivos.push("ligado a uma movimentação bancária");
      if (x.asaasPaymentId) motivos.push("ligado a uma cobrança do Asaas");
      if (x._count.baixas > 0) motivos.push("tem baixa registrada em recebimentos");
      if (x._count.movimentosObra > 0) motivos.push("ligado a movimento de obra");
      if (x._count.recebimentosRegularizacao > 0) motivos.push("ligado a recebimento de regularização");
      if (x.combinadaEmId != null) motivos.push("combinado em outra cobrança");
      if ((filhos.get(x.id) ?? 0) > 0) motivos.push("outra cobrança foi combinada nele");
      saida.push({ id: x.id, descricao: x.descricao, valor: x.valor, requestKey: x.requestKey ?? "", outraOrigem, motivos });
    }
  }
  return saida;
}

const clientesDoBanco = (d: Db): Promise<Cliente[]> => d.bpoCliente.findMany({ select: { id: true, razaoSocial: true, cpf: true, cnpj: true } });
const soma = (xs: { valor: string }[]) => (xs.reduce((s, x) => s + Math.round(Number(x.valor) * 100), 0) / 100).toFixed(2);

export type PreviaContaAzul = Awaited<ReturnType<typeof previaContaAzul>>;

/** Prévia sem gravar nada: o que entra, o que já existe e o que fica de fora (e por quê). */
export async function previaContaAzul(arquivos: Record<string, string>) {
  const backup = lerBackupContaAzul(arquivos);
  const chaves = backup.movimentos.map((m) => m.chave);
  const [clientes, existentes, arquivados] = await Promise.all([clientesDoBanco(prisma), chavesJaImportadas(prisma, chaves), arquivadosQueBloqueiam(prisma, chaves)]);
  const plano = planejar(backup, clientes, existentes);
  const naoLiberaveis = arquivados.filter((a) => a.motivos.length > 0);
  const comVinculo = naoLiberaveis.filter((a) => !a.outraOrigem);
  const receitas = plano.movimentosNovos.filter((m) => m.tipo === "receita");
  const despesas = plano.movimentosNovos.filter((m) => m.tipo === "despesa");
  const porCategoria = new Map<string, number>();
  for (const m of plano.movimentosNovos) porCategoria.set(m.categoria, (porCategoria.get(m.categoria) ?? 0) + 1);
  const competencias = backup.movimentos.map((m) => m.competencia).sort();
  // Lançamentos que vieram do extrato bancário no mesmo período: podem ser as mesmas movimentações.
  const sobreposicao = competencias.length ? await prisma.bpoLancamento.count({ where: {
    origemEfetiva: "extrato", exclusaoLoteBackupId: null,
    competencia: { gte: competencias[0], lte: competencias[competencias.length - 1] },
  } }) : 0;
  return {
    lancamentosDoExtratoNoPeriodo: sobreposicao,
    valido: backup.erros.length === 0 || backup.movimentos.length > 0 || backup.pessoas.length > 0,
    pessoas: { total: backup.pessoas.length, clientes: backup.pessoas.filter(papelCliente).length, fornecedores: backup.pessoas.filter((p) => p.papel.toLowerCase() === "fornecedor").length },
    clientesNovos: plano.novosClientes.length,
    clientesExistentes: plano.clientesExistentes,
    lancamentos: {
      novos: plano.movimentosNovos.length,
      /** Ativos (aparecem no BPO): não serão duplicados. */
      jaImportados: plano.movimentosExistentes,
      /** Arquivados que seguram a chave: não entram enquanto não forem liberados (removidos em definitivo). */
      arquivados: {
        bloqueando: plano.movimentosArquivados,
        liberaveis: arquivados.length - naoLiberaveis.length,
        comVinculo: comVinculo.length,
        /** Arquivados de OUTRA origem (legado, Asaas, manual…) que seguram uma chave do Conta Azul: nunca removidos aqui. */
        outraOrigem: naoLiberaveis.length - comVinculo.length,
        exemplosComVinculo: naoLiberaveis.slice(0, 20).map((a) => ({ id: a.id, descricao: a.descricao, valor: a.valor, motivos: a.motivos })),
      },
      receitas: { quantidade: receitas.length, total: soma(receitas) },
      despesas: { quantidade: despesas.length, total: soma(despesas) },
      pagos: plano.movimentosNovos.filter((m) => m.pago).length,
      emAberto: plano.movimentosNovos.filter((m) => !m.pago).length,
      porCategoria: Array.from(porCategoria.entries()).sort((a, b) => b[1] - a[1]).map(([categoria, quantidade]) => ({ categoria, quantidade })),
      periodo: competencias.length ? { de: competencias[0], ate: competencias[competencias.length - 1] } : null,
    },
    repetidasPorCentro: backup.repetidasPorCentro,
    transferencias: backup.transferencias,
    outrosArquivos: backup.outrosArquivos,
    arquivosAusentes: backup.arquivosAusentes,
    erros: backup.erros.slice(0, 50),
    totalErros: backup.erros.length,
  };
}

const meioDia = (d: string) => new Date(`${d}T12:00:00Z`);

/** Importa numa transação (com trava): clientes novos, depois os lançamentos que ainda não existem. */
export async function importarContaAzul(arquivos: Record<string, string>) {
  const backup = lerBackupContaAzul(arquivos);
  if (!backup.movimentos.length && !backup.pessoas.length) throw new Error(backup.erros[0] ?? "Nada para importar neste arquivo.");
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1::int AS locked FROM pg_advisory_xact_lock(hashtext('bpo_importar_conta_azul'))`;
    const clientes = await clientesDoBanco(tx);
    const existentes = await chavesJaImportadas(tx, backup.movimentos.map((m) => m.chave));
    const plano = planejar(backup, clientes, existentes);
    const agora = new Date();
    for (let i = 0; i < plano.novosClientes.length; i += LOTE) {
      const criados = await tx.bpoCliente.createManyAndReturn({
        data: plano.novosClientes.slice(i, i + LOTE).map((p) => ({
          razaoSocial: p.nome,
          cpf: p.cpf, cnpj: p.cnpj,
          responsavel: p.nome,
          email: p.email,
          telefone: p.telefone,
          honorarios: 0,
          dataInicio: agora,
          status: p.ativo ? "ativo" : "encerrado",
          observacoes: ["Importado do Conta Azul (backup).", p.razaoSocial && p.razaoSocial !== p.nome ? `Razão social: ${p.razaoSocial}.` : ""].filter(Boolean).join(" "),
        })),
        select: { id: true, razaoSocial: true, cpf: true, cnpj: true },
      });
      clientes.push(...criados);
    }
    const { porNome } = indiceClientes(clientes);
    let lancamentosCriados = 0;
    for (let i = 0; i < plano.movimentosNovos.length; i += LOTE) {
      const r = await tx.bpoLancamento.createMany({
        data: plano.movimentosNovos.slice(i, i + LOTE).map((m) => {
          const cliente = m.negociador ? porNome.get(normalizarTitular(m.negociador)) : undefined;
          return {
            clienteId: cliente?.id ?? null,
            clienteNomeLivre: cliente ? null : (m.negociador || null),
            tipo: tipoDoContaAzul(m.tipo),
            descricao: m.descricao,
            valor: Number(m.valor),
            vencimento: meioDia(m.vencimento),
            pago: m.pago,
            pagoEm: m.pagoEm ? meioDia(m.pagoEm) : null,
            valorRecebido: m.pago ? Number(m.valor) : 0,
            competencia: m.competencia,
            centroCustos: m.centrosCusto.join(" / ").slice(0, 100) || null,
            categoria: m.categoria,
            observacoes: observacoesDoMovimento(m),
            origemEfetiva: "conta_azul",
            // Em aberto só entra em Cobranças/Despesas depois que o dono classificar.
            aClassificar: !m.pago,
            requestKey: m.chave,
          };
        }),
        skipDuplicates: true,
      });
      lancamentosCriados += r.count;
    }
    return {
      clientesCriados: plano.novosClientes.length,
      clientesExistentes: plano.clientesExistentes,
      lancamentosCriados,
      lancamentosJaImportados: plano.movimentosExistentes + (plano.movimentosNovos.length - lancamentosCriados),
      lancamentosArquivadosBloqueando: plano.movimentosArquivados,
      transferenciasIgnoradas: backup.transferencias.quantidade,
      linhasComErro: backup.erros.length,
    };
  }, { timeout: 120_000, maxWait: 20_000 });
}

/**
 * Paridade 17/11 (S-01): "Liberar reimportação" (só admin — a ação confere). Remove em definitivo SÓ os lançamentos
 * ARQUIVADOS do Conta Azul que seguram as chaves deste backup e não têm vínculo nenhum — numa transação, depois de
 * copiá-los para bpo_lancamentos_expurgo (lote) e registrar o histórico de cada um. Ativos e outras origens (legado,
 * Asaas, manual, extrato) nunca entram. Os que têm vínculo ficam e voltam listados com o motivo.
 */
export async function liberarReimportacaoContaAzul(input: { arquivos: Record<string, string>; confirmacao: string }, usuarioId: string) {
  if (!confirmacaoLiberarValida(input.confirmacao)) throw new Error(`Digite ${CONFIRMACAO_LIBERAR_REIMPORTACAO} para confirmar a remoção definitiva.`);
  const backup = lerBackupContaAzul(input.arquivos);
  const chaves = backup.movimentos.map((m) => m.chave);
  if (!chaves.length) throw new Error(backup.erros[0] ?? "Nenhum lançamento neste arquivo.");
  return prisma.$transaction(async (tx) => {
    // Mesma ordem de travas sempre: exclusão/restauração em lote, depois a importação.
    await tx.$queryRaw`SELECT 1::int AS locked FROM pg_advisory_xact_lock(hashtext('bpo_exclusao_lote'))`;
    await tx.$queryRaw`SELECT 1::int AS locked FROM pg_advisory_xact_lock(hashtext('bpo_importar_conta_azul'))`;
    const arquivados = await arquivadosQueBloqueiam(tx, chaves, true);
    const liberaveis = arquivados.filter((a) => !a.motivos.length).map((a) => a.id);
    const mantidos = arquivados.filter((a) => a.motivos.length > 0);
    const loteId = randomUUID();
    let removidos = 0;
    for (let i = 0; i < liberaveis.length; i += LOTE) {
      const ids = liberaveis.slice(i, i + LOTE);
      const linhas = await tx.bpoLancamento.findMany({ where: { id: { in: ids } } });
      await tx.bpoLancamentoExpurgo.createMany({ data: linhas.map((x) => ({
        loteId, lancamentoId: x.id, requestKey: x.requestKey, origemEfetiva: x.origemEfetiva,
        exclusaoLoteBackupId: x.exclusaoLoteBackupId, dadosJson: JSON.stringify(x), expurgadoPorUsuarioId: usuarioId,
      })) });
      await tx.bpoLancamentoHistorico.createMany({ data: linhas.map((x) => ({
        lancamentoId: x.id, lancamentoReferencia: x.id, versaoAnterior: x.version, alteradoPorUsuarioId: usuarioId,
        motivo: `Removido em definitivo para liberar a reimportação do Conta Azul (arquivado; cópia no expurgo ${loteId})`,
        antesJson: JSON.stringify(x), depoisJson: JSON.stringify({ expurgado: true, loteId }),
      })) });
      // Revalida tudo no próprio DELETE: se algo ganhou vínculo desde a leitura, nada é apagado.
      const apagados = await tx.bpoLancamento.deleteMany({ where: {
        id: { in: ids }, exclusaoLoteBackupId: { not: null }, origemEfetiva: "conta_azul", requestKey: { startsWith: PREFIXO_CHAVE_CONTA_AZUL },
        asaasPaymentId: null, transacaoId: null, combinadaEmId: null,
        baixas: { none: {} }, movimentosObra: { none: {} }, recebimentosRegularizacao: { none: {} },
      } });
      // "outra cobrança foi combinada nele": conferido também depois, dentro da mesma transação.
      const filhos = await tx.bpoLancamento.count({ where: { combinadaEmId: { in: ids } } });
      if (apagados.count !== ids.length || linhas.length !== ids.length || filhos > 0) throw new Error("Algum lançamento arquivado mudou durante a liberação. Nada foi removido; abra a prévia de novo.");
      removidos += apagados.count;
    }
    console.info(`[bpo] Liberar reimportação Conta Azul: lote ${loteId}, ${removidos} removido(s), ${mantidos.length} mantido(s) com vínculo, usuário ${usuarioId}.`);
    return {
      loteId: removidos ? loteId : null,
      arquivados: arquivados.length,
      removidos,
      mantidos: mantidos.length,
      mantidosDetalhe: mantidos.slice(0, 100).map((a) => ({ id: a.id, descricao: a.descricao, valor: a.valor, motivos: a.motivos })),
    };
  }, { timeout: 120_000, maxWait: 20_000 });
}

/**
 * Lançamentos do Conta Azul ainda sem movimentação bancária (candidatos à conciliação). Fora: arquivados,
 * combinados e os que já receberam baixa de uma movimentação na divisão de pagamentos.
 */
export async function candidatosContaAzul(d: Db, tipo: "receita" | "despesa" | null, semAsaas = false) {
  const linhas = await d.bpoLancamento.findMany({
    where: {
      origemEfetiva: "conta_azul", transacaoId: null, exclusaoLoteBackupId: null, combinadaEmId: null,
      ...(tipo === "despesa" ? { tipo: { startsWith: "despesa" } } : tipo === "receita" ? { NOT: { tipo: { startsWith: "despesa" } } } : {}),
      ...(semAsaas ? { asaasPaymentId: null } : {}),
      baixas: { none: { transacaoId: { not: null } } },
    },
    select: { id: true, tipo: true, valor: true, pago: true, pagoEm: true, vencimento: true, clienteId: true },
  });
  return linhas;
}

/**
 * A movimentação do extrato que corresponde a um lançamento do Conta Azul JÁ PAGO (mesmo tipo e valor, até 3 dias
 * da quitação) só é ligada a ele — sem mudar valor, status nem data de pagamento — em vez de criar outro
 * lançamento. Em aberto não é baixado sozinho (vira sugestão em "A classificar"). Devolve os ids ligados.
 */
export async function conciliarMovimentosComContaAzul(movimentos: MovimentoParaConciliar[]): Promise<Set<string>> {
  const conciliadas = new Set<string>();
  if (!movimentos.length) return conciliadas;
  const candidatos = (await candidatosContaAzul(prisma, null)).filter((c) => c.pago);
  if (!candidatos.length) return conciliadas;
  for (const [movId, lancId] of conciliarComContaAzul(movimentos, candidatos)) {
    const r = await prisma.bpoLancamento.updateMany({ where: { id: lancId, transacaoId: null, pago: true }, data: { transacaoId: movId } }).catch(() => ({ count: 0 }));
    if (r.count) conciliadas.add(movId);
  }
  return conciliadas;
}
