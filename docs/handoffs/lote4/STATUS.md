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

## Etapa 4 — Frentes antigas (auditadas; feito só o que faltava)

a. **Lote B — Integrações únicas: já estava completo e igual nos dois** (auditado no código): `/admin/integracoes`
   só admin, Asaas/Pluggy/Evolution com status, chave mascarada `…XXXX`, Testar/Trocar validando antes de salvar,
   verificar/recuperar webhook do Asaas; nenhum campo de chave nas outras telas (BPO › Bancos e WhatsApp apontam
   para Integrações). Nada a fazer.
b. **Lote D — erros reais**: Asaas já mostrava motivo + dica de IP no 401 (igual nos dois). **Completado agora:**
   `dicaAsaas` (403/404/429/5xx) e `dicaPluggy` (401 credencial inválida, 400 parâmetros, 403, 404/410 reconectar,
   429, 5xx) em `mensagemRecusaPluggy` e nas leituras de transações/contas/token de conexão/webhook (com o motivo do
   corpo). SF `web/src/lib/bancos/{pluggy,asaas-extrato}.ts`; Prospecta `server/_core/{pluggy,asaas-extrato}.ts`.
   Testes: `erros-reais-bancos.test.ts` (nos dois) + ajuste de 1 asserção em `integracoes.test.ts` (nos dois).
c. **Chaves da Prospecta (`plain:`)** — conferido só no código, sem acessar produção: `decryptSecret` aceita `plain:`;
   Pluggy e chave por conta são recriptografadas no 1º uso (`lerSegredo` em `server/bancos.ts`); Asaas central
   (`payment_settings`) na sincronização diária (`recriptografarConfiguracaoAsaas`); trocar pela tela
   (Integrações › Trocar) valida no serviço e grava criptografado. Teste novo `server/chaves-plain-recripto.test.ts`.
   **O que o dono faz (na tela, nunca pelo chat):** Configurações › Integrações → "Testar" em Asaas e Pluggy; se
   recusar, "Trocar" e colar a chave/Client ID/Secret de novo (no Asaas, tirar a restrição de IP da chave).
d. **Alternativa ao Pluggy**: `docs/handoffs/lote4/ALTERNATIVA-PLUGGY.md` (web bloqueada pelo proxy — preços e rotas
   não reconferidos hoje). Recomendação: Asaas + Inter por API, Cora/C6 por OFX/CSV = R$ 0/mês. **Conector Banco
   Inter PJ implementado nos dois, desligado por padrão (`BANCO_INTER_API=1` liga)**, com cadastro em BPO › Bancos
   (só aparece ligado), sincronização (manual e diária), erros reais e testes simulados
   (`banco-inter.test.ts`, `banco-inter-sync(.db).test.ts`).

Testes (a) automáticos: todos os novos passando nos dois. (b) manuais: nenhum. (c) produção: Testar Asaas/Pluggy
na tela; Inter só depois de ligado e com a integração criada pelo dono.

## Etapa 5 — Suíte completa (30/10) — CONCLUÍDA

(a) Automáticos:
- Prospecta: `pnpm check` OK; `pnpm vitest run` **181 arquivos / 1420 testes, todos passando**; `pnpm build` OK.
- Santa Fé: `tsc --noEmit` OK; vitest sem banco **1091 passando / 156 pulados (testes de banco), 0 falhas**;
  vitest com banco `santafe_l9`: **1236 passando, 11 falhas — todas nos 5 arquivos pré-existentes conhecidos**
  (exclusao-definitiva, projeto-engenheiro, medicao-drive, bancos-sync Asaas, obra-pagamento-etapa); `next build` OK;
  ESLint dos arquivos alterados: só os 2 erros pré-existentes de `viabilidade-tab.tsx`.
(b) Manuais: nenhum (telas não abertas no navegador).
(c) Pendente em produção: ver "O que o dono precisa fazer".

## O que o dono precisa fazer
1. Autorizar merge/deploy e **aplicar as migrações aditivas ANTES do deploy** (sem elas a exclusão em lote do BPO falha):
   Prospecta `drizzle/0097_bpo_restaurar_exclusoes.sql` (Neon); Santa Fé `web/prisma/migrations/20261030120000_bpo_restaurar_exclusoes` (Supabase).
2. Configurações › Integrações: "Testar" Asaas e Pluggy; se recusar, "Trocar" e colar de novo (nunca pelo chat).
3. (Opcional) Banco Inter: criar a integração no Internet Banking PJ e autorizar ligar `BANCO_INTER_API=1`.

## Pendências
- Conferir rotas do Inter em developers.inter.co (web bloqueada nesta sessão) antes de ligar o conector.
- Validação em produção das telas (m², CSV, Exclusões em lote) após o deploy.

## Próximo passo exato
Abrir PRs `claude/lote4-ajustes-20261030` → main nos dois repositórios (quem tiver autorização de PR), aplicar as
migrações acima com autorização, merge, deploy e smoke test das 3 telas.
