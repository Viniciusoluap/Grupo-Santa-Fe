# Handoff — Paridade do BPO Financeiro com a Prospecta (13/11)

Pedido: portar para o Grupo Santa Fé tudo o que a Prospecta fez no BPO em 11–12/11 (PRs #213 e #214; fonte:
`Prospecta/HANDOFF-12-11-BPO-CONTA-AZUL.md`), com a mesma regra de negócio. Branch `claude/paridade-bpo`
(a partir de `origin/main` 335211a). Sem merge, sem PR, sem deploy, sem banco real.

Observação de escopo: o `CLAUDE.md` ainda tem a seção "PARIDADE SUSPENSA" (Santa Fé em stand-by). Este trabalho
foi feito por pedido direto da sessão responsável (13/11), que informou a retomada da paridade (na Prospecta o
commit 6e75154 "paridade com o Grupo Santa Fé retomada por ordem do dono (13/11)"). A seção do `CLAUDE.md` do
Santa Fé não foi alterada por esta sessão — quem tiver a ordem do dono deve removê-la.

## Bloco 1 — regras, servidor e migração (concluído)

### Migração (NÃO aplicada em banco real)
`web/prisma/migrations/20261113100000_bpo_paridade_conta_azul_a_classificar/migration.sql` — só aditiva e
idempotente (IF NOT EXISTS / ON CONFLICT DO NOTHING; nenhum UPDATE/DELETE de dados):
- `transacoes_bancarias."aClassificar"` e `bpo_lancamentos."aClassificar"` (boolean NOT NULL DEFAULT false) + índices parciais;
- `bpo_lancamentos.observacoes` (texto; rastro do Conta Azul);
- `bpo_baixas."transacaoId"` (FK para `transacoes_bancarias` ON DELETE SET NULL) + índice — dividir pagamentos
  reaproveita as baixas que o Santa Fé já tinha (`BpoBaixa`), como pedido;
- tabela `bpo_centros_custo` (id, nome, ativo, criadoEm), nome único sem maiúsculas/acentos por índice de expressão
  (`lower(translate(btrim(nome)…))`, sem extensão) e semente com os nomes já usados em `"centroCustos"`, separando "A / B".
- Equivale a `0103_bpo_a_classificar.sql` + `0104_bpo_centros_custo.sql` da Prospecta.
- **Aplicar no Supabase ANTES do deploy do código** (o código lê as colunas novas). O repositório não usa
  `prisma migrate deploy` (o `migration_lock.toml` diz sqlite); aplicar o SQL do arquivo como nas migrações anteriores.
- Passo de dados SEPARADO (só com autorização, e só se houver Conta Azul já importado — hoje não há no Santa Fé):
  `UPDATE bpo_lancamentos SET "aClassificar" = true WHERE "origemEfetiva" = 'conta_azul' AND NOT pago AND "exclusaoLoteBackupId" IS NULL AND "combinadaEmId" IS NULL;`
- Schema Prisma: campos/modelo novos em blocos `// ── Paridade BPO (13/11) ──` (sem reformatar o resto);
  `prisma migrate diff` entre o banco com a migração e o schema = vazio (conferido).

### Regras puras (gêmeas da Prospecta, ids texto)
- `web/src/lib/financeiro/conta-azul.ts` (leitura do backup, categorias, conciliação extrato/Asaas),
  `bpo-a-classificar.ts` (sentido, sugestões, validar divisão em centavos), `centros-custo.ts`, `bpo-filtros.ts`;
  `web/src/lib/bpo-lote.ts` ganhou valor mínimo/máximo, centro de custo e busca pelo titular;
  `web/src/lib/financeiro/bpo-resultado.ts`: célula do DRE guarda o centro de custo e o filtro aceita `centroCusto`.

### Servidor
- `web/src/lib/bpo-conta-azul.ts`: prévia, importação (transação + trava, `requestKey` único, `skipDuplicates`),
  candidatos do Conta Azul e `conciliarMovimentosComContaAzul` (pago, mesmo tipo/valor, ≤3 dias: só liga).
  Receita do Conta Azul = tipo `recebimento` (aba Cobranças); despesa = `despesa`.
- `web/src/lib/bancos/lancamentos-bpo.ts`: `vincularTransacoesAoBpo(filtro, modo)` com os modos da Prospecta
  (`nova` | `classificada` | `reprocessar`). Nova: Asaas conhecido/origem → como antes; Conta Azul pago → só liga;
  regra do titular com categoria → cria; transferência interna → como antes no Santa Fé (lançamento fora de
  listas/DRE); o resto → `aClassificar = true` (com o cliente sugerido pelo titular). Movimentação com baixa por
  divisão nunca gera lançamento; "A classificar" nunca é tocada pelo reprocessar/rede diária.
  `classificarTransacao` (painel Bancos) é classificação explícita; "aplicar ao mesmo titular" só cria com categoria.
