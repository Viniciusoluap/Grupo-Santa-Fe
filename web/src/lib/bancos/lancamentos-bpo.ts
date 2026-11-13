// LOTE C (25/10, paridade Prospecta): cada movimentação bancária (importada ou sincronizada) gera
// um lançamento PAGO em bpo_lancamentos, vínculo 1:1 (transacaoId único) e sem duplicar:
// crédito → receita (Cobranças), débito → despesa (Despesas); data/competência = data do banco.
// Também classifica (categoria + cliente BPO) e mantém o saldo das contas por importação.
// Paridade BPO (13/11, gêmeo de Prospecta/server/bpo-extrato.ts): movimentação NOVA só vira lançamento quando o
// sistema sabe ligar com segurança (cobrança Asaas conhecida, lançamento do Conta Azul já pago, regra do titular
// com categoria). O resto fica "A classificar" (transacoes_bancarias."aClassificar") até o dono classificar ou
// dar baixa. Movimentação que deu baixa por divisão de pagamento (bpo_baixas."transacaoId") nunca gera lançamento.
import { prisma } from "@/lib/db";
import { TRANSFERENCIA_INTERNA, categoriaValida, descricaoComTitular, normalizarTitular, sugerirCategoria, tipoLancamentoDaTransacao } from "@/lib/bpo-categorias";
import { conciliarMovimentosComContaAzul } from "@/lib/bpo-conta-azul";
import type { SaldoExtrato } from "@/lib/extrato-import";

const LOTE = 500;

/**
 * Como a movimentação chegou (mesma regra da Prospecta):
 * - "nova": acabou de ser gravada (extrato, Pluggy, Asaas, Inter) — sem correspondência segura fica A classificar;
 * - "classificada": o usuário classificou (painel Bancos, regra por titular, aba A classificar) — cria o lançamento;
 * - "reprocessar": backfill/rede de segurança — cria como antes, mas nunca para as que estão A classificar.
 */
export type ModoGeracao = "nova" | "classificada" | "reprocessar";

/**
 * Cria os lançamentos que faltam (idempotente). Sem filtro: todas as movimentações (backfill).
 * Categoria vazia ou fora da lista padrão (ex.: categoria da Pluggy/Asaas) recebe a sugestão.
 * Movimentação "A classificar" nunca é tocada aqui (quem classifica limpa a marca antes de chamar).
 */
