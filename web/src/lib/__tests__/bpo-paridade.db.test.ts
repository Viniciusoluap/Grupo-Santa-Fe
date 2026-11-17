// Paridade BPO (13/11) com a Prospecta — banco real (TEST_DATABASE_URL, com a migração 20261113100000 aplicada):
// importação do Conta Azul, "A classificar", conciliação com o extrato e o Asaas, dividir pagamentos, centros de
// custo e filtros no servidor. Mesmos cenários de Prospecta/server/bpo-conta-azul.test.ts e bpo-a-classificar.test.ts.
// APIs externas simuladas: nenhum teste chama Asaas/Pluggy de verdade. CSVs sintéticos.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BACKUP } from "./fixtures/conta-azul-sintetico";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: "usuario-teste", role: "admin" } }) }));
// vi.fn (17/11): o teste de "Liberar reimportação" simula um não-admin com mockRejectedValueOnce.
const guardas = vi.hoisted(() => ({
  exigirModuloAcao: vi.fn(async () => ({ id: "usuario-teste", nome: "Teste" })),
  exigirAdminAtivo: vi.fn(async () => ({ id: "usuario-teste", nome: "Teste" })),
}));
vi.mock("@/lib/auth/modulos", () => guardas);
const url = process.env.TEST_DATABASE_URL;
if (url) process.env.DATABASE_URL = url;
process.env.AUTH_SECRET ||= "segredo-de-teste";

const MARCA = "TESTE-PARIDADE-BPO";
const CHAVE_FIXTURE = "contaazul:aaaaaaaa-0000-0000-0000-00000000000";