- `web/src/lib/bancos.ts` (`gravarMovimentos`) e `actions/banco.ts` (`salvarTransacoes`): só as novas passam pelo modo `nova`.
- `web/src/lib/bancos/cobrancas-asaas.ts`: cobrança paga ↔ receita do Conta Azul já paga assume o id; paga ↔ em
  aberto não liga; crédito que ficou A classificar ganha o lançamento quando a cobrança chega; pago sai da aba.
- `web/src/lib/bpo-a-classificar.ts`: contagem, listas, criar lançamento (categoria/cliente/centro), ignorar
  (transferência interna), confirmar (histórico + version), abertos para baixa com sugestões, e
  `darBaixaComMovimentacao` (1 → N e N → 1, receita e despesa, soma exata em centavos, `FOR UPDATE` + version,
  idempotente pela assinatura, `requestKey bt:<mov>:<lanc>`, histórico; movimentação fica `conciliado`).
- `web/src/lib/bpo-centros-custo.ts`: listar com uso, criar, renomear (também nos combinados e arquivados), ativar.
- `web/src/lib/actions/bpo-paridade.ts`: server actions (Conta Azul só admin; o resto módulo BPO), erros como dado.
- Leitores com `aClassificar: false`: página do BPO (listas e DRE/Contabilidade/Relatórios), detalhe do cliente,
  `resumoBpoPorLead`, vínculos de cliente, obra e regularização (pagos), notificações; lote ganhou a aba
  `a_classificar` (Cancelar = arquivamento reversível; Restaurar devolve para A classificar). `registrarBaixaBpo`
  e "Quitar saldo" tiram da aba.

### Testes do bloco 1
- (a) automáticos:
  - `web/src/lib/__tests__/bpo-paridade-regras.test.ts` (15) — leitura do backup, categorias, conciliação, Asaas em
    aberto, sentido/sugestões/divisão, centros, filtros, painel, DRE por centro.
  - `web/src/lib/__tests__/bpo-paridade-migracao.test.ts` (1, PGlite) — migração duas vezes, semente, índice único, FK SET NULL.
  - `web/src/lib/__tests__/bpo-paridade.db.test.ts` (20, Postgres real local com a migração aplicada) — importação/
    reimportação, aviso de extrato, conciliação pago/aberto/novo, regra do titular, criar/ignorar/confirmar/baixa,
    cancelar+restaurar, reprocessar, painel Bancos, Asaas (pago↔pago, pago↔aberto, crédito antecipado), split 1→N,
    N→1, idempotência, concorrência, recusas, sem dupla contagem, centros, `+ Lançamento`/edição, Excluir tudo com filtros.
  - Expectativas antigas mudadas (regra nova, conscientemente) em `bpo-extrato.db.test.ts`: "importação gera 1
    lançamento por movimentação", "transferência interna fora do DRE" e "sincronização por API" — agora as
    movimentações ficam A classificar e o lançamento nasce ao classificar (o teste aceita a categoria sugerida).
  - Suíte sem banco: 162 arquivos / 1.227 testes ✅. `npx tsc --noEmit -p .` ✅. ESLint dos arquivos alterados: 0 erros
    (1 aviso antigo em `[id]/page.tsx`).
  - Testes com banco (`*.db.test.ts`, Postgres 16 local, `TEST_DATABASE_URL`): 35 arquivos, 148 ✅ / 12 ❌ — as 9
    falhas de antes já falham na `main` sem mudança neste ambiente (Drive, gatilhos que só existem nas migrações, etc.:
    `bancos-sync` Asaas, `avisos-tempo-real` Pluggy, `exclusao-definitiva` ×4, `projeto-engenheiro` ×3, arquivos de
    Drive/medições). As 3 restantes eram as expectativas acima, já atualizadas (27/27 ✅ depois).
- (b) manuais: nenhum ainda (a tela vem no bloco 2).
- (c) produção: pendente — aplicar a migração, publicar, importar um backup e conferir.

## Pendências
- Bloco 2: telas (botão Importar backup Conta Azul, aba A classificar com Dar baixa/dividir, Centros de custo,
  campo Centro de custo no + Lançamento/edição/Criar lançamento, filtros e painel de valores, DRE por centro).

## Diferenças que restam entre os dois sistemas (documentadas)
- Transferência interna: no Santa Fé a movimentação gera um lançamento com a categoria "Transferência interna"
  (fora de listas/DRE/totais, regra antiga do Santa Fé); na Prospecta não gera lançamento. Mesmo resultado nos números.
- Asaas em aberto ↔ Conta Azul em aberto: a cobrança do Asaas no Santa Fé não traz o cliente BPO, então a regra
  (b) da Prospecta (mesmo cliente) nunca liga aqui — a receita fica em A classificar para o dono.
- A Prospecta liga crédito do Asaas sem id de pagamento à cobrança por valor/data; o Santa Fé nunca teve isso (só pelo id).
- Lançamento do Conta Azul de cliente já cadastrado com nome diferente (achado pelo CPF): igual à Prospecta, o
  cliente não é recriado e o lançamento fica com o nome livre do negociador.

## Próximo passo exato
Bloco 2 (telas) em `web/src/app/admin/bpo/_components/` e `page.tsx`.