export async function vincularTransacoesAoBpo(filtro: { contaId?: string; ids?: string[] } = {}, modo: ModoGeracao = "reprocessar") {
  let criados = 0, categorizadas = 0, aClassificar = 0, conciliadasContaAzul = 0;
  if (modo === "nova" && !filtro.ids) throw new Error("Movimentações novas precisam ser informadas pelo id.");
  for (;;) {
    const tombstones = await prisma.bpoLancamento.findMany({ where: { exclusaoLoteBackupId: { not: null } }, select: { asaasPaymentId: true, origemTransacaoKey: true } });
    const pagamentosArquivados = tombstones.flatMap((l) => l.asaasPaymentId ? [l.asaasPaymentId] : []);
    const origensArquivadas = tombstones.flatMap((l) => l.origemTransacaoKey ? [l.origemTransacaoKey] : []);
    const lote = await prisma.transacaoBancaria.findMany({
      where: {
        lancamento: { is: null },
        aClassificar: false,
        baixas: { none: {} },
        AND: [
          ...(pagamentosArquivados.length ? [{ OR: [{ tipo: { not: "credito" } }, { asaasPaymentId: null }, { asaasPaymentId: { notIn: pagamentosArquivados } }] }] : []),
          ...(origensArquivadas.length ? [{ OR: [{ externalId: null }, { externalId: { notIn: origensArquivadas } }] }] : []),
        ],
        ...(filtro.contaId ? { contaId: filtro.contaId } : {}),
        ...(filtro.ids ? { id: { in: filtro.ids } } : {}),
      },
      orderBy: { id: "asc" },
      take: LOTE,
      select: { id: true, externalId: true, asaasPaymentId: true, data: true, descricao: true, descricaoOriginal: true, titular: true, valor: true, tipo: true, categoria: true, bpoClienteId: true },
    });
    if (!lote.length) break;

    // A cleanup may have detached a legitimate operational entry. Reattach by the stable
    // bank identifier before creating anything, preserving its classification and audit.
    const reanexados = new Set<string>();
    let vinculosRestaurados = 0;
    for (const t of lote) {
      const select = { id: true, transacaoId: true, asaasPaymentId: true, exclusaoLoteBackupId: true } as const;
      const pelaOrigem = t.externalId ? await prisma.bpoLancamento.findUnique({ where: { origemTransacaoKey: t.externalId }, select }) : null;
      const pagamento = t.tipo === "credito" ? t.asaasPaymentId : null;
      const existente = pelaOrigem ?? (pagamento ? await prisma.bpoLancamento.findUnique({ where: { asaasPaymentId: pagamento }, select }) : null);
      if (existente?.exclusaoLoteBackupId) { reanexados.add(t.id); continue; }
      if (existente && !existente.transacaoId) {
        // O crédito pode chegar após a janela de sincronização da cobrança.
        const r = await prisma.bpoLancamento.updateMany({
          where: { id: existente.id, transacaoId: null, exclusaoLoteBackupId: null },
          data: {
            transacaoId: t.id,
            version: { increment: 1 },
            ...(pagamento && existente.asaasPaymentId === pagamento ? { pago: true, pagoEm: t.data, valor: t.valor, aClassificar: false } : {}),
          },
        });
        vinculosRestaurados += r.count;
        reanexados.add(t.id);
      }
    }

    const regras = await prisma.bpoRegraTitular.findMany();
    const porTitular = new Map(regras.map((regra) => [regra.titularNormalizado, regra]));
    const clientes = await prisma.bpoCliente.findMany({ select: { id: true, razaoSocial: true, lead: { select: { nome: true } } } });
    const clientePorNome = new Map<string, string[]>();
    for (const cliente of clientes) for (const nome of [cliente.razaoSocial, cliente.lead?.nome]) {
      const chave = normalizarTitular(nome);
      if (chave) clientePorNome.set(chave, [...(clientePorNome.get(chave) ?? []), cliente.id]);
    }
    const comCategoria = lote.filter((t) => !reanexados.has(t.id)).map((t) => {
      const chave = normalizarTitular(t.titular);
      const regra = chave ? porTitular.get(chave) : null;
      const candidatos = chave ? [...new Set(clientePorNome.get(chave) ?? [])] : [];
      const temRegra = categoriaValida(regra?.categoria);
      // Classificação explícita: a escolha do usuário (gravada na movimentação) vence a regra antiga do titular.
      const explicita = modo === "classificada" && categoriaValida(t.categoria);
      return {
        ...t,
        temRegra,
        categoriaFinal: explicita ? t.categoria! : temRegra ? regra!.categoria! : categoriaValida(t.categoria) ? t.categoria : sugerirCategoria(t.descricao, t.tipo, t.categoria),
        clienteFinal: (modo === "classificada" ? t.bpoClienteId ?? regra?.bpoClienteId : regra?.bpoClienteId ?? t.bpoClienteId) ?? (candidatos.length === 1 ? candidatos[0] : null),
      };
    });
    const porCategoria = new Map<string, string[]>();
    for (const t of comCategoria) {
      if (t.categoria === t.categoriaFinal) continue;
      porCategoria.set(t.categoriaFinal, [...(porCategoria.get(t.categoriaFinal) ?? []), t.id]);
    }
    for (const [categoria, ids] of porCategoria) {
      const r = await prisma.transacaoBancaria.updateMany({ where: { id: { in: ids } }, data: { categoria } });
      categorizadas += r.count;
    }

    // O que já veio PAGO do backup do Conta Azul (mesmo tipo/valor, até 3 dias da quitação) é só ligado.
    const doContaAzul = await conciliarMovimentosComContaAzul(comCategoria
      .filter((t) => t.categoriaFinal !== TRANSFERENCIA_INTERNA)
      .map((t) => ({ id: t.id, tipo: t.tipo === "credito" ? "receita" as const : "despesa" as const, valor: t.valor, data: t.data })));
    conciliadasContaAzul += doContaAzul.size;
    let paraCriar = comCategoria.filter((t) => !doContaAzul.has(t.id));
    let marcadas = 0;
    if (modo === "nova") {
      // Só a regra que o usuário ensinou (titular com categoria) cria o lançamento; transferência interna segue
      // como antes (lançamento fora de listas/DRE). O resto vai para A classificar, com o cliente sugerido.
      const esperar = paraCriar.filter((t) => !t.temRegra && t.categoriaFinal !== TRANSFERENCIA_INTERNA);
      paraCriar = paraCriar.filter((t) => t.temRegra || t.categoriaFinal === TRANSFERENCIA_INTERNA);
      if (esperar.length) {
        const r = await prisma.transacaoBancaria.updateMany({ where: { id: { in: esperar.map((t) => t.id) }, aClassificar: false }, data: { aClassificar: true } });
        marcadas = r.count;
        aClassificar += r.count;
        const porCliente = new Map<string, string[]>();
        for (const t of esperar) if (t.clienteFinal && !t.bpoClienteId) porCliente.set(t.clienteFinal, [...(porCliente.get(t.clienteFinal) ?? []), t.id]);
        for (const [bpoClienteId, ids] of porCliente) await prisma.transacaoBancaria.updateMany({ where: { id: { in: ids }, bpoClienteId: null }, data: { bpoClienteId } });
      }
    }

    const r = await prisma.bpoLancamento.createMany({
      data: paraCriar.map((t) => ({
        transacaoId: t.id,
        origemEfetiva: "extrato",
        origemTransacaoKey: t.externalId,
        tipo: tipoLancamentoDaTransacao(t.tipo),
        descricao: descricaoComTitular([t.descricao, t.titular, t.descricaoOriginal]),
        valor: t.valor,
        vencimento: t.data,
        pago: true,
        pagoEm: t.data,
        competencia: t.data.toISOString().slice(0, 7),
        categoria: t.categoriaFinal,
        clienteId: t.clienteFinal,
      })),
      skipDuplicates: true,
    });
    criados += r.count;
    // Concorrência: se outro processo vinculou este lote, não há o que fazer aqui.
    if (r.count + vinculosRestaurados + doContaAzul.size + marcadas === 0 || lote.length < LOTE) break;
  }
  return { criados, categorizadas, aClassificar, conciliadasContaAzul };
}

