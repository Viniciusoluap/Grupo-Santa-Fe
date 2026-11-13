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

## Bloco 2 — telas (concluído)
Arquivos: `web/src/app/admin/bpo/page.tsx`, `_components/bpo-client.tsx` e novos `_components/importar-conta-azul.tsx`,
`a-classificar.tsx`, `centros-custo.tsx`, `filtros-bpo.tsx` (gêmeos de ImportarContaAzul/AClassificar/CentrosCusto/FiltrosBpo da Prospecta).
- Topo do BPO: "Importar backup Conta Azul" (administrador; abre o ZIP no navegador com fflate, só .csv, até 30 MB;
  prévia → confirmar) e "Centros de custo" (criar, renomear, ativar/desativar, uso).
- Aba "A classificar (N)": movimentações (Criar lançamento individual/lote com categoria, cliente e centro de custo;
  Dar baixa / dividir com sugestões, busca, valor por lançamento, "faltam/passou", só confirma quando fecha;
  Transferência interna / ignorar) e lançamentos em aberto (Confirmar, Registrar recebimento/pagamento pela baixa
  auditada de sempre, Marcar pago, Cancelar = arquivamento reversível com EXCLUIR).
- Cobranças, Despesas e A classificar: busca (cliente/titular/descrição), mês e ano, valor mínimo/máximo (iguais =
  exato), status (abas; Despesas ganhou "Parciais"), centro de custo, cliente, "Limpar filtros". O painel de valores
  (lançamentos, total, recebido/pago, em aberto, vencido) passou a acompanhar o filtro (antes somava tudo). A lista
  usa a mesma função do servidor (`filtrarLancamentosLote`), então "Excluir tudo"/seleção só alcançam o visível.
- Aba "Clientes" nova (o Santa Fé não tinha lista de clientes BPO na página): busca por nome/lead/CPF-CNPJ e situação,
  com link para o detalhe.
- DRE: filtro de centro de custo nas duas visões ("A / B" entra nos dois).
- Campo "Centro de custo" (centros ativos; valor gravado fora da lista continua como opção) no + Lançamento
  (cobrança e despesa), na edição e no Criar lançamento da aba A classificar; aparece na linha das listas.
- Layout do Novo Lançamento no celular: o Santa Fé não tinha o defeito da Prospecta (`col-span-2` sem prefixo em
  grade de 1 coluna) — conferido no código e medido (0 campos sobrepostos, 390 px). Nada a corrigir.

## Testes (todos os blocos)
- (a) automáticos: os do bloco 1 + suíte sem banco 162 arquivos / 1.227 ✅; com banco 35 arquivos, 151 ✅ / 9 ❌ —
  exatamente as mesmas 9 falhas da `main` neste ambiente (comparado com um checkout limpo da `main` no mesmo Postgres).
  `npx tsc --noEmit -p .` ✅; ESLint nos arquivos alterados: 0 erros (1 aviso antigo). `npx next build`: compilou
  (✓ Compiled, TypeScript ok) e parou na geração estática de "/" por falta de banco (DatabaseNotReachable) — esperado.
- (b) manuais por mim: `next dev` com Postgres local (dados sintéticos) + Playwright no Chrome em viewport iPhone 14:
  Cobranças com filtros (valor mínimo e centro de custo) e painel; aba A classificar; Dar baixa / dividir 500 → 300 +
  200 ("Aplicado R$ 500,00 de R$ 500,00", 2 quitados); Criar lançamento com centro de custo (0 campos sobrepostos);
  Novo Lançamento › Despesa (7 campos, 0 sobrepostos); Clientes (busca por CPF); DRE por centro; importação do ZIP
  sintético (4 lançamentos); Centros de custo com uso. Largura da página 390 px em todas; 0 erros de página.
- (c) produção: pendente — aplicar a migração no Supabase, publicar e: importar um backup real; ligar/sincronizar uma
  conta e conferir que as movimentações caem em A classificar, que os pagos do Conta Azul só são ligados e que o DRE
  não muda até classificar.

## Diferenças que restam entre os dois sistemas (documentadas)
- Transferência interna: no Santa Fé a movimentação gera um lançamento com a categoria "Transferência interna"
  (fora de listas/DRE/totais, regra antiga do Santa Fé); na Prospecta não gera lançamento. Mesmo resultado nos números.
- Asaas em aberto ↔ Conta Azul em aberto: a cobrança do Asaas no Santa Fé não traz o cliente BPO, então a regra
  (b) da Prospecta (mesmo cliente) nunca liga aqui — a receita fica em A classificar para o dono.
- A Prospecta liga crédito do Asaas sem id de pagamento à cobrança por valor/data; o Santa Fé nunca teve isso (só pelo id).
- Lançamento do Conta Azul de cliente já cadastrado com nome diferente (achado pelo CPF): igual à Prospecta, o
  cliente não é recriado e o lançamento fica com o nome livre do negociador.

## Riscos para publicar
- Ordem: aplicar a migração ANTES do deploy (sem as colunas, a página do BPO quebra).
- Comportamento novo para o dono: movimentação nova do banco deixa de entrar sozinha em Cobranças/Despesas/DRE
  (só Asaas conhecido, Conta Azul pago e regra do titular). Até classificar, o DRE do período fica menor.
- Valor igual e data próxima por coincidência pode ligar a movimentação ao lançamento do Conta Azul errado (raro;
  mesma limitação da Prospecta). Excluir a conta bancária zera `bpo_baixas."transacaoId"` (o valor recebido fica).
- Centros que só existem em lançamentos importados depois da migração não entram sozinhos no cadastro (igual à
  Prospecta: a semente roda só na migração); o dono pode criá-los em "Centros de custo".

## Próximo passo exato
Revisão do dono → abrir PR de `claude/paridade-bpo` → autorizar aplicar a migração 20261113100000 no Supabase →
merge/deploy → validar os itens (c). Remover a seção "PARIDADE SUSPENSA" do `CLAUDE.md` se a ordem do dono for
mesmo retomar a paridade, e atualizar `HANDOFF-12-11-STANDBY-PARIDADE.md` (item BPO portado).
