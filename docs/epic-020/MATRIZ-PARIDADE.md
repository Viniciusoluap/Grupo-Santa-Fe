# EPIC-020 — 32 implementações auditadas (Prospecta ↔ Grupo Santa Fé)

Matriz de paridade e aceitação exigida pelo "Prompt Mestre Definitivo" (12/10/2026). Atualizada a
cada lote. Estados permitidos: Não iniciado · Em implementação · Implementado · Testado · Validado ·
Bloqueado · Pendente de publicação · Publicado. **Implementado não significa validado; validado não
significa publicado.** "Testado" aqui = testes automatizados passando; validação manual em navegador
é registrada à parte quando feita.

Regra permanente do dono (12/10/2026): **ao término de cada lote, merge + deploy**, com o deploy
confirmado em produção (Vercel `READY` no commit do merge) antes de o lote ser dado como publicado.

## Lote 0 — Diagnóstico (concluído em 12/10/2026)

| Item | Prospecta | Grupo Santa Fé |
|---|---|---|
| Repositório / branch principal | `Viniciusoluap/Prospecta` · `main` | `Viniciusoluap/Grupo-Santa-Fe` (app em `web/`) · `main` |
| Stack | Vite + Express + tRPC + Drizzle | Next.js 16 + Prisma 7 |
| Banco de produção | Neon `SiteProspecta` (Postgres 17) | Supabase `grupo-santa-fe` (Postgres 17) |
| Vercel | `site-prospecta` — deploy automático do `main` | `grupo-santa-f` — deploy automático do `main` |
| Migrações | `drizzle/NNNN_*.sql` + journal; aplicadas em produção via SQL antes do deploy | `web/prisma/migrations/*`; histórico do Prisma ainda marcado como SQLite → aplicadas em produção via SQL antes do deploy |
| PRs abertas / trabalho concorrente | Nenhuma | Nenhuma |
| Decisão anterior que restringe escopo | — | Lote `codex/santa-fe-limpeza-crm-20261011` (PR #158): Dashboard, Central de Gestão, Relatórios, Feeds XML, Agregador, Contabilidade e Contratos independente removidos; serviços nascem só pelo CRM com estado inicial `aguardando_configuracao`. Nada das 32 implementações reintroduz esses módulos até aqui. |

### Achados estruturais que afetam os próximos lotes

1. **Prospecta — dados MCMV/CEF fora das colunas próprias.** A aba "Valores da Operação" grava VGV,
   financiamento, FGTS, subsídio, lucros, pró-soluto etc. como JSON anexado ao texto de `notes`
   (`__MCMV_META__`), embora existam colunas `decimal(15,2)` dedicadas. Em produção: 2 de 37 obras
   têm esse JSON; nenhuma tem as colunas preenchidas. Precisa ser migrado no Lote 2 (fonte única,
   precisão decimal).
2. **Prospecta — campos da aba Custos nunca foram salvos.** `contractorPayment`, `materialCost`,
   `commissionCost`, `extrasCost`, `maintenanceCost`, `insuranceCost`, `balanceAmount` são enviados
   pela tela, aceitos pela API e descartados silenciosamente (não existem na tabela). Não há
   histórico a preservar desses campos; o Lote 2 cria a estrutura real (17.x).
3. **Grupo Santa Fé — Obra sem estrutura financeira.** O model `Obra` só tem `valorTotal`/`valorPago`
   (`Float`). Não existem Valores da Operação, Custos, pró-soluto, lucros nem a tabela de Progresso
   com incidências: o Lote 2 e o Lote 4 constroem essa estrutura do zero no Santa Fé.
4. **Grupo Santa Fé — Lead sem temperatura.** Criada no Lote 1 (item 05).

## Matriz de aceitação

| Nº | Funcionalidade | Prospecta | Grupo Santa Fé | Testes | Paridade |
|---|---|---|---|---|---|
| 01 | Situações dos estudos de incorporação | Não iniciado | Não iniciado | — | Pendente |
| 02 | Incorporação em grid modular | Não iniciado | Não iniciado | — | Pendente |
| 03 | Documentos opcionais via Google Drive | Não iniciado | Não iniciado | — | Pendente |
| 04 | Tipos de incorporação / Desmembramento simples | Não iniciado | Não iniciado | — | Pendente |
| 05 | Temperatura "🤝 Negócio fechado" | Publicado | Publicado (temperatura criada) | `server/lote1-crm-obras.test.ts`; `web/src/lib/__tests__/lote1-crm-obras.test.ts` | Igual (mesmas 4 opções e emojis) |
| 06 | Limpeza das classificações de Obras | Publicado | Publicado | idem | Igual (5 opções; "Contrato Grupo Santa Fé" no Santa Fé por identidade visual) |
| 07 | Erro `invalid_value` ao salvar Obras | Publicado (causa raiz corrigida) | Publicado (sem divergência; mesma regra aplicada) | idem | Igual |
| 08 | Nome do cliente vindo do CRM | Publicado | Publicado (já existia no EPIC-007; tela alinhada) | idem | Igual |
| 09 | Tipo de projeto vindo do CRM | Publicado | Publicado | idem | Igual |
| 10 | Padronização monetária R$ | Não iniciado (base do Lote 4 anterior) | Não iniciado (base do Lote 4 anterior) | — | Pendente |
| 11 | Entrada Paga automática | Não iniciado | Não iniciado | — | Pendente |
| 12 | Entrada Total | Não iniciado | Não iniciado | — | Pendente |
| 13 | Saldo da Entrada | Não iniciado | Não iniciado | — | Pendente |
| 14 | Valor Recebido CEF | Não iniciado | Não iniciado | — | Pendente |
| 15 | Remoção dos botões superiores | Publicado — Medições movidas para a aba Progresso | Publicado — só "Salvar" à direita | build + typecheck | Igual |
| 16 | "MCMV/CEF" → "Valores da Operação" | Publicado | Não se aplica ainda — a seção nasce no Lote 2 já com o nome correto | build | Pendente até o Lote 2 |
| 17 | Reestruturação da aba Custos | Não iniciado | Não iniciado | — | Pendente |
| 18 | Custos ↔ Valores da Operação | Não iniciado | Não iniciado | — | Pendente |
| 19 | Valor a Receber do Banco | Não iniciado | Não iniciado | — | Pendente |
| 20 | Lucro Estimado | Não iniciado | Não iniciado | — | Pendente |
| 21 | Lucro do Investidor | Não iniciado | Não iniciado | — | Pendente |
| 22 | Lucro do Empreiteiro | Não iniciado | Não iniciado | — | Pendente |
| 23 | Lucro da Empresa | Não iniciado | Não iniciado | — | Pendente |
| 24 | Corretor automático pelo lead | Publicado | Publicado | idem | Igual |
| 25 | Pró-Soluto e HP 12C | Não iniciado | Não iniciado | — | Pendente |
| 26 | Dias de Obra e PLS Real | Não iniciado | Não iniciado | — | Pendente |
| 27 | Progresso físico com incidências | Não iniciado | Não iniciado | — | Pendente |
| 28 | Upload de fotografias | Não iniciado | Não iniciado | — | Pendente |
| 29 | Relatório executivo da Obra em PDF | Não iniciado | Não iniciado | — | Pendente |
| 30 | Regularização: status e etapas | Não iniciado | Não iniciado | — | Pendente |
| 31 | Regularização: controle financeiro documental | Não iniciado | Não iniciado | — | Pendente |
| 32 | Comissões automáticas pelo CRM (caso Chaleilson) | Não iniciado | Não iniciado | — | Pendente |

## Lote 1 — CRM e estrutura de Obras (itens 05, 06, 07, 08, 09, 15, 16, 24)

### Diagnóstico (antes)

| Item | Prospecta | Grupo Santa Fé |
|---|---|---|
| 05 | Enum `lead_temperature` = cold/warm/hot | Lead sem campo de temperatura |
| 06/07 | Três listas divergentes: tela com 25 status, API (`zod`) com 5, banco com 15. Qualquer escolha fora da interseção → `invalid_value` (causa raiz do item 07). Produção: 36 obras `planning`, 1 `in_progress`. | Lista única (`OBRA_STATUS_CONFIG`) usada na tela e na action, sem divergência. Produção: 3 `orcamento`, 1 `pausada`, 1 `aguardando_configuracao`. |
| 08 | "Nome do Cliente" digitável, gravado no JSON de `notes`; não refletia o lead | Já vinha do lead (fonte única, propagado na edição do lead) |
| 09 | "Tipo de Projeto" digitável; o CRM grava "Obra / reforma" ou "Vistoria e medição" ao criar a obra | "Tipo" com seletor próprio (Obra Nova/Reforma/…); CRM só tem o serviço "Obra e reforma" |
| 15 | Botões "Ver Medições" e "Salvar Alterações" no topo | Sem botões no topo; "Salvar Alterações" no rodapé à esquerda |
| 16 | Aba "MCMV/CEF" | Não existe seção equivalente |
| 24 | "Nome do Corretor" digitável + "Corretor Pago?" | Sem campo de corretor na obra |
| Permissão | `updateProject` aceitava o dono da obra (cliente do portal) — podia alterar dados financeiros pela API | Edição restrita a admin |

### O que mudou

- **05:** `🤝 Negócio fechado` nas duas plataformas (Prospecta: valor `closed` no enum; Santa Fé:
  coluna `leads.temperatura` com `frio|morno|quente|fechado`, padrão `frio`). Criação, edição,
  listagem, kanban, detalhe e filtro. Temperatura continua independente da etapa do funil.
- **06/07:** fonte única das classificações (`shared/obra-status.ts`; `web/src/lib/types/obra.ts`).
  Seletor com exatamente Planejamento, Aprovação, Contrato Prospecta / Contrato Grupo Santa Fé,
  Laudo CEF, Conformidade CEF. Obras antigas mantêm a classificação atual (exibida como "antiga") e
  continuam salvando; escolher uma classificação removida retorna mensagem compreensível. Prospecta:
  migração aditiva `0034` adiciona os 4 valores novos ao enum do banco — nenhum valor removido.
- **08/24:** Nome do Cliente e Corretor somente leitura, vindos do lead; corretor oculto quando o lead
  não tem corretor; "Corretor Pago?" e "Título CF (CEF)" removidos da tela (valores antigos seguem
  preservados no registro, não apagados).
- **09:** Tipo de Projeto somente leitura, derivado do serviço do CRM em toda leitura (edição, listas,
  portal do cliente, PDF). A API não aceita mais `projectType`/`tipo`. Obras sem serviço vinculado
  exibem o valor antigo preservado.
- **15:** botões do topo removidos (Prospecta); um único "Salvar" no canto inferior direito nas duas.
  O acesso às Medições foi preservado dentro da aba Progresso.
- **16:** aba e título renomeados para "Valores da Operação" (Prospecta).
- **Segurança:** `construction.updateProject` passou a `adminProcedure`.

### Relatório de inconsistências legadas (sem migração automática)

| Registro | Empresa | Campo | Valor antigo | Valor calculado (CRM) | Ação |
|---|---|---|---|---|---|
| Obra #22 | Prospecta | Tipo de Projeto | "Vistoria e medição" | "Obra / reforma" (serviço `obra_cliente`) | A tela agora mostra o valor do CRM. Se a obra é de fato vistoria/medição, corrigir o tipo do serviço no lead. |
| Obras com tipo antigo (4 × "Obra Nova") | Grupo Santa Fé | Tipo | Obra Nova | "Obra e reforma" (serviço do CRM) | Classificação técnica antiga preservada no banco (`obras.tipo`), não mais exibida como tipo oficial. Se o dono quiser essa subclassificação, ela precisa nascer no CRM. |

### Publicação do Lote 1 (12/10/2026)

- Prospecta: PR #95 → `b29b1d8`; produção `READY` (`dpl_8qH69ArX1GWKj1EvPw7Ducr9NB4D`).
- Grupo Santa Fé: PR #164 → `6f9a98f`; produção `READY` (`dpl_CdJLxNtgoAp8bQHuT3Kbkk57QKYy`, após
  redeploy — o deploy automático falhou com `git_info_fail`, erro da Vercel antes do build).
- Migrações aplicadas em produção antes do merge e verificadas por SELECT.

### Pendências honestas do Lote 1

- Testado automaticamente (unidade + rota/action) e por typecheck/build; **não** testado em navegador
  (o ambiente do agente não acessa os domínios publicados) — validação manual pendente.
- Item 16 no Santa Fé depende do Lote 2 (a seção ainda não existe lá).