/**
 * Saldo das contas alimentadas por importação: saldo informado pelo extrato (o mais recente) +
 * movimentações posteriores à data dele; sem saldo no arquivo, a soma das movimentações.
 * Contas por API (Asaas/Pluggy) usam o saldo devolvido pelo provedor na sincronização.
 */
export async function recalcularSaldoConta(contaId: string, saldoArquivo?: SaldoExtrato | null) {
  const conta = await prisma.contaBancaria.findUnique({
    where: { id: contaId },
    select: { id: true, provedor: true, saldoExtrato: true, saldoExtratoData: true },
  });
  if (!conta) return null;
  let saldoExtrato = conta.saldoExtrato;
  let saldoData = conta.saldoExtratoData ? conta.saldoExtratoData.toISOString().slice(0, 10) : null;
  if (saldoArquivo && Number.isFinite(saldoArquivo.valor)) {
    const maisNovo = saldoExtrato === null || !saldoData || !saldoArquivo.data || saldoArquivo.data >= saldoData;
    if (maisNovo) { saldoExtrato = saldoArquivo.valor; saldoData = saldoArquivo.data; }
  }
  if (conta.provedor !== "manual") {
    if (saldoExtrato !== conta.saldoExtrato) {
      await prisma.contaBancaria.update({ where: { id: conta.id }, data: { saldoExtrato, saldoExtratoData: saldoData ? new Date(`${saldoData}T00:00:00Z`) : null } });
    }
    return null;
  }
  let saldo: number;
  if (saldoExtrato !== null) {
    if (!saldoData) saldo = saldoExtrato;
    else {
      const depois = new Date(`${saldoData}T00:00:00Z`);
      depois.setUTCDate(depois.getUTCDate() + 1);
      const g = await prisma.transacaoBancaria.groupBy({ by: ["tipo"], where: { contaId, data: { gte: depois } }, _sum: { valor: true } });
      saldo = saldoExtrato + somaAssinada(g);
    }
  } else {
    const g = await prisma.transacaoBancaria.groupBy({ by: ["tipo"], where: { contaId }, _sum: { valor: true } });
    saldo = somaAssinada(g);
  }
  saldo = Math.round(saldo * 100) / 100;
  await prisma.contaBancaria.update({
    where: { id: conta.id },
    data: { saldoAtual: saldo, saldoExtrato, saldoExtratoData: saldoData ? new Date(`${saldoData}T00:00:00Z`) : null },
  });
  return saldo;
}

