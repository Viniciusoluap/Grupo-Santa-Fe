# HANDOFF 23/10 — Continuação (Claude) do lote "Correções Prospecta e Grupo Santa Fé — etapas 1 a 6"

Prompt-base do dono: lote AIOX iniciado no Codex (Regularizações, Projetos, Obras/Imóveis/Mapa, conclusão de
serviços, Financiamentos, Duplicar lead). Handoffs do Codex: `HANDOFF-23-10-CORRECOES-ETAPAS-1-A-6.md`,
`HANDOFF-23-10-PROJETOS-PRAZO-REVISAO.md`, `HANDOFF-23-10-FINANCIAMENTOS-CONCLUIDO.md`.

Branch de trabalho (Claude): `claude/sync-mirrored-repos-bsqnz3`, recriada a partir de `origin/main`
(Prospecta `c007757`, Santa Fé `793a4cb`) e com **merge** (sem reescrever) das três branches do Codex:
`codex/regularizacoes-indicadores-20261023` (etapa 1), `codex/projetos-prazo-revisao-20261023` (etapa 2A/B) e
`codex/financiamentos-concluido-20261023` (etapa 5). As branches/PRs do Codex (#157/#158/#159 Prospecta,
#220/#221/#222 Santa Fé) não foram alterados; ao mesclar esta branch eles ficam contidos no main.

## Status por etapa

| Etapa | Escopo | Situação |
|---|---|---|
| 1 | Regularizações: "Valor já recebido" e "Valor contratado" (itens próprios) | Codex ✅ integrado |
| 2A/B | Projetos: prazo como data civil + ordenação por prazo | Codex ✅ integrado |
| 2C | Projetos: Solicitar revisão (pedido, notificação, e-mail, entrega no card, histórico) | ✅ Claude (código + testes; migração pendente em produção) |
| 3 | Obras: Localização exata → imóvel vinculado → Mapa Operacional | ✅ Claude (código + testes; migração pendente em produção) |
| 4 | Concluir serviço no CRM conclui o módulo (por ID) + caso Luciano Oliveira Leite | ✅ Claude (código + testes; reconciliação de 1 registro pendente no deploy) |
| 5 | Financiamentos: "Liberado" → "Concluído"; "Crédito concluído" | Codex ✅ integrado |
| 6 | Duplicar lead (novo ID, dados e documentos, sem serviços) | ✅ Claude (código + testes; migração pendente em produção) |

## E0 — integração das etapas do Codex
- Merges sem conflito nos dois repositórios.
- Testes: (a) Prospecta `pnpm check` OK e suíte 940/940 (inclui os testes novos do Codex).
  Santa Fé `tsc --noEmit` OK; vitest (Postgres local) 790 ok / 10 falhas — as mesmas 10 pré-existentes do
  ambiente local (drive-estrutura, exclusao-definitiva.db, medicao-drive, pci-upload,
  progresso-historico-janela, projeto-engenheiro: dependem de triggers/Drive inexistentes no banco local),
  idênticas sem as mudanças do lote.
- (b) manuais: nenhum nesta etapa. (c) produção: nada publicado ainda (sem merge/deploy).

## E2C — Projetos: Solicitar revisão (concluída em código)
Requisitos: botão "Solicitar revisão" por projeto; modal com o texto; pedido salvo com autor, data e estado;
notificação interna + e-mail ao colaborador vinculado; colaborador entrega a versão revisada no card; histórico
de pedidos e entregas; sem colaborador/e-mail → aviso claro e nunca "enviado".

Decisões:
- Regras e textos em arquivo único espelhado: Prospecta `shared/projeto-revisao.ts` = Santa Fé
  `web/src/lib/projeto-revisao.ts` (validação, limite 2000, rótulos, mensagem honesta, e-mail com HTML escapado).
- Situação por canal: `enviado` | `sem_destinatario` | `falhou` (gravada no pedido). Colaborador inativo = sem destinatário.
- Entrega: a mesma rota de upload resumível do Drive recebe `revisionId`; o arquivo vai para a pasta
  `Clientes/<cliente>/Projetos/Portfólio/<projeto>/Revisão <id>` e é **acrescentado** em `deliveries`/`entregas`
  do pedido (idempotente por driveFileId), marcando `entregue` + data/autor. Não altera os arquivos do checklist.
- Link da notificação: Prospecta `/admin/projetos?projeto=<id>` (abre o card); Santa Fé `/admin/projetos/<id>`.
- Excluir o projeto apaga os pedidos (FK ON DELETE CASCADE), coerente com a exclusão definitiva.

Arquivos:
- Prospecta: `drizzle/0066_project_revision_requests.sql`, `drizzle/schema.ts` (`projectRevisionRequests`),
  `server/operacional-router.ts` (`projetos.revisoes`, `projetos.solicitarRevisao`), `server/routes/projeto-documentos.ts`,
  `client/src/lib/project-upload.ts`, `client/src/pages/admin/ProjetoRevisoes.tsx`, `AdminProjetos.tsx`,
  `server/projeto-revisao.test.ts`.
- Santa Fé: `prisma/schema.prisma` (`ProjetoRevisao` → `projeto_revisoes`),
  `prisma/migrations/20261023120000_projeto_revisoes/migration.sql` (com RLS), `src/lib/actions/projetos.ts`
  (`solicitarRevisaoProjeto`), `src/app/api/projetos/[id]/documentos/route.ts`, `src/lib/project-upload.ts`,
  `src/app/admin/projetos/[id]/_components/projeto-revisoes.tsx`, `[id]/page.tsx`, `_components/projetos-client.tsx`,
  `src/lib/__tests__/projeto-revisao.db.test.ts`.

Testes:
- (a) Prospecta: `pnpm check` OK; suíte completa 945/945 (5 novos). Santa Fé: `tsc --noEmit` OK; eslint sem erros
  nos arquivos alterados; `projeto-revisao.db.test.ts` 4/4 no Postgres local.
- (b) manuais: nenhum ainda (UI não exercitada em navegador).
- (c) produção: migrações **não aplicadas** (Prospecta 0066 via Neon; Santa Fé `20261023120000_projeto_revisoes`
  via Supabase). Envio real de e-mail/Drive só validável em produção.

## E3 — Obras: Localização exata → imóvel vinculado → Mapa Operacional (concluída em código)
Requisitos: campo "Localização exata" na aba Informações da obra, igual ao de Imóveis (coordenadas, links Google
Maps/Waze/Apple Maps, Plus Code, botão "Marcar", mesma validação); ao salvar, criar ou vincular o imóvel e mostrá-lo
no Mapa Operacional; atualizações mexem no mesmo ponto, sem duplicar; preservar vínculos e endereços; nunca publicar.

Decisões:
- Vínculo novo `construction_projects.imovel_id` (Prospecta) / `obras.imovelId` (Santa Fé), único e `ON DELETE SET NULL`.
- Sem vínculo + ponto → cria **um** imóvel "Obra — <nome>" com o endereço da obra, preço 0, `publicadoSite`/portais =
  false, revisão aprovada, slug aleatório `obra-<id>-<hex>`; status Prospecta `reservado`; Santa Fé não tem
  "reservado" → fica no padrão `venda`, igualmente fora do site e portais (diferença só de vocabulário da stack).
- Com vínculo → atualiza **só** latitude/longitude do mesmo imóvel (endereço, preço, publicação intactos).
- "Remover" tira o ponto do mapa e mantém o vínculo. Obra antiga sem ponto: nada é criado.
- Corrida: Prospecta (neon-http sem transação interativa) usa vínculo condicional `WHERE imovel_id IS NULL` + índice
  único e apaga o imóvel perdedor; Santa Fé usa transação com `SELECT … FOR UPDATE` na obra.
- Empreiteiro: só lê (Prospecta `obraLocalizacao.obter` liberado; aba Informações continua somente leitura).
- Excluir a obra não apaga o imóvel (fica visível em Imóveis para decisão da equipe).

Arquivos:
- Prospecta: `drizzle/0067_obra_imovel_localizacao.sql`, `drizzle/schema.ts`, `shared/obra-localizacao.ts`,
  `server/obra-localizacao.ts` (router `obraLocalizacao`), `server/routers.ts`, `server/_core/trpc.ts`,
  `server/obra-acesso.ts`, `client/src/pages/AdminEditarObra.tsx`, `server/obra-localizacao.test.ts`.
- Santa Fé: `prisma/schema.prisma`, `prisma/migrations/20261023130000_obra_imovel_localizacao/migration.sql`,
  `src/lib/obra-localizacao.ts` (cópia do shared), `src/lib/obras/localizacao.ts`, `src/lib/actions/obras.ts`
  (`editarObra`), `src/components/obras/editar-obra-pagina.tsx` (usa o `LocalizacaoPicker` de Imóveis),
  `src/lib/__tests__/obra-localizacao.db.test.ts`.

Testes:
- (a) Prospecta `pnpm check` OK, suíte 950/950 (5 novos). Santa Fé `tsc` OK, eslint sem erros, teste de banco 4/4
  (inclui gravações simultâneas sem duplicar).
- (b) manuais: nenhum (UI não exercitada em navegador).
- (c) produção: migrações pendentes (Prospecta 0067 via Neon; Santa Fé `20261023130000_obra_imovel_localizacao`).

Risco registrado (pré-existente, fora do escopo): a página pública de detalhe do imóvel (Prospecta `imoveis.getBySlug`,
Santa Fé `(site)/imoveis/[id]`) não filtra `publicadoSite`; quem tiver o link exato vê um imóvel não publicado. Os
imóveis de obra têm slug/ID aleatório e não aparecem em nenhuma listagem pública.

## E4 — Concluir no CRM conclui o módulo (concluída em código)
Requisitos: "Concluir" de qualquer serviço vinculado no CRM conclui o registro operacional do módulo; vínculo pelo
ID do serviço/processo (nunca nome/CPF); não apagar etapas, documentos, valores ou histórico; sem recursão; conferir
o caso Luciano Oliveira Leite e todos os tipos; reconciliar divergências históricas com segurança.

Decisões:
- Status final por módulo — Prospecta: obras `completed`, projetos `entregue`, regularizações `concluido`,
  financiamentos `liberado` (exibido "Concluído", etapa 5), avaliações `entregue`, tarefas `done`. Santa Fé: obra
  `concluida`, projeto `entregue`, regularização `concluido`, financiamento `liberado`, avaliação `entregue`, tarefa
  `concluida`.
- Só o `status` (e a data de alteração) muda. Registro cancelado não é reaberto; já concluído não é regravado.
- Prospecta: `leadServices.setStatus`/`update` com `completed` chamam `concluirRegistroDoServico` (UPDATE … WHERE
  `lead_service_id` = id do serviço). O toast mostra o resultado real (concluído, já concluído, cancelado, sem registro).
  Nova procedure `leadServices.reconcileConclusoes({ aplicar })` (lista por padrão; com `aplicar` corrige e registra
  nota no histórico do lead).
- Santa Fé: não existe status próprio no `ServicoLead` — o card "Serviços do Cliente" já mostra o status do registro
  do módulo (fonte única, não diverge). Faltava o botão: novo "Concluir" no card (equipe interna, lead ativo, registro
  não concluído/cancelado), que conclui o registro **pelo ID dele conferindo o `leadId`**; exige CRM + módulo.
- Comissões, jurídico e BPO não têm vínculo por ID de serviço → não são tocados (nunca por nome).
- Mão única CRM → módulo: nenhuma alteração no módulo volta a mexer no CRM (sem recursão).

Caso Luciano Oliveira Leite (produção, consulta só leitura em 23/10):
- Prospecta: lead 38; serviço 95 (financiamento_habitacional) `completed` → financiamento 10 com `lead_service_id` 95 e
  status `liberado` (= "Concluído" após a etapa 5). Está coerente; nada a corrigir. Serviços 94 (obra 14) e 96
  (regularização 19) seguem ativos. Santa Fé: não há lead com esse nome.

Reconciliação histórica (Prospecta, consulta só leitura): 1 divergência — serviço 67 (lead 67, DIMAS RODRIGUES
INOCENSO LIMA) concluído no CRM com regularização 22 em `em_andamento`. **Correção a aplicar no deploy** pela procedure
`reconcileConclusoes({ aplicar: true })` ou SQL equivalente (`UPDATE regularizacoes SET status='concluido',
updated_at=now() WHERE id=22 AND lead_service_id=67 AND status='em_andamento'`), só status, com nota no lead.
Santa Fé: não há como divergir (fonte única).

Arquivos:
- Prospecta: `shared/conclusao-servico.ts`, `server/conclusao-servico.ts`, `server/lead-services-router.ts`,
  `client/src/pages/admin/AdminLeadDetail.tsx`, `server/conclusao-servico.test.ts`.
- Santa Fé: `src/lib/crm/conclusao-servico.ts`, `src/lib/crm/conclusao-servico-db.ts`,
  `src/lib/actions/conclusao-servico.ts`, `src/app/admin/leads/[id]/concluir-servico-botao.tsx`,
  `src/app/admin/leads/[id]/page.tsx`, `src/lib/__tests__/conclusao-servico.db.test.ts`.

Testes:
- (a) Prospecta `pnpm check` OK; suíte 959/959 (9 novos: os 6 módulos, já concluído, cancelado, sem registro, módulos sem
  vínculo, reconciliação). Santa Fé `tsc` OK, eslint sem erros, teste de banco 3/3 (conclui mantendo dados, não
  conclui registro de outro lead, não reabre cancelado).
- (b) manuais: nenhum.
- (c) produção: aplicar a reconciliação do serviço 67 e conferir no CRM e em Regularizações; clicar "Concluir" num
  serviço real de cada tipo. Sem migração de banco nesta etapa.

## E6 — Duplicar lead (concluída em código)
Requisitos: botão "Duplicar lead" no topo do lead; lead novo com ID próprio copiando dados, informações e documentos;
sem serviços, processos, etapas, solicitações/entregas ou histórico transacional; documentos reaproveitam o arquivo
do Drive com segurança; permissões e visibilidade do cliente respeitadas; atômico; origem registrada.

Decisões:
- Copia: dados cadastrais/renda/CPF/contatos, responsável, corretor, temperatura, observações (Prospecta: notes e
  admin_notes; Santa Fé: notas, orçamento, valor aprovado, imóvel de interesse) e os documentos ativos.
- Reinicia: etapa (Prospecta `lead_new`; Santa Fé `novo`, sem etapa operacional), motivo de recusa, follow-up, prazo do
  card, arquivamento/exclusão. Santa Fé: lista de serviços do lead fica vazia e **senha/conta do portal não são copiadas**.
- Não copia: serviços, processos (obra/financiamento/projeto/regularização/avaliação), tarefas, visitas, contratos,
  versões antigas de documentos, datas de solicitação de documento, atividades/interações (só a nota de origem).
- Documentos: registro novo apontando para o mesmo arquivo (Prospecta: mesmo `drive_file_id` e cópia dos bytes quando
  o arquivo está no banco; Santa Fé: mesmo `arquivoId`). Nenhum fluxo apaga o arquivo do Drive de documento de lead
  (exclusão é lógica; trocar documento cria arquivo novo), então editar/remover num lead não afeta o outro.
  Prospecta: a organização automática de pastas do Drive ignora as cópias (`copied_from_document_id`), para o arquivo
  não "pular" para a pasta do lead novo. Santa Fé: a rota `/api/arquivo/[id]` passou a autorizar se o usuário tiver
  acesso a **qualquer** documento que use o arquivo (antes pegava só o primeiro), mantendo `visivelCliente`.
- Visibilidade do cliente: o portal liga o cliente ao lead pela conta (`users.leadId` / `Usuario.leadId`); o lead
  novo não ganha acesso de cliente automaticamente. `visivelCliente` dos documentos é copiado como está.
- Atomicidade: Prospecta numa única instrução SQL (CTEs); Santa Fé numa transação Prisma.
- Origem: Prospecta `leads.duplicated_from_lead_id/duplicated_at/duplicated_by_user_id` + nota nos dois leads; Santa Fé
  `Lead.duplicadoDeId/duplicadoEm/duplicadoPorId` + interação nos dois. Selo "Duplicado do lead #X" no lead novo.
- Permissão: Prospecta módulo CRM; Santa Fé equipe interna (admin/colaborador) com módulo Leads.

Arquivos:
- Prospecta: `drizzle/0068_lead_duplicacao.sql`, `drizzle/schema.ts`, `shared/lead-duplicar.ts`, `server/lead-duplicar.ts`,
  `server/routers.ts` (`leads.duplicate`), `server/drive-documents.ts`, `client/src/pages/admin/AdminLeadDetail.tsx`,
  `server/lead-duplicar.test.ts`.
- Santa Fé: `prisma/schema.prisma`, `prisma/migrations/20261023140000_lead_duplicacao/migration.sql`,
  `src/lib/crm/lead-duplicar.ts`, `src/lib/crm/lead-duplicar-db.ts`, `src/lib/actions/leads.ts` (`duplicarLead`),
  `src/app/admin/leads/[id]/duplicar-lead-botao.tsx`, `src/app/admin/leads/[id]/page.tsx`, `src/app/api/arquivo/[id]/route.ts`,
  `src/lib/__tests__/lead-duplicar.db.test.ts`.

Testes:
- (a) Prospecta `pnpm check` OK; suíte 962/962 (3 novos). **SQL real executado** na branch de teste Neon
  `teste-migrations-0024-0026` (`br-cold-feather-an7ecnay`, NÃO é produção; recebeu colunas faltantes + 0068 para o
  teste): lead 14 → lead 70; 2 documentos copiados (o excluído não), `service_id` nulo, arquivo do banco copiado com bytes
  idênticos, 2 notas, lead de origem intacto. Santa Fé `tsc` OK, eslint sem erros, teste de banco 3/3 (cópia,
  exclusões, troca de documento não afeta o original nem o arquivo, atomicidade com falha simulada, lead excluído).
- Suíte Santa Fé completa (Postgres local) após as etapas 2C–6: 804 ok / 10 falhas — as mesmas 10 pré-existentes do
  ambiente local registradas no E0 (eram 790 ok; +14 testes novos). Prospecta `pnpm build` OK.
- (b) manuais: nenhum.
- (c) produção: duplicar um lead real com documentos no Drive e abrir os documentos nos dois leads (e pelo portal do
  cliente do lead original).

## Estado atual (fim da implementação)
- Todas as etapas (1, 2A/B, 2C, 3, 4, 5, 6) estão em código, testadas e no GitHub na branch `claude/sync-mirrored-repos-bsqnz3`.
- PRs em rascunho: Prospecta **#160**, Santa Fé **#223** (contêm os PRs do Codex #157–#159 e #220–#222).
- Builds: Prospecta `pnpm build` OK; Santa Fé `npm run build` OK (Postgres local).
- `origin/main` não mudou desde o início do lote (Prospecta `c007757`, Santa Fé `793a4cb`): sem conflito.
- **Nada aplicado em produção**: migrações, merge, deploy e a reconciliação do serviço 67 aguardam autorização expressa do dono.

## Próximo passo exato (após autorização do dono)
1. Marcar #160 e #223 como prontos e conferir o preview da Vercel.
2. Aplicar migrações aditivas em produção: Prospecta 0066, 0067, 0068 (Neon `run_sql_transaction`, projeto
   `plain-cake-26372935`); Santa Fé `20261023120000_projeto_revisoes`, `20261023130000_obra_imovel_localizacao`,
   `20261023140000_lead_duplicacao` (Supabase `apply_migration`, projeto `giulchozonhzyopmgmkv`).
3. Merge dos dois PRs (merge commit) e acompanhar o deploy de produção na Vercel.
4. Reconciliação da etapa 4: serviço 67 → regularização 22 para `concluido` (só status), com nota no lead.
5. Conferência em produção por etapa e relatório final (a)/(b)/(c).
6. Opcional: apagar/limpar a branch Neon de teste `teste-migrations-0024-0026` (recebeu colunas e um lead 70 de teste),
   só com autorização.