describe.skipIf(!url)("Paridade BPO 13/11 (banco real)", () => {
  let prisma: typeof import("@/lib/db").prisma;
  let bancos: typeof import("@/lib/bancos");
  let lanc: typeof import("@/lib/bancos/lancamentos-bpo");
  let acoes: typeof import("@/lib/actions/bpo-paridade");
  let bpo: typeof import("@/lib/actions/bpo");
  let lote: typeof import("@/lib/actions/bpo-lote");
  let asaas: typeof import("@/lib/bancos/cobrancas-asaas");
  let resultado: typeof import("@/lib/financeiro/bpo-resultado");

  beforeAll(async () => {
    ({ prisma } = await import("@/lib/db"));
    bancos = await import("@/lib/bancos");
    lanc = await import("@/lib/bancos/lancamentos-bpo");
    acoes = await import("@/lib/actions/bpo-paridade");
    bpo = await import("@/lib/actions/bpo");
    lote = await import("@/lib/actions/bpo-lote");
    asaas = await import("@/lib/bancos/cobrancas-asaas");
    resultado = await import("@/lib/financeiro/bpo-resultado");
  });

  const limpar = async () => {
    const lancs = await prisma.bpoLancamento.findMany({ where: { OR: [
      { descricao: { startsWith: MARCA } }, { clienteNomeLivre: { startsWith: MARCA } }, { requestKey: { startsWith: CHAVE_FIXTURE } },
      { requestKey: { startsWith: MARCA } }, { transacao: { conta: { banco: { startsWith: MARCA } } } }, { asaasPaymentId: { startsWith: MARCA } },
    ] }, select: { id: true } });
    const ids = lancs.map((l) => l.id);
    await prisma.bpoBaixa.deleteMany({ where: { OR: [{ lancamentoId: { in: ids } }, { transacao: { conta: { banco: { startsWith: MARCA } } } }] } });
    await prisma.bpoLancamento.updateMany({ where: { id: { in: ids } }, data: { combinadaEmId: null } });
    await prisma.bpoLancamento.deleteMany({ where: { id: { in: ids } } });
    await prisma.bpoLancamentoHistorico.deleteMany({ where: { lancamentoReferencia: { in: ids } } });
    await prisma.bpoLancamentoHistorico.deleteMany({ where: { motivo: { startsWith: "Removido em definitivo para liberar a reimportação" }, antesJson: { contains: CHAVE_FIXTURE } } });
    await prisma.bpoLancamentoExpurgo.deleteMany({ where: { requestKey: { startsWith: CHAVE_FIXTURE } } });
    await prisma.bpoLancamentoExclusaoBackup.deleteMany({ where: { OR: [{ snapshotJson: { contains: MARCA } }, { snapshotJson: { contains: CHAVE_FIXTURE } }] } });
    await prisma.contaBancaria.deleteMany({ where: { banco: { startsWith: MARCA } } });
    await prisma.bpoRegraTitular.deleteMany({ where: { titularNormalizado: { startsWith: "teste paridade bpo" } } });
    await prisma.bpoCliente.deleteMany({ where: { OR: [
      { razaoSocial: { startsWith: MARCA } },
      { razaoSocial: { in: ["Maria Teste", "Construtora Exemplo"] }, observacoes: { startsWith: "Importado do Conta Azul" } },
    ] } });
    await prisma.bpoCentroCusto.deleteMany({ where: { nome: { startsWith: MARCA } } });
  };
  beforeEach(limpar);
  afterAll(async () => { await limpar(); await prisma.$disconnect(); });

  const criarConta = (extra: Record<string, unknown> = {}) => prisma.contaBancaria.create({ data: { banco: `${MARCA} Cora`, conta: "123", provedor: "manual", ...extra } });
  const mov = (n: number, data: string, valor: number, tipo: "credito" | "debito", descricao: string, extra: Record<string, unknown> = {}) =>
    ({ externalId: `${MARCA}-${n}`, data, descricao: `${MARCA} ${descricao}`, valor, tipo, ...extra });
  const gravar = (conta: { id: string; dataInicial: Date | null }, ms: ReturnType<typeof mov>[]) => bancos.gravarMovimentos(conta, ms, "importacao");
  const txDe = (externalId: string) => prisma.transacaoBancaria.findUniqueOrThrow({ where: { externalId }, include: { lancamento: true } });
  const novoLanc = (descricao: string, extra: Record<string, unknown> = {}) => prisma.bpoLancamento.create({ data: {
    clienteNomeLivre: `${MARCA} Ana`, tipo: "recebimento", descricao: `${MARCA} ${descricao}`, valor: 100,
    vencimento: new Date("2026-10-10T12:00:00Z"), competencia: "2026-10", ...extra,
  } });
  // Mesma consulta da página do BPO (Cobranças/Despesas/DRE): a classificar, combinadas e arquivadas ficam fora.
  const visiveis = () => prisma.bpoLancamento.findMany({ where: { combinadaEmId: null, exclusaoLoteBackupId: null, aClassificar: false, OR: [
    { descricao: { startsWith: MARCA } }, { requestKey: { startsWith: CHAVE_FIXTURE } }, { transacao: { conta: { banco: { startsWith: MARCA } } } },
  ] } });
  const ok = <T,>(r: T | { erroAcao: string }): T => { if (r && typeof r === "object" && "erroAcao" in r) throw new Error((r as { erroAcao: string }).erroAcao); return r as T; };

  describe("importação do Conta Azul", () => {
    it("prévia não grava; importação cria clientes e lançamentos; reimportar não duplica; cliente existente fica como está", async () => {
      const maria = await prisma.bpoCliente.create({ data: { razaoSocial: `${MARCA} Maria (já cadastrada)`, cpf: "111.222.333-44", responsavel: "Maria", telefone: "1", honorarios: 99, dataInicio: new Date() } });
      const previa = ok(await acoes.previaContaAzulAcao(BACKUP));
      expect(previa).toMatchObject({ clientesNovos: 1, clientesExistentes: 1, repetidasPorCentro: 1, totalErros: 1, transferencias: { quantidade: 1, total: "5000.00" } });
      expect(previa.lancamentos).toMatchObject({ novos: 4, jaImportados: 0, pagos: 3, emAberto: 1, receitas: { quantidade: 1, total: "1500.00" }, despesas: { quantidade: 3, total: "1119.50" } });
      expect(await prisma.bpoLancamento.count({ where: { requestKey: { startsWith: CHAVE_FIXTURE } } })).toBe(0);

      const r = ok(await acoes.importarContaAzulAcao(BACKUP));
      expect(r).toMatchObject({ clientesCriados: 1, clientesExistentes: 1, lancamentosCriados: 4, lancamentosJaImportados: 0, transferenciasIgnoradas: 1, linhasComErro: 1 });
      const ls = await prisma.bpoLancamento.findMany({ where: { requestKey: { startsWith: CHAVE_FIXTURE } }, orderBy: { valor: "asc" } });
      expect(ls.map((l) => [l.tipo, l.valor, l.pago, l.aClassificar, l.origemEfetiva])).toEqual([
        ["despesa", 90, true, false, "conta_azul"], ["despesa", 320.5, false, true, "conta_azul"], ["despesa", 709, true, false, "conta_azul"], ["recebimento", 1500, true, false, "conta_azul"],
      ]);
      const contador = ls.find((l) => l.valor === 709)!;
      expect(contador).toMatchObject({ centroCustos: "Santa Fe Canaa / Santa Fe Parauapebas", valorRecebido: 709, categoria: "Administrativo" });
      expect(contador.observacoes).toMatch(/Categoria no Conta Azul: Honorários Contábeis\. Conta financeira: C6/);
      const receita = ls.find((l) => l.valor === 1500)!;
      // Mesma regra da Prospecta: o cliente existente (achado pelo CPF) não é recriado; o lançamento liga ao cliente
      // pelo NOME do negociador — com nome diferente no cadastro, fica com o nome livre do Conta Azul.
      expect(receita).toMatchObject({ clienteId: null, clienteNomeLivre: "Maria Teste" });
      expect(await prisma.bpoCliente.count({ where: { razaoSocial: "Maria Teste" } })).toBe(0);
      expect(receita.pagoEm?.toISOString().slice(0, 10)).toBe("2026-03-05");
      expect((await prisma.bpoCliente.findUniqueOrThrow({ where: { id: maria.id } })).honorarios).toBe(99); // não alterado
      expect(await prisma.bpoCliente.count({ where: { razaoSocial: "Construtora Exemplo", observacoes: { startsWith: "Importado do Conta Azul" } } })).toBe(1);
      expect(ls.find((l) => l.valor === 320.5)).toMatchObject({ clienteId: null, clienteNomeLivre: "Depósito Exemplo" });

      const de_novo = ok(await acoes.importarContaAzulAcao(BACKUP));
      expect(de_novo).toMatchObject({ clientesCriados: 0, lancamentosCriados: 0, lancamentosJaImportados: 4 });
      expect(await prisma.bpoLancamento.count({ where: { requestKey: { startsWith: CHAVE_FIXTURE } } })).toBe(4);
      expect(ok(await acoes.previaContaAzulAcao(BACKUP)).lancamentos.novos).toBe(0);
    });

    it("avisa sobreposição com o extrato no período e recusa arquivo que não é backup ou grande demais", async () => {
      await novoLanc("do extrato", { origemEfetiva: "extrato", competencia: "2026-04" });
      expect(ok(await acoes.previaContaAzulAcao(BACKUP)).lancamentosDoExtratoNoPeriodo).toBeGreaterThanOrEqual(1);
      expect(await acoes.importarContaAzulAcao({ "outro.csv": "a,b\n1,2" })).toEqual({ erroAcao: expect.stringMatching(/não parece um backup/) });
      expect(await acoes.previaContaAzulAcao({ "financeiro.csv": "x".repeat(3_000_001) })).toEqual({ erroAcao: expect.stringMatching(/limite/) });
    });
  });

  // Paridade 17/11 (EPIC-024 S-01 da Prospecta): os lançamentos do Conta Azul arquivados seguravam a chave única e a
  // prévia dizia "já importados". Mesmos cenários de Prospecta/server/bpo-conta-azul.test.ts ("arquivados que bloqueiam").
  describe("arquivados que bloqueiam a reimportação do Conta Azul", () => {
    const doFixture = { requestKey: { startsWith: CHAVE_FIXTURE } };
    /** Arquiva como a "limpeza de ajustes": backup JSON + exclusaoLoteBackupId nas linhas. */
    async function arquivarTudoDoContaAzul() {
      const rows = await prisma.bpoLancamento.findMany({ where: { ...doFixture, origemEfetiva: "conta_azul" }, orderBy: { id: "asc" } });
      const b = await prisma.bpoLancamentoExclusaoBackup.create({ data: {
        modo: "tudo", aba: "a_classificar", quantidade: rows.length,
        snapshotJson: JSON.stringify(rows.map((r) => ({ id: r.id, descricao: r.descricao, valor: r.valor, version: r.version, requestKey: r.requestKey, __limpezaAjustes: true }))),
      } });
      await prisma.bpoLancamento.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { exclusaoLoteBackupId: b.id } });
      return b.id;
    }
    const liberar = (confirmacao = "LIBERAR") => acoes.liberarReimportacaoContaAzulAcao({ arquivos: BACKUP, confirmacao });

    it("prévia e importação mostram os arquivados à parte (não como já importados)", async () => {
      ok(await acoes.importarContaAzulAcao(BACKUP));
      await arquivarTudoDoContaAzul();
      const p = ok(await acoes.previaContaAzulAcao(BACKUP));
      expect(p.lancamentos).toMatchObject({ novos: 0, jaImportados: 0, arquivados: { bloqueando: 4, liberaveis: 4, comVinculo: 0, outraOrigem: 0 } });
      expect(ok(await acoes.importarContaAzulAcao(BACKUP))).toMatchObject({ lancamentosCriados: 0, lancamentosJaImportados: 0, lancamentosArquivadosBloqueando: 4 });
    });

    it("liberar remove só os arquivados do Conta Azul sem vínculo, com cópia e histórico; o resto fica intacto", async () => {
      ok(await acoes.importarContaAzulAcao(BACKUP));
      const backupId = await arquivarTudoDoContaAzul();
      // um volta a ficar ativo; outro tem movimentação bancária; um legado arquivado de outra origem (outra chave)
      const ids = (await prisma.bpoLancamento.findMany({ where: doFixture, orderBy: { valor: "asc" }, select: { id: true } })).map((x) => x.id);
      await prisma.bpoLancamento.update({ where: { id: ids[0] }, data: { exclusaoLoteBackupId: null } });
      const conta = await criarConta();
      const t = await prisma.transacaoBancaria.create({ data: { contaId: conta.id, data: new Date("2026-04-15T12:00:00Z"), descricao: `${MARCA} Pix`, valor: 709, tipo: "debito" } });
      await prisma.bpoLancamento.update({ where: { id: ids[2] }, data: { transacaoId: t.id } });
      const legado = await novoLanc("Legado", { origemEfetiva: "legado", exclusaoLoteBackupId: backupId, requestKey: `${MARCA}-legado:1` });

      const p = ok(await acoes.previaContaAzulAcao(BACKUP));
      expect(p.lancamentos).toMatchObject({ jaImportados: 1, arquivados: { bloqueando: 3, liberaveis: 2, comVinculo: 1, outraOrigem: 0 } });
      expect(p.lancamentos.arquivados.exemplosComVinculo[0].motivos).toEqual(["ligado a uma movimentação bancária"]);

      expect(await liberar("sim")).toEqual({ erroAcao: expect.stringMatching(/Digite LIBERAR/) });
      expect(await prisma.bpoLancamento.count({ where: doFixture })).toBe(4);

      const r = ok(await liberar());
      expect(r).toMatchObject({ arquivados: 3, removidos: 2, mantidos: 1 });
      expect(r.mantidosDetalhe).toEqual([expect.objectContaining({ id: ids[2], motivos: ["ligado a uma movimentação bancária"] })]);
      expect((await prisma.bpoLancamento.findMany({ where: doFixture, select: { id: true } })).map((x) => x.id).sort()).toEqual([ids[0], ids[2]].sort());
      expect(await prisma.bpoLancamento.findUnique({ where: { id: legado.id } })).toMatchObject({ exclusaoLoteBackupId: backupId });
      const copias = await prisma.bpoLancamentoExpurgo.findMany({ where: { lancamentoId: { in: ids } }, orderBy: { lancamentoId: "asc" } });
      expect(copias.map((c) => c.lancamentoId)).toEqual([ids[1], ids[3]].sort());
      expect(new Set(copias.map((c) => c.loteId))).toEqual(new Set([r.loteId]));
      expect(JSON.parse(copias[0].dadosJson)).toMatchObject({ origemEfetiva: "conta_azul", exclusaoLoteBackupId: backupId });
      expect(copias[0].expurgadoPorUsuarioId).toBe("usuario-teste");
      expect(await prisma.bpoLancamentoHistorico.count({ where: { lancamentoReferencia: { in: ids }, motivo: { startsWith: "Removido em definitivo para liberar a reimportação" } } })).toBe(2);

      // de novo: nada mais a liberar além do que tem vínculo
      expect(ok(await liberar())).toMatchObject({ removidos: 0, mantidos: 1, loteId: null });
    });

    it("depois de liberar, reimporta tudo uma vez; a segunda importação não cria nada; restaurar a limpeza antiga não duplica", async () => {
      ok(await acoes.importarContaAzulAcao(BACKUP));
      const clientesAntes = await prisma.bpoCliente.count();
      const backupId = await arquivarTudoDoContaAzul();
      ok(await liberar());
      expect(await prisma.bpoLancamento.count({ where: doFixture })).toBe(0);

      expect(ok(await acoes.importarContaAzulAcao(BACKUP))).toMatchObject({ lancamentosCriados: 4, clientesCriados: 0, lancamentosArquivadosBloqueando: 0, transferenciasIgnoradas: 1 });
      expect(await prisma.bpoCliente.count()).toBe(clientesAntes);
      // transferência interna fora e a linha repetida por centro de custo sem dobrar
      const ls = await prisma.bpoLancamento.findMany({ where: doFixture, orderBy: { valor: "asc" } });
      expect(ls.reduce((s, l) => s + l.valor, 0)).toBe(2619.5);
      expect(ls.filter((l) => l.valor === 709).map((l) => l.centroCustos)).toEqual(["Santa Fe Canaa / Santa Fe Parauapebas"]);
      // classificação preservada: em aberto volta para A classificar, pago não
      expect(ls.filter((l) => [320.5, 1500].includes(l.valor)).map((l) => [l.valor, l.aClassificar])).toEqual([[320.5, true], [1500, false]]);

      expect(ok(await acoes.importarContaAzulAcao(BACKUP))).toMatchObject({ lancamentosCriados: 0, lancamentosJaImportados: 4, clientesCriados: 0 });
      expect(await prisma.bpoLancamento.count({ where: doFixture })).toBe(4);

      const previa = await lote.previaRestauracaoExclusao(backupId);
      expect(previa).toMatchObject({ restaurar: 0, jaExistem: 4 });
      if ("erro" in previa) throw new Error(previa.erro);
      for (const i of previa.itens) expect(i.avisos[0]).toMatch(/liberar a reimportação do Conta Azul/);
      expect(await lote.restaurarExclusaoEmLote({ backupId, confirmacao: "RESTAURAR" })).toMatchObject({ restaurados: 0 });
      expect(await prisma.bpoLancamento.count({ where: doFixture })).toBe(4);
    });

    it("restaurar uma exclusão antiga (backup JSON) pula a linha do Conta Azul que já foi reimportada (ativa ou arquivada)", async () => {
      ok(await acoes.importarContaAzulAcao(BACKUP));
      const l = await prisma.bpoLancamento.findFirstOrThrow({ where: { ...doFixture, valor: 320.5 } });
      const snapshot = [{ id: `${MARCA}-antigo`, tipo: "despesa", descricao: l.descricao, valor: l.valor, vencimento: "2026-04-10T12:00:00.000Z", competencia: "2026-04", requestKey: l.requestKey, origemEfetiva: "conta_azul", version: 1 }];
      const b = await prisma.bpoLancamentoExclusaoBackup.create({ data: { modo: "selecionados", aba: "despesas", quantidade: 1, snapshotJson: JSON.stringify(snapshot) } });
      const previa = await lote.previaRestauracaoExclusao(b.id);
      if ("erro" in previa) throw new Error(previa.erro);
      expect(previa.itens[0].avisos).toEqual([expect.stringMatching(/Já foi importado de novo do Conta Azul/)]);
      expect(await lote.restaurarExclusaoEmLote({ backupId: b.id, confirmacao: "RESTAURAR" })).toMatchObject({ restaurados: 0, jaExistiam: 1 });
      expect(await prisma.bpoLancamento.count({ where: { ...doFixture, valor: 320.5 } })).toBe(1);
      // com a linha reimportada ARQUIVADA, o aviso é outro (e também não duplica)
      await arquivarTudoDoContaAzul();
      const b2 = await prisma.bpoLancamentoExclusaoBackup.create({ data: { modo: "selecionados", aba: "despesas", quantidade: 1, snapshotJson: JSON.stringify(snapshot) } });
      const previa2 = await lote.previaRestauracaoExclusao(b2.id);
      if ("erro" in previa2) throw new Error(previa2.erro);
      expect(previa2).toMatchObject({ restaurar: 0, jaExistem: 1 });
      expect(previa2.itens[0].avisos).toEqual([expect.stringMatching(/outro lançamento ARQUIVADO/)]);
    });

    it("só o admin libera: sem o perfil admin a ação é recusada e nada é apagado", async () => {
      ok(await acoes.importarContaAzulAcao(BACKUP));
      await arquivarTudoDoContaAzul();
      guardas.exigirAdminAtivo.mockRejectedValueOnce(new Error("Não autorizado."));
      expect(await liberar()).toEqual({ erroAcao: "Não autorizado." });
      expect(await prisma.bpoLancamento.count({ where: doFixture })).toBe(4);
      expect(ok(await liberar())).toMatchObject({ removidos: 4 });
    });

    it("arquivado de OUTRA origem com a chave do Conta Azul: contado à parte, com o motivo, e nunca removido", async () => {
      ok(await acoes.importarContaAzulAcao(BACKUP));
      await arquivarTudoDoContaAzul();
      const l = await prisma.bpoLancamento.findFirstOrThrow({ where: { ...doFixture, valor: 1500 } });
      await prisma.bpoLancamento.update({ where: { id: l.id }, data: { origemEfetiva: "legado" } });
      const p = ok(await acoes.previaContaAzulAcao(BACKUP));
      expect(p.lancamentos.arquivados).toMatchObject({ bloqueando: 4, liberaveis: 3, comVinculo: 0, outraOrigem: 1 });
      expect(p.lancamentos.arquivados.exemplosComVinculo[0].motivos[0]).toMatch(/origem "legado"/);
      expect(ok(await liberar())).toMatchObject({ removidos: 3, mantidos: 1 });
      expect(await prisma.bpoLancamento.findMany({ where: doFixture, select: { id: true, origemEfetiva: true } })).toEqual([{ id: l.id, origemEfetiva: "legado" }]);
    });

    it("cobrança combinada num arquivado (ou com baixa) não é removida", async () => {
      ok(await acoes.importarContaAzulAcao(BACKUP));
      await arquivarTudoDoContaAzul();
      const [a, b] = await prisma.bpoLancamento.findMany({ where: doFixture, orderBy: { valor: "asc" } });
      const filho = await novoLanc("filho combinado", { combinadaEmId: a.id });
      await prisma.bpoBaixa.create({ data: { lancamentoId: b.id, requestKey: `${MARCA}-baixa`, valor: 1, data: new Date(), motivo: "teste", usuarioId: "usuario-teste" } });
      const r = ok(await liberar());
      expect(r).toMatchObject({ removidos: 2, mantidos: 2 });
      expect(r.mantidosDetalhe.map((m) => m.motivos)).toEqual(expect.arrayContaining([["outra cobrança foi combinada nele"], ["tem baixa registrada em recebimentos"]]));
      await prisma.bpoLancamento.delete({ where: { id: filho.id } });
    });

    it("restaurar limpeza cujos lançamentos foram apagados fora do sistema: mensagem simples e nada recriado", async () => {
      ok(await acoes.importarContaAzulAcao(BACKUP));
      const backupId = await arquivarTudoDoContaAzul();
      await prisma.bpoLancamento.deleteMany({ where: doFixture }); // apagados direto no banco, sem expurgo
      const previa = await lote.previaRestauracaoExclusao(backupId);
      if ("erro" in previa) throw new Error(previa.erro);
      expect(previa).toMatchObject({ restaurar: 0, jaExistem: 4 });
      for (const i of previa.itens) expect(i.avisos).toEqual([expect.stringMatching(/não existe mais \(foi apagado em definitivo\)/)]);
      expect(await lote.restaurarExclusaoEmLote({ backupId, confirmacao: "RESTAURAR" })).toMatchObject({ restaurados: 0 });
      expect(await prisma.bpoLancamento.count({ where: doFixture })).toBe(0);
    });
  });

  describe("movimentação nova do banco", () => {
    it("depois do backup: o pago do Conta Azul só é ligado; em aberto e o resto ficam A classificar; nada entra no DRE", async () => {
      ok(await acoes.importarContaAzulAcao(BACKUP));
      const conta = await criarConta();
      const r = await gravar(conta, [
        mov(1, "2026-04-16", 709, "debito", "Contador"), // pago no Conta Azul em 15/04 → só liga
        mov(2, "2026-04-10", 320.5, "debito", "Cimento"), // em aberto no Conta Azul → nunca baixa sozinho
        mov(3, "2026-04-11", 19.9, "debito", "Tarifa pacote"), // sem correspondência
        mov(4, "2026-04-12", 100, "debito", "Transferência entre contas mesma titularidade"), // transferência interna
      ]);
      expect(r).toMatchObject({ novos: 4, aClassificar: 2 });
      const t1 = await txDe(`${MARCA}-1`);
      expect(t1.aClassificar).toBe(false);
      expect(t1.lancamento).toMatchObject({ origemEfetiva: "conta_azul", valor: 709, pago: true });
      expect(t1.lancamento!.pagoEm!.toISOString().slice(0, 10)).toBe("2026-04-15"); // não muda a data do Conta Azul
      for (const n of [2, 3]) expect(await txDe(`${MARCA}-${n}`)).toMatchObject({ aClassificar: true, lancamento: null });
      const aberto = await prisma.bpoLancamento.findFirstOrThrow({ where: { requestKey: { startsWith: CHAVE_FIXTURE }, valor: 320.5 } });
      expect(aberto).toMatchObject({ pago: false, aClassificar: true, transacaoId: null });
      // Paridade 17/11, bloco 3 (expectativa mudada; antes: lançamento "Transferência interna" fora de listas/DRE, regra
      // antiga do Santa Fé): como na Prospecta, a transferência interna não gera lançamento nem vai para A classificar.
      expect(await txDe(`${MARCA}-4`)).toMatchObject({ categoria: "Transferência interna", aClassificar: false, lancamento: null });
      expect(await prisma.bpoLancamento.count({ where: { origemEfetiva: "extrato", transacao: { contaId: conta.id }, categoria: { not: "Transferência interna" } } })).toBe(0);
      expect(ok(await acoes.dadosAClassificar()).contagem.movimentacoes).toBeGreaterThanOrEqual(2);
      // reimportar as mesmas linhas não muda nada
      expect(await gravar(conta, [mov(3, "2026-04-11", 19.9, "debito", "Tarifa pacote")])).toMatchObject({ novos: 0, lancamentosCriados: 0 });
    });

    it("regra do titular (com categoria) cria o lançamento na hora; sem regra fica A classificar", async () => {
      await prisma.bpoRegraTitular.create({ data: { titularNormalizado: "teste paridade bpo posto", categoria: "Administrativo" } });
      const conta = await criarConta();
      await gravar(conta, [mov(1, "2026-10-01", 50, "debito", "Abastecimento", { titular: `${MARCA} Posto` }), mov(2, "2026-10-01", 60, "debito", "Outra coisa", { titular: `${MARCA} Outro` })]);
      expect((await txDe(`${MARCA}-1`)).lancamento).toMatchObject({ categoria: "Administrativo", pago: true, origemEfetiva: "extrato" });
      expect(await txDe(`${MARCA}-2`)).toMatchObject({ aClassificar: true, lancamento: null });
    });

    it("criar lançamento (lote) classifica, grava o centro de custo e limpa a marca; ignorar tira de A classificar sem entrar no resultado", async () => {
      const conta = await criarConta();
      const cliente = await prisma.bpoCliente.create({ data: { razaoSocial: `${MARCA} Cliente`, responsavel: "x", telefone: "1", honorarios: 0, dataInicio: new Date() } });
      await gravar(conta, [mov(1, "2026-10-01", 1500, "credito", "Pix A"), mov(2, "2026-10-02", 200, "credito", "Pix B"), mov(3, "2026-10-03", 30, "debito", "Ted")]);
      const [t1, t2, t3] = await Promise.all([1, 2, 3].map((n) => txDe(`${MARCA}-${n}`)));
      expect(ok(await acoes.criarLancamentosAClassificar({ ids: [t1.id, t2.id], categoria: "Recebimento de cliente", bpoClienteId: cliente.id, centroCustos: "Obra Norte" }))).toEqual({ classificadas: 2 });
      for (const t of [t1, t2]) {
        const depois = await txDe(t.externalId!);
        expect(depois.aClassificar).toBe(false);
        expect(depois.lancamento).toMatchObject({ tipo: "recebimento", pago: true, categoria: "Recebimento de cliente", clienteId: cliente.id, centroCustos: "Obra Norte", aClassificar: false });
      }
      expect(await acoes.criarLancamentosAClassificar({ ids: [t1.id], categoria: "Outros" })).toEqual({ erroAcao: expect.stringMatching(/Nenhuma das movimentações/) });
      expect(await acoes.criarLancamentosAClassificar({ ids: [t3.id], categoria: "Transferência interna" })).toEqual({ erroAcao: expect.stringMatching(/Transferência interna \/ ignorar/) });
      expect(ok(await acoes.ignorarAClassificar([t3.id]))).toEqual({ ignoradas: 1 });
      const t3d = await txDe(t3.externalId!);
      expect(t3d.aClassificar).toBe(false);
      // Paridade 17/11, bloco 3 (expectativa mudada; antes: lançamento com a categoria "Transferência interna"): sem lançamento.
      expect(t3d).toMatchObject({ categoria: "Transferência interna", lancamento: null });
      const dre = resultado.dreFiltrado(resultado.celulasDre(await visiveis()));
      expect(dre.porCompetencia).toEqual([{ competencia: "2026-10", receitas: 1700, despesas: 0, resultado: 1700 }]);
    });

    it("reprocessar não cria lançamento para movimentação A classificar (e cria para as antigas, como antes)", async () => {
      const conta = await criarConta();
      await gravar(conta, [mov(1, "2026-10-01", 10, "debito", "Nova")]);
      const antiga = await prisma.transacaoBancaria.create({ data: { contaId: conta.id, data: new Date("2026-09-01T12:00:00Z"), descricao: `${MARCA} antiga`, valor: 5, tipo: "debito", externalId: `${MARCA}-antiga` } });
      await lanc.reprocessarMovimentacoes();
      expect(await txDe(`${MARCA}-1`)).toMatchObject({ aClassificar: true, lancamento: null });
      expect((await txDe(antiga.externalId!)).lancamento).toMatchObject({ pago: true, valor: 5 });
    });

    it("classificar no painel Bancos (com categoria) cria o lançamento e aplica às do mesmo titular; só cliente não cria", async () => {
      const conta = await criarConta();
      const cliente = await prisma.bpoCliente.create({ data: { razaoSocial: `${MARCA} Cli`, responsavel: "x", telefone: "1", honorarios: 0, dataInicio: new Date() } });
      await gravar(conta, [
        mov(1, "2026-10-01", 10, "debito", "Loja", { titular: `${MARCA} Loja` }), mov(2, "2026-10-02", 11, "debito", "Loja 2", { titular: `${MARCA} Loja` }),
        mov(3, "2026-10-03", 12, "credito", "Pix", { titular: `${MARCA} Joana` }), mov(4, "2026-10-04", 13, "credito", "Pix 2", { titular: `${MARCA} Joana` }),
      ]);
      const [t1, , t3] = await Promise.all([1, 2, 3].map((n) => txDe(`${MARCA}-${n}`)));
      await lanc.classificarTransacao(t1.id, { categoria: "Material" });
      for (const n of [1, 2]) expect((await txDe(`${MARCA}-${n}`)).lancamento).toMatchObject({ categoria: "Material" });
      await lanc.classificarTransacao(t3.id, { clienteId: cliente.id });
      expect((await txDe(`${MARCA}-3`)).lancamento).toMatchObject({ clienteId: cliente.id }); // a própria foi classificada
      expect(await txDe(`${MARCA}-4`)).toMatchObject({ aClassificar: true, lancamento: null, bpoClienteId: cliente.id }); // a outra só ganhou o cliente
    });
  });

  describe("lançamentos em aberto a classificar", () => {
    it("ficam fora das listas e do DRE; Confirmar traz de volta com histórico; baixa manual também tira da aba", async () => {
      const a = await novoLanc("Em aberto A", { aClassificar: true, valor: 400 });
      const b = await novoLanc("Em aberto B", { aClassificar: true, valor: 250 });
      expect((await visiveis()).map((l) => l.id)).toEqual([]);
      const dados = ok(await acoes.dadosAClassificar());
      expect(dados.lancamentos.map((l) => l.id)).toEqual(expect.arrayContaining([a.id, b.id]));
      expect(ok(await acoes.confirmarAClassificar([a.id]))).toEqual({ confirmados: 1 });
      expect(await prisma.bpoLancamento.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ aClassificar: false, version: 2, pago: false });
      expect(await prisma.bpoLancamentoHistorico.count({ where: { lancamentoId: a.id, motivo: "Confirmado na aba A classificar" } })).toBe(1);
      await bpo.registrarBaixaBpo({ id: b.id, version: b.version, requestKey: `${MARCA}-baixa`, valor: 50, data: "2026-10-11", motivo: "Pix parcial" });
      expect(await prisma.bpoLancamento.findUniqueOrThrow({ where: { id: b.id } })).toMatchObject({ aClassificar: false, valorRecebido: 50, pago: false });
      expect((await visiveis()).map((l) => l.id).sort()).toEqual([a.id, b.id].sort());
    });

    it("Cancelar arquiva (reversível, com backup) e Restaurar devolve para A classificar", async () => {
      const a = await novoLanc("Cancelar", { aClassificar: true });
      await novoLanc("Cobrança comum");
      const entrada = { aba: "a_classificar" as const, modo: "selecionados" as const, ids: [a.id], limpezaAjustes: true };
      const previa = await lote.previaExclusaoLote(entrada);
      if ("erro" in previa) throw new Error(previa.erro);
      expect(previa).toMatchObject({ excluiveis: 1, protegidos: 0 });
      const r = await lote.excluirLancamentosEmLote({ ...entrada, confirmacao: "EXCLUIR", previaToken: previa.previaToken });
      if ("erro" in r) throw new Error(r.erro);
      expect(r.excluidos).toBe(1);
      expect((await prisma.bpoLancamento.findUniqueOrThrow({ where: { id: a.id } })).exclusaoLoteBackupId).toBe(r.backupId);
      expect(ok(await acoes.dadosAClassificar()).lancamentos.some((l) => l.id === a.id)).toBe(false);
      const volta = await lote.restaurarExclusaoEmLote({ backupId: r.backupId!, confirmacao: "RESTAURAR" });
      if ("erro" in volta) throw new Error(volta.erro);
      expect(await prisma.bpoLancamento.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ exclusaoLoteBackupId: null, aClassificar: true });
    });
  });

  describe("Asaas", () => {
    const fetchCobrancas = (cobrancas: object[]) => (async () => new Response(JSON.stringify({ data: cobrancas, hasMore: false }), { status: 200 })) as unknown as typeof fetch;

    it("cobrança paga assume a receita JÁ PAGA do Conta Azul; paga ↔ em aberto não liga (a em aberto continua A classificar)", async () => {
      const pagaCA = await novoLanc("Receita CA paga", { origemEfetiva: "conta_azul", valor: 777.77, pago: true, valorRecebido: 777.77, pagoEm: new Date("2026-10-05T12:00:00Z"), requestKey: `${MARCA}-ca1` });
      const abertaCA = await novoLanc("Receita CA aberta", { origemEfetiva: "conta_azul", valor: 888.88, aClassificar: true, vencimento: new Date("2026-10-06T12:00:00Z"), requestKey: `${MARCA}-ca2` });
      const r = await asaas.sincronizarCobrancasAsaas("$aact_teste", "2026-10-01", fetchCobrancas([
        { id: `${MARCA}-pay1`, status: "RECEIVED", value: 777.77, dueDate: "2026-10-05", paymentDate: "2026-10-06", description: `${MARCA} c1` },
        { id: `${MARCA}-pay2`, status: "RECEIVED", value: 888.88, dueDate: "2026-10-06", paymentDate: "2026-10-06", description: `${MARCA} c2` },
      ]));
      expect(r).toMatchObject({ reconciliadas: 1, criadas: 1 });
      expect(await prisma.bpoLancamento.findUniqueOrThrow({ where: { id: pagaCA.id } })).toMatchObject({ asaasPaymentId: `${MARCA}-pay1`, pago: true, aClassificar: false });
      expect(await prisma.bpoLancamento.findUniqueOrThrow({ where: { id: abertaCA.id } })).toMatchObject({ asaasPaymentId: null, pago: false, aClassificar: true });
      expect(await prisma.bpoLancamento.findUniqueOrThrow({ where: { asaasPaymentId: `${MARCA}-pay2` } })).toMatchObject({ origemEfetiva: "asaas", pago: true });
      // rodar de novo não duplica
      await asaas.sincronizarCobrancasAsaas("$aact_teste", "2026-10-01", fetchCobrancas([{ id: `${MARCA}-pay1`, status: "RECEIVED", value: 777.77, dueDate: "2026-10-05", paymentDate: "2026-10-06" }]));
      expect(await prisma.bpoLancamento.count({ where: { OR: [{ asaasPaymentId: `${MARCA}-pay1` }, { valor: 777.77, descricao: { startsWith: MARCA } }] } })).toBe(1);
    });

    it("crédito do Asaas que chegou antes da cobrança fica A classificar e a cobrança o assume (sem duplicar)", async () => {
      const conta = await criarConta({ provedor: "asaas" });
      await bancos.gravarMovimentos(conta, [mov(1, "2026-10-07", 345.6, "credito", "Recebimento", { asaasPaymentId: `${MARCA}-pay9` })], "asaas");
      const t = await txDe(`${MARCA}-1`);
      expect(t).toMatchObject({ aClassificar: true, lancamento: null });
      await asaas.sincronizarCobrancasAsaas("$aact_teste", "2026-10-01", fetchCobrancas([{ id: `${MARCA}-pay9`, status: "RECEIVED", value: 345.6, dueDate: "2026-10-07", paymentDate: "2026-10-07" }]));
      const depois = await txDe(`${MARCA}-1`);
      expect(depois.aClassificar).toBe(false);
      expect(depois.lancamento).toMatchObject({ asaasPaymentId: `${MARCA}-pay9`, transacaoId: t.id });
      expect(await prisma.bpoLancamento.count({ where: { asaasPaymentId: `${MARCA}-pay9` } })).toBe(1);
    });

    // Paridade 17/11, bloco 3 (Prospecta server/bpo-asaas.ts, passo 3): crédito do Asaas SEM id de pagamento.
    it("crédito do Asaas sem id de pagamento: a cobrança paga de mesmo valor (bruto ou líquido) e data até 3 dias o assume; sem duplicar", async () => {
      const conta = await criarConta({ provedor: "asaas" });
      await bancos.gravarMovimentos(conta, [
        mov(1, "2026-10-08", 97.01, "credito", "Recebimento sem id"), // líquido da cobrança payA
        mov(2, "2026-10-08", 250, "credito", "Outro crédito"),
      ], "asaas");
      const t1 = await txDe(`${MARCA}-1`);
      expect(t1).toMatchObject({ aClassificar: true, lancamento: null, asaasPaymentId: null });
      // crédito antigo com lançamento do extrato (regra anterior a 13/11): o lançamento vira a cobrança
      const t3 = await prisma.transacaoBancaria.create({ data: { contaId: conta.id, data: new Date("2026-10-09T12:00:00Z"), descricao: `${MARCA} crédito antigo`, valor: 410, tipo: "credito", externalId: `${MARCA}-antigo`, origem: "asaas" } });
      const antigo = await novoLanc("crédito antigo", { origemEfetiva: "extrato", transacaoId: t3.id, valor: 410, pago: true, pagoEm: t3.data, categoria: "Recebimento de cliente" });
      const r = await asaas.sincronizarCobrancasAsaas("$aact_teste", "2026-10-01", fetchCobrancas([
        { id: `${MARCA}-payA`, status: "RECEIVED", value: 99.99, netValue: 97.01, dueDate: "2026-10-05", paymentDate: "2026-10-06", description: `${MARCA} a` },
        { id: `${MARCA}-payB`, status: "CONFIRMED", value: 410, dueDate: "2026-10-09", paymentDate: "2026-10-10", description: `${MARCA} b` },
        // mesmo valor do outro crédito, mas 5 dias longe: não liga (entra como cobrança nova)
        { id: `${MARCA}-payC`, status: "RECEIVED", value: 250, dueDate: "2026-10-01", paymentDate: "2026-10-03", description: `${MARCA} c` },
        // em aberto nunca liga a crédito
        { id: `${MARCA}-payD`, status: "PENDING", value: 250, dueDate: "2026-10-08", description: `${MARCA} d` },
      ]));
      expect(r).toMatchObject({ reconciliadas: 2, criadas: 2 });
      const d1 = await txDe(`${MARCA}-1`);
      expect(d1).toMatchObject({ aClassificar: false, asaasPaymentId: `${MARCA}-payA` });
      expect(d1.lancamento).toMatchObject({ asaasPaymentId: `${MARCA}-payA`, valor: 97.01, pago: true, aClassificar: false, tipo: "recebimento" });
      expect(d1.lancamento!.pagoEm!.toISOString().slice(0, 10)).toBe("2026-10-08"); // a data do dinheiro que entrou
      expect(await prisma.bpoLancamento.findUniqueOrThrow({ where: { id: antigo.id } })).toMatchObject({ asaasPaymentId: `${MARCA}-payB`, valor: 410, pago: true });
      expect((await prisma.transacaoBancaria.findUniqueOrThrow({ where: { id: t3.id } })).asaasPaymentId).toBe(`${MARCA}-payB`);
      expect(await txDe(`${MARCA}-2`)).toMatchObject({ aClassificar: true, lancamento: null, asaasPaymentId: null });
      expect(await prisma.bpoLancamento.findUniqueOrThrow({ where: { asaasPaymentId: `${MARCA}-payC` } })).toMatchObject({ transacaoId: null, pago: true });
      expect(await prisma.bpoLancamento.findUniqueOrThrow({ where: { asaasPaymentId: `${MARCA}-payD` } })).toMatchObject({ transacaoId: null, pago: false });
      // rodar de novo não duplica nada (agora o extrato já tem o id do pagamento)
      const r2 = await asaas.sincronizarCobrancasAsaas("$aact_teste", "2026-10-01", fetchCobrancas([
        { id: `${MARCA}-payA`, status: "RECEIVED", value: 99.99, netValue: 97.01, dueDate: "2026-10-05", paymentDate: "2026-10-06" },
        { id: `${MARCA}-payB`, status: "CONFIRMED", value: 410, dueDate: "2026-10-09", paymentDate: "2026-10-10" },
      ]));
      expect(r2).toMatchObject({ criadas: 0, reconciliadas: 0, atualizadas: 2 });
      for (const pid of ["payA", "payB"]) expect(await prisma.bpoLancamento.count({ where: { asaasPaymentId: `${MARCA}-${pid}` } })).toBe(1);
      expect(await prisma.bpoLancamento.count({ where: { transacaoId: { in: [t1.id, t3.id] } } })).toBe(2);
    });

    it("crédito com o id da cobrança marcado como transferência interna (sem lançamento) não vira receita", async () => {
      const conta = await criarConta({ provedor: "asaas" });
      await bancos.gravarMovimentos(conta, [mov(1, "2026-10-07", 600, "credito", "Repasse", { asaasPaymentId: `${MARCA}-payT` })], "asaas");
      const t = await txDe(`${MARCA}-1`);
      expect(ok(await acoes.ignorarAClassificar([t.id]))).toEqual({ ignoradas: 1 });
      expect(await txDe(`${MARCA}-1`)).toMatchObject({ categoria: "Transferência interna", lancamento: null });
      const r = await asaas.sincronizarCobrancasAsaas("$aact_teste", "2026-10-01", fetchCobrancas([{ id: `${MARCA}-payT`, status: "RECEIVED", value: 600, dueDate: "2026-10-07", paymentDate: "2026-10-07" }]));
      expect(r).toMatchObject({ criadas: 0, reconciliadas: 0 });
      expect(await prisma.bpoLancamento.count({ where: { OR: [{ asaasPaymentId: `${MARCA}-payT` }, { transacaoId: t.id }] } })).toBe(0);
    });
  });

  // Paridade 17/11, bloco 3 (Prospecta): transferência interna não gera lançamento; os já gravados ficam como estão.
  describe("transferência interna", () => {
    it("nova, reprocessar e classificar no painel Bancos não criam lançamento; DRE e listas não mudam; os antigos ficam intactos", async () => {
      const conta = await criarConta();
      // Lançamento de transferência gravado ANTES (regra antiga): continua igual e fora das listas/DRE.
      const tAntiga = await prisma.transacaoBancaria.create({ data: { contaId: conta.id, data: new Date("2026-10-02T12:00:00Z"), descricao: `${MARCA} transferência antiga`, valor: 900, tipo: "debito", categoria: "Transferência interna", externalId: `${MARCA}-ti-antiga` } });
      const lAntigo = await novoLanc("transferência antiga", { tipo: "despesa", origemEfetiva: "extrato", transacaoId: tAntiga.id, valor: 900, pago: true, pagoEm: tAntiga.data, categoria: "Transferência interna", competencia: "2026-10" });
      await gravar(conta, [
        mov(1, "2026-10-03", 1000, "debito", "Transferência entre contas mesma titularidade"),
        mov(2, "2026-10-04", 50, "debito", "Tarifa"),
      ]);
      expect(await txDe(`${MARCA}-1`)).toMatchObject({ categoria: "Transferência interna", aClassificar: false, lancamento: null });
      // reprocessar (rede diária / backfill) também não cria
      await lanc.reprocessarMovimentacoes();
      expect((await txDe(`${MARCA}-1`)).lancamento).toBeNull();
      // painel Bancos: marcar outra movimentação como transferência interna não cria; voltar a uma categoria cria
      const t2 = await txDe(`${MARCA}-2`);
      await lanc.classificarTransacao(t2.id, { categoria: "Transferência interna" });
      expect(await txDe(`${MARCA}-2`)).toMatchObject({ categoria: "Transferência interna", aClassificar: false, lancamento: null });
      await lanc.classificarTransacao(t2.id, { categoria: "Tarifas bancárias" });
      expect((await txDe(`${MARCA}-2`)).lancamento).toMatchObject({ categoria: "Tarifas bancárias", valor: 50, pago: true });
      // o lançamento antigo não foi tocado
      const depois = await prisma.bpoLancamento.findUniqueOrThrow({ where: { id: lAntigo.id } });
      expect(depois).toMatchObject({ categoria: "Transferência interna", valor: 900, transacaoId: tAntiga.id, version: lAntigo.version });
      // DRE: só a tarifa (as transferências, antiga e nova, ficam fora como antes)
      const dre = resultado.dreFiltrado(resultado.celulasDre(await visiveis()));
      expect(dre.porCompetencia).toEqual([{ competencia: "2026-10", receitas: 0, despesas: 50, resultado: -50 }]);
      expect(await prisma.bpoLancamento.count({ where: { transacao: { contaId: conta.id } } })).toBe(2); // antiga + tarifa
    });
  });

  describe("dividir pagamentos", () => {
    const preparar = async () => {
      const conta = await criarConta();
      await gravar(conta, [mov(1, "2026-10-15", 500, "credito", "Pix grande"), mov(2, "2026-10-16", 80, "debito", "Ted parcial 1"), mov(3, "2026-10-17", 70, "debito", "Ted parcial 2")]);
      const [t1, t2, t3] = await Promise.all([1, 2, 3].map((n) => txDe(`${MARCA}-${n}`)));
      const c1 = await novoLanc("Parcela 1", { valor: 300, vencimento: new Date("2026-10-15T12:00:00Z") });
      const c2 = await novoLanc("Parcela 2", { valor: 200, aClassificar: true });
      const d1 = await novoLanc("Fornecedor", { tipo: "despesa", valor: 150 });
      return { conta, t1, t2, t3, c1, c2, d1 };
    };

    it("sugestões só do mesmo sentido e em aberto (inclui as A classificar), mesmo valor primeiro", async () => {
      const { t1, c1, c2, d1 } = await preparar();
      const r = ok(await acoes.abertosParaBaixaAcao(t1.id));
      const ids = r.abertos.map((l) => l.id);
      expect(ids).toEqual(expect.arrayContaining([c1.id, c2.id]));
      expect(ids).not.toContain(d1.id);
      expect(r.abertos.find((l) => l.id === c2.id)?.aClassificar).toBe(true);
    });

    it("1 → N: a soma tem que fechar exatamente, nenhum valor passa do saldo; quita os dois sem lançamento próprio da movimentação", async () => {
      const { t1, c1, c2 } = await preparar();
      expect(await acoes.darBaixaAcao({ movimentacaoId: t1.id, alocacoes: [{ lancamentoId: c1.id, valor: 300 }, { lancamentoId: c2.id, valor: 199.99 }] }))
        .toEqual({ erroAcao: expect.stringMatching(/exatamente o valor da movimentação \(500\.00\)/) });
      expect(await acoes.darBaixaAcao({ movimentacaoId: t1.id, alocacoes: [{ lancamentoId: c1.id, valor: 300.01 }, { lancamentoId: c2.id, valor: 199.99 }] }))
        .toEqual({ erroAcao: expect.stringMatching(/passa do saldo/) });
      expect(await prisma.bpoBaixa.count({ where: { transacaoId: t1.id } })).toBe(0); // recusa não grava nada
      const r = ok(await acoes.darBaixaAcao({ movimentacaoId: t1.id, alocacoes: [{ lancamentoId: c1.id, valor: 300 }, { lancamentoId: c2.id, valor: 200 }] }));
      expect(r).toMatchObject({ repetida: false, alocacoes: [{ lancamentoId: c1.id, pago: true, saldo: 0 }, { lancamentoId: c2.id, pago: true, saldo: 0 }] });
      for (const l of [c1, c2]) {
        const d = await prisma.bpoLancamento.findUniqueOrThrow({ where: { id: l.id } });
        expect(d).toMatchObject({ pago: true, aClassificar: false, version: 2, transacaoId: null });
        expect(d.pagoEm?.toISOString().slice(0, 10)).toBe("2026-10-15");
      }
      expect((await prisma.bpoBaixa.findMany({ where: { transacaoId: t1.id }, orderBy: { valor: "asc" } })).map((b) => [b.requestKey, b.valor, b.usuarioId]))
        .toEqual([[`bt:${t1.id}:${c2.id}`, 200, "usuario-teste"], [`bt:${t1.id}:${c1.id}`, 300, "usuario-teste"]]);
      expect(await prisma.bpoLancamentoHistorico.count({ where: { lancamentoId: { in: [c1.id, c2.id] }, motivo: { startsWith: "Quitado pela movimentação" } } })).toBe(2);
      expect(await txDe(t1.externalId!)).toMatchObject({ aClassificar: false, status: "conciliado", lancamento: null });
      // reprocessar/classificar nunca cria lançamento para a movimentação que deu baixa (sem dupla contagem)
      await lanc.reprocessarMovimentacoes();
      await lanc.classificarTransacao(t1.id, { categoria: "Recebimento de cliente" });
      expect((await txDe(t1.externalId!)).lancamento).toBeNull();
      const dre = resultado.dreFiltrado(resultado.celulasDre((await visiveis()).filter((l) => l.tipo !== "despesa")));
      expect(dre.porCompetencia.reduce((s, l) => s + l.receitas, 0)).toBe(500);
    });

    it("idempotente: repetir a mesma divisão não duplica; outra divisão é recusada; chamadas simultâneas gravam uma vez", async () => {
      const { t1, c1, c2 } = await preparar();
      const divisao = { movimentacaoId: t1.id, alocacoes: [{ lancamentoId: c1.id, valor: 300 }, { lancamentoId: c2.id, valor: 200 }] };
      const [a, b] = await Promise.all([acoes.darBaixaAcao(divisao), acoes.darBaixaAcao(divisao)]);
      expect([ok(a).repetida, ok(b).repetida].sort()).toEqual([false, true]);
      expect(ok(await acoes.darBaixaAcao(divisao)).repetida).toBe(true);
      expect(await acoes.darBaixaAcao({ movimentacaoId: t1.id, alocacoes: [{ lancamentoId: c1.id, valor: 500 }] })).toEqual({ erroAcao: expect.stringMatching(/já foi usada/) });
      expect(await prisma.bpoBaixa.count({ where: { transacaoId: t1.id } })).toBe(2);
      expect((await prisma.bpoLancamento.findUniqueOrThrow({ where: { id: c1.id } })).valorRecebido).toBe(300);
    });

    it("N → 1 em despesa: pagamentos parciais acumulam e só quita quando fecha o valor", async () => {
      const { t2, t3, d1 } = await preparar();
      expect(ok(await acoes.darBaixaAcao({ movimentacaoId: t2.id, alocacoes: [{ lancamentoId: d1.id, valor: 80 }] })).alocacoes[0]).toMatchObject({ pago: false, saldo: 70 });
      expect(await prisma.bpoLancamento.findUniqueOrThrow({ where: { id: d1.id } })).toMatchObject({ pago: false, valorRecebido: 80, pagoEm: null });
      expect(ok(await acoes.darBaixaAcao({ movimentacaoId: t3.id, alocacoes: [{ lancamentoId: d1.id, valor: 70 }] })).alocacoes[0]).toMatchObject({ pago: true, saldo: 0 });
      const d = await prisma.bpoLancamento.findUniqueOrThrow({ where: { id: d1.id } });
      expect(d).toMatchObject({ pago: true, valorRecebido: 150 });
      expect(d.pagoEm?.toISOString().slice(0, 10)).toBe("2026-10-17");
    });

    it("recusa movimentação fora de A classificar, sentido trocado e lançamento já ligado 1:1 a outra movimentação", async () => {
      const { conta, t1, t2, c1 } = await preparar();
      expect(await acoes.darBaixaAcao({ movimentacaoId: t2.id, alocacoes: [{ lancamentoId: c1.id, valor: 80 }] })).toEqual({ erroAcao: expect.stringMatching(/outro sentido/) });
      const outra = await prisma.transacaoBancaria.create({ data: { contaId: conta.id, data: new Date(), descricao: `${MARCA} outra`, valor: 500, tipo: "credito", externalId: `${MARCA}-outra` } });
      const ligado = await novoLanc("Ligado", { valor: 500, transacaoId: outra.id });
      expect(await acoes.darBaixaAcao({ movimentacaoId: t1.id, alocacoes: [{ lancamentoId: ligado.id, valor: 500 }] })).toEqual({ erroAcao: expect.stringMatching(/ligado a outra movimentação/) });
      expect(await acoes.darBaixaAcao({ movimentacaoId: outra.id, alocacoes: [{ lancamentoId: c1.id, valor: 300 }] })).toEqual({ erroAcao: expect.stringMatching(/não está em A classificar/) });
    });

    it("a conciliação com o Conta Azul ignora lançamento que já recebeu baixa do banco", async () => {
      const conta = await criarConta();
      const pagoCA = await novoLanc("CA pago", { origemEfetiva: "conta_azul", tipo: "despesa", valor: 42, requestKey: `${MARCA}-ca9`, aClassificar: true });
      await gravar(conta, [mov(1, "2026-10-15", 42, "debito", "Pagamento")]);
      const t1 = await txDe(`${MARCA}-1`);
      ok(await acoes.darBaixaAcao({ movimentacaoId: t1.id, alocacoes: [{ lancamentoId: pagoCA.id, valor: 42 }] }));
      await gravar(conta, [mov(2, "2026-10-15", 42, "debito", "Pagamento repetido")]);
      expect(await txDe(`${MARCA}-2`)).toMatchObject({ aClassificar: true, lancamento: null });
    });
  });

  describe("centros de custo e filtros no servidor", () => {
    it("criar, listar com uso, renomear (inclusive nos combinados), desativar; nome igual sem acento é recusado também pelo banco", async () => {
      await novoLanc("a", { centroCustos: `${MARCA} Canaa / ${MARCA} Para` });
      await novoLanc("b", { centroCustos: `${MARCA} Para` });
      const para = ok(await acoes.criarCentroCustoAcao(`${MARCA} Para`));
      ok(await acoes.criarCentroCustoAcao(`${MARCA} Canaa`));
      expect(await acoes.criarCentroCustoAcao(`${MARCA.toLowerCase()}  pará`)).toEqual({ erroAcao: expect.stringMatching(/Já existe/) });
      expect(await acoes.criarCentroCustoAcao("A/B")).toEqual({ erroAcao: expect.stringMatching(/separador/) });
      await expect(prisma.bpoCentroCusto.create({ data: { nome: `${MARCA} CANAÃ` } })).rejects.toThrow();
      const lista = ok(await acoes.listarCentrosCustoAcao()).filter((c) => c.nome.startsWith(MARCA));
      expect(lista.map((c) => [c.nome, c.lancamentos])).toEqual([[`${MARCA} Canaa`, 1], [`${MARCA} Para`, 2]]);
      expect(await acoes.renomearCentroCustoAcao(para.id, `${MARCA} CANAÃ`)).toEqual({ erroAcao: expect.stringMatching(/Já existe/) });
      expect(ok(await acoes.renomearCentroCustoAcao(para.id, `${MARCA} Filial Belém`))).toEqual({ lancamentos: 2, nome: `${MARCA} Filial Belém` });
      expect((await prisma.bpoLancamento.findMany({ where: { descricao: { startsWith: MARCA } }, orderBy: { descricao: "asc" } })).map((l) => l.centroCustos))
        .toEqual([`${MARCA} Canaa / ${MARCA} Filial Belém`, `${MARCA} Filial Belém`]);
      expect(ok(await acoes.ativarCentroCustoAcao(para.id, false))).toEqual({ id: para.id, ativo: false });
    });

    it("+ Lançamento e edição gravam o centro de custo", async () => {
      const f = new FormData();
      for (const [k, v] of Object.entries({ tipo: "despesa", categoriaOperacional: "impostos", requestKey: `${MARCA}-rk1`, valor: "50", vencimento: "2026-10-10", competencia: "2026-10", descricao: `${MARCA} Cimento`, clienteNomeLivre: `${MARCA} Loja`, centroCustos: "Obra Centro" })) f.set(k, v);
      await bpo.criarCobranca(f);
      const l = await prisma.bpoLancamento.findUniqueOrThrow({ where: { requestKey: `${MARCA}-rk1` } });
      expect(l.centroCustos).toBe("Obra Centro");
      await bpo.editarLancamentoBpo({ id: l.id, version: l.version, motivo: "ajuste", descricao: l.descricao, valor: 50, vencimento: "2026-10-10", competencia: "2026-10", clienteNomeLivre: l.clienteNomeLivre, categoriaOperacional: "impostos", centroCustos: "Obra Norte" });
      expect((await prisma.bpoLancamento.findUniqueOrThrow({ where: { id: l.id } })).centroCustos).toBe("Obra Norte");
    });

    it("\"Excluir tudo\" respeita valor e centro de custo; a busca acha pelo titular", async () => {
      await novoLanc("Um", { valor: 80.5, centroCustos: "Obra A / Obra B" });
      await novoLanc("Dois", { valor: 300, centroCustos: "Obra B" });
      await novoLanc("Três", { valor: 80.5 });
      const previa = async (filtros: Record<string, unknown>) => {
        const r = await lote.previaExclusaoLote({ aba: "cobrancas", modo: "tudo", filtros: { busca: MARCA, ...filtros } });
        if ("erro" in r) throw new Error(r.erro);
        return r.alcancados;
      };
      expect(await previa({})).toBe(3);
      expect(await previa({ valorMin: 80.5, valorMax: 80.5 })).toBe(2);
      expect(await previa({ centroCusto: "obra a" })).toBe(1);
      expect(await previa({ centroCusto: "Obra B", valorMin: 100 })).toBe(1);
      const conta = await criarConta();
      const t = await prisma.transacaoBancaria.create({ data: { contaId: conta.id, data: new Date(), descricao: "Pix", titular: "JOAO TITULAR UNICO", valor: 10, tipo: "credito" } });
      await novoLanc("Do extrato", { transacaoId: t.id });
      const r = await lote.previaExclusaoLote({ aba: "cobrancas", modo: "tudo", filtros: { busca: "joao titular unico" } });
      if ("erro" in r) throw new Error(r.erro);
      expect(r.alcancados).toBe(1);
    });
  });
});
