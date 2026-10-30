# Lote 4 — STATUS (branch `claude/lote4-ajustes-20261030`, Prospecta e Santa Fé)

Arquivo gêmeo nos dois repositórios (mesmo conteúdo). Decisões do dono: `docs/handoffs/lote3/DECISOES-DONO-30-10.md`.

## Etapa 1 — m² com 2 casas na Incorporação — CONCLUÍDA

- Só exibição; nenhum cálculo/arredondamento interno mudou.
- SF: `formatArea` (`web/src/lib/utils.ts`, já com 2 casas) passou a ser usado em todas as abas de
  `web/src/app/admin/incorporacao/_components/` (terreno, quadro de áreas, massa, lotes avulsos,
  mapa do terreno/massa, viabilidade, orçamento parametrizado, pesquisa primária, mercado/comparáveis,
  relatório executivo PDF) e em `web/src/lib/pdf/loteamento.ts`.
- Prospecta: novo `formatArea` em `client/src/lib/format.ts` (reexportado em
  `client/src/components/incorporacao/estudo/compat/util.ts`), aplicado nos mesmos arquivos de
  `client/src/components/incorporacao/estudo/` e em `compat/pdf-loteamento.ts`.
- Hectares do relatório executivo agora com vírgula decimal (antes `toFixed(2)` mostrava ponto).
- Testes novos (guarda de regressão que varre as abas e o PDF): SF `web/src/lib/__tests__/incorporacao-area-formato.test.ts`;
  Prospecta `server/incorporacao-area-formato.test.ts`.

### Testes
- (a) automáticos: testes acima + `utils.test.ts`/`format.test.ts` passando; `pnpm check` e `tsc --noEmit` OK.
  ESLint SF: 2 erros `react-hooks/preserve-manual-memoization` em `viabilidade-tab.tsx` já existiam na main (não introduzidos).
- (b) manuais: nenhum.
- (c) produção: conferir visualmente uma aba de Incorporação e o PDF executivo após deploy.

## Etapa 2 — CSV de comissões no Santa Fé — CONCLUÍDA

- SF: botão "Exportar CSV (Comissões)" em `/admin/comissoes` (só equipe: admin/colaborador com o módulo,
  mesma regra das outras mutações; na Prospecta é `adminProcedure`). Server action `exportarComissoesCsv`
  em `web/src/lib/actions/comissoes.ts`; regra pura em `web/src/lib/comissoes/exportacao-csv.ts`.
  O SF não tem mais a tela Relatórios (limpeza de 11/10), por isso o botão fica na tela de Comissões.
- Mesmas colunas (`Origem;Data;Corretor;Referência;Valor Total;Pago;Status`), BOM UTF-8, valores 1.234,56,
  mesmo recorte (todas as comissões, ordem do vencimento; data = pagamento ou vencimento; "Empresa"/"Corretor sem cadastro").
- Prospecta: montagem do CSV extraída para `shared/comissoes-csv.ts` (usada por `AdminRelatorios.tsx`) e,
  nos dois, campos com `;`/aspas/quebra de linha passam a ir entre aspas (antes quebravam a coluna no Excel).
- Testes: SF `web/src/lib/__tests__/comissoes-exportacao-csv.test.ts`; Prospecta `server/comissoes-csv.test.ts`.
- (a) automáticos: passando; tsc/pnpm check OK. (b) manuais: nenhum. (c) produção: baixar o CSV e abrir no Excel.

## Etapa 3 — "Restaurar" exclusões em lote do BPO — CONCLUÍDA (nos dois)

- Tela: na barra de lote de Cobranças/Despesas, botão **"Exclusões em lote"** (SF: só aparece para admin;
  Prospecta: toda a tela BPO já é admin) → lista (data, usuário, aba, quantidade, situação) → **"Restaurar"** →
  prévia (o que volta, o que já existe, avisos) → confirmação digitando `RESTAURAR` → transação.
- Regras (função pura igual nos dois: SF `web/src/lib/bpo-restauracao.ts`, Prospecta `shared/financeiro/bpo-restauracao.ts`):
  - volta com o mesmo ID; lançamento cujo ID já existe não é recriado (sem duplicar);
  - uma vez só por backup (`restaurado_em/por` + `restauracao_json`; trava `pg_advisory_xact_lock` + update condicional);
  - cliente BPO apagado → volta sem `clienteId` e com o nome como texto (aviso); registro operacional apagado
    (obra/projeto/comissão…) → volta sem o vínculo (aviso); chave única (`requestKey`/`origemTransacaoKey`) já reutilizada → volta sem ela (aviso);
  - Asaas/extrato/combinação continuam vazios (eram vazios por regra da exclusão);
  - `version` +1 e histórico por lançamento ("Restaurado da exclusão em lote (backup …)", usuário e data).
- Servidor: SF `web/src/lib/actions/bpo-lote.ts` (`listarExclusoesEmLote`, `previaRestauracaoExclusao`, `restaurarExclusaoEmLote`, todas `exigirAdminAtivo`);
  Prospecta `server/bpo-restauracao.ts` + rotas `bpo.lancamentos.exclusoesEmLote/previaRestauracao/restaurarExclusao` (adminProcedure).
- UI: SF `web/src/app/admin/bpo/_components/barra-lote.tsx` (+ `podeRestaurar` em `page.tsx`/`bpo-client.tsx`); Prospecta `client/src/components/bpo/LoteLancamentos.tsx`.
- **Migrações (aditivas, NÃO aplicadas em produção):** SF `web/prisma/migrations/20261030120000_bpo_restaurar_exclusoes/migration.sql`;
  Prospecta `drizzle/0097_bpo_restaurar_exclusoes.sql`. **Atenção: aplicar a migração ANTES do deploy** — o ORM dos dois
  lados passa a ler/gravar as colunas novas do backup; sem elas, a própria exclusão em lote falha.
- Testes: SF `bpo-restaurar-exclusao.db.test.ts` (banco `santafe_l9`) e `bpo-restauracao.test.ts`; Prospecta
  `server/bpo-restauracao.test.ts` (PGlite, aplica 0097 duas vezes) e `server/bpo-restauracao-regra.test.ts`;
  `server/bpo-lote3.test.ts` passou a aplicar 0097.
- (a) automáticos: todos passando (SF com banco local; Prospecta PGlite). (b) manuais: nenhum.
  (c) produção: aplicar migração, excluir 1–2 lançamentos de teste e restaurá-los.

## Próximas etapas
2. CSV de comissões no SF (paridade com `AdminRelatorios.tsx` da Prospecta).
3. Restaurar exclusões em lote do BPO (nos dois).
4. Frentes antigas (integrações únicas, erros reais Asaas/Pluggy, chaves Prospecta, alternativa ao Pluggy).
5. Suíte completa nos dois.