function somaAssinada(g: { tipo: string; _sum: { valor: number | null } }[]) {
  return g.reduce((s, x) => s + (x.tipo === "credito" ? 1 : -1) * (x._sum.valor ?? 0), 0);
}

/** Backfill / botão "Reprocessar movimentações": vincula o que falta e recalcula os saldos. */
export async function reprocessarMovimentacoes() {
  const r = await vincularTransacoesAoBpo();
  const contas = await prisma.contaBancaria.findMany({ where: { provedor: "manual" }, select: { id: true } });
  for (const c of contas) await recalcularSaldoConta(c.id);
  return { ...r, contasRecalculadas: contas.length };
}

/** Categoria e cliente BPO de uma movimentação, refletidos no lançamento vinculado. */
export async function classificarTransacao(id: string, input: { categoria?: string; clienteId?: string | null }) {
  const t = await prisma.transacaoBancaria.findUnique({ where: { id }, select: { id: true, titular: true } });
  if (!t) throw new Error("Movimentação não encontrada.");
  if (input.categoria !== undefined && !categoriaValida(input.categoria)) throw new Error("Categoria inválida.");
  const clienteId = input.clienteId === undefined ? undefined : input.clienteId || null;
  if (clienteId) {
    const c = await prisma.bpoCliente.findUnique({ where: { id: clienteId }, select: { id: true } });
    if (!c) throw new Error("Cliente BPO não encontrado.");
  }
  // Classificação explícita do usuário: sai de "A classificar" e ganha o lançamento.
  await prisma.transacaoBancaria.update({ where: { id }, data: {
    ...(input.categoria !== undefined ? { categoria: input.categoria } : {}),
    ...(clienteId !== undefined ? { bpoClienteId: clienteId } : {}),
    aClassificar: false,
  } });
  await vincularTransacoesAoBpo({ ids: [id] }, "classificada");
  await prisma.bpoLancamento.updateMany({
    where: { transacaoId: id, exclusaoLoteBackupId: null },
    data: {
      ...(input.categoria !== undefined ? { categoria: input.categoria } : {}),
      ...(clienteId !== undefined ? { clienteId } : {}),
    },
  });
  const titularNormalizado = normalizarTitular(t.titular);
  if (titularNormalizado) {
    await prisma.bpoRegraTitular.upsert({
      where: { titularNormalizado },
      create: { titularNormalizado, categoria: input.categoria, bpoClienteId: clienteId },
      update: {
        ...(input.categoria !== undefined ? { categoria: input.categoria } : {}),
        ...(clienteId !== undefined ? { bpoClienteId: clienteId } : {}),
      },
    });
    const iguais = (await prisma.transacaoBancaria.findMany({ where: { titular: { not: null } }, select: { id: true, titular: true } }))
      .filter((mov) => normalizarTitular(mov.titular) === titularNormalizado).map((mov) => mov.id);
    if (iguais.length) {
      // Com categoria é classificação explícita (as do mesmo titular A classificar ganham o lançamento); só com
      // cliente, a movimentação A classificar recebe o cliente e continua esperando o usuário.
      await prisma.transacaoBancaria.updateMany({ where: { id: { in: iguais } }, data: {
        ...(input.categoria !== undefined ? { categoria: input.categoria, aClassificar: false } : {}),
        ...(clienteId !== undefined ? { bpoClienteId: clienteId } : {}),
      } });
      if (input.categoria !== undefined) await vincularTransacoesAoBpo({ ids: iguais }, "classificada");
      await prisma.bpoLancamento.updateMany({ where: { transacaoId: { in: iguais }, exclusaoLoteBackupId: null }, data: {
        ...(input.categoria !== undefined ? { categoria: input.categoria } : {}),
        ...(clienteId !== undefined ? { clienteId } : {}),
      } });
    }
  }
  return { ok: true };
}
