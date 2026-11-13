# Handoff — 13/11/2026 — Paridade: Central de Vendas no Grupo Santa Fé

Branch: `claude/paridade-central-vendas` (a partir de `origin/main` em `335211a`). Sem merge, sem PR, sem deploy.
Origem: módulo Central de Vendas publicado na Prospecta em 12/11 (PR #215). Fonte da verdade (Prospecta, só leitura):
`docs/prompts/central-de-vendas.md`, `HANDOFF-12-11-CENTRAL-DE-VENDAS.md`, `drizzle/0110_central_vendas.sql`,
`server/central-vendas/*`, `shared/central-vendas/*`, `client/src/pages/admin/AdminCentralVendas.tsx`, testes
`server/central-vendas-*.test.ts`.
Pedido de port veio da sessão coordenadora (a paridade estava suspensa em 12/11). Merge, deploy e migração em
produção: **só com autorização do dono**.

## Diagnóstico (etapa 1) — mapeamento Prospecta → Santa Fé

| Prospecta | Santa Fé (reaproveitado) |
|---|---|
| `leads.stage` lead_new → attending → approved_projects | `leads.etapaOperacional` novo_lead → em_atendimento → aprovado_follow_up (pipeline do lote CRM 11/10, `src/lib/types/crm.ts`). Só avança; etapa legada/sem classificação não é tocada; registra `interacoes` como o pipeline |
| `leads.temperature` cold → warm → hot | `leads.temperatura` frio → morno (qualificado) → quente (aprovado; não rebaixa "fechado") |
| `leads.sourceChannel` | `leads.origem` |
| `leads.responsibleUserId` | `leads.responsavelId` (admin/colaborador) |
| `leads.city/income/incomeType/fgtsAmount/hasSpouse/incomeComposition/lgpdConsent(At)` | **não existem no Lead do Santa Fé** → ficam em `central_vendas_leads` (cidade, renda, tipoRenda, fgts, estadoCivil, composicaoRenda, lgpdConsentimento/Em). Nome vai para `leads.nome` |
| `leads.rejection_reason` | `central_vendas_leads.motivoReprovacao` (só equipe; aparece na aba Atendimentos) |
| `lead_activities` | `interacoes` (tipo `nota`/`documento`) |
| `lead_documents` (linha nova por mídia, link `/api/whatsapp/midia/<id>`) | checklist de documentos do CRM: `documentos_cliente` (tipo) + `documentos_cliente_versoes` + `arquivos` (cópia dos bytes da `whatsapp_midias`), igual ao upload da equipe |
| `tasks` | `tarefas_crm` (Agenda), `responsavelId` = analista |
| `user_notifications` | `notificacoes` (tipo `central_vendas`) |
| `whatsapp_*`, `chaveTelefone`, webhook Evolution | `mensagens_whatsapp`, `whatsapp_midias`, `whatsapp_vinculos_conversa`, `whatsapp_templates` (slug `cv-*`, `finalidade` = "Central de Vendas"), `leadDoVinculo`/`leadPorTelefone` do webhook, `configEvolution` + `enviarTextoEvolution` |
| Cofre `secret-vault.ts` | `src/lib/segredo.ts` (mesmo formato AES-256-GCM, chave do AUTH_SECRET) |
| Cron diário `/api/cron/lead-card-due` | o mesmo (`web/src/app/api/cron/lead-card-due/route.ts`, sem cron novo) |
| router tRPC `centralVendas` (módulo `crm`) | server actions `src/lib/actions/central-vendas.ts` (módulo `leads`, sem módulo novo em `MODULOS_PAINEL`), tela `/admin/central-vendas` + item no menu lateral |
| Neon HTTP sem transação | Prisma/pg: mesmas reivindicações atômicas (`updateMany` condicionado ao estado, `createMany skipDuplicates` em chaves únicas); só o vínculo do documento usa `$transaction` |

## Concluído (commits)
- `c1274ac` — etapas 1–2: diagnóstico e migração aditiva `web/prisma/migrations/20261113200000_central_vendas/migration.sql`
  + modelos no fim de `web/prisma/schema.prisma` (bloco `// ── Paridade Central de Vendas (13/11) ──`; única linha em
  modelo existente: `Lead.centralVendas`, relação inversa exigida pelo Prisma).
- `334637f` — etapas 3–6: `web/src/lib/central-vendas/` — puros (`config.ts`, `regras.ts`, `indicadores.ts`,
  `templates.ts`, copiados da Prospecta com ids texto e etapas do Santa Fé) e serviços (`base`, `entrada`,
  `distribuicao`, `ia`, `documentos`, `analise`, `envio`, `sequencias`, `rotina`, `logyca`, `rotas`); rotas POST
  `/api/central-vendas/entrada/site` e `/entrada/logyca`; gancho no webhook da Evolution
  (`src/lib/whatsapp/webhook-evolution.ts`), rotina no cron diário, templates `cv-*` não escondem os padrões
  (`admin/whatsapp/page.tsx`, mesma regra da Prospecta).
- `44a56c7` — etapas 7–11: `src/lib/actions/central-vendas.ts`, `src/app/admin/central-vendas/` (abas Painel,
  Atendimentos, Configurações, Produtos, Checklists, Sequências, Campanhas, Templates, Auditoria), menu
  (`components/admin/sidebar.tsx`, `app/admin/layout.tsx`: aparece para admin/colaborador com o módulo CRM).
- Este commit — handoff final e registro em `HANDOFF-12-11-STANDBY-PARIDADE.md`.

Mesmo modelo de IA da Prospecta: `claude-sonnet-5` (padrão em `config.ts`, editável na tela). Entra **desligada**
(interruptor geral off, modo de teste on, Logyca off).

## Diferenças restantes em relação à Prospecta (todas por estrutura de dados do Santa Fé)
1. Dados de qualificação e LGPD ficam no registro da Central, não no Lead (o Lead do Santa Fé não tem esses campos;
   não alterei a tabela `leads`). Motivo interno da reprovação idem.
2. Documento: vira item do checklist de documentos do CRM (um por tipo; o anterior vai para "versões"). Os tipos do
   checklist da Central são os do CRM do Santa Fé (`rg`, `address_proof`, `income_proof_formal`, `spouse_docs`,
   `spouse_income_proof`, `pis`, `fgts`, `birth_marriage_certificate`, `other`); a Prospecta tem também `cnh` e
   `income_proof_irpf`. Mídia que não foi baixada da Evolution (falha ou > 10 MB) não vira documento: evento
   `documento_sem_arquivo` + aviso ao operador (na Prospecta o registro aponta para a mídia mesmo sem arquivo).
3. Sem FK para `usuarios` nas tabelas novas (ids guardados como texto); eventos/fila/contatos sem FK para `leads`
   (a auditoria fica mesmo se o lead for apagado; a fila confere se o lead existe antes de enviar).
4. Tabelas novas com RLS ligado + REVOKE de anon/authenticated (padrão do Supabase no repo; a Prospecta usa Neon).
5. Permissão: módulo `leads` (equivale ao `crm` da Prospecta); corretor não entra na Central.

## Testes
- (a) automáticos (13/11, nesta branch):
  - `npx tsc --noEmit -p .` ✅ sem erros.
  - `npx eslint` nos arquivos novos/alterados ✅ 0 erros (1 aviso antigo de `<img>` em `sidebar.tsx`, linha que não mexi).
  - `npx vitest run` (suíte completa): 1ª rodada (workers padrão) 1 falha por **timeout de 5 s** no teste antigo
    `anexos-qualquer-tipo.test.ts` (passa sozinho: 8/8) — carga da máquina; 2ª rodada `--maxWorkers=3` ✅
    **176 arquivos passaram, 28 pulados (precisam de TEST_DATABASE_URL, já existiam), 1.303 testes passaram, 0 falhas**.
  - Da Central: 10 arquivos `src/lib/__tests__/central-vendas-*.db.test.ts` (migração, entrada, distribuição, IA,
    documentos, análise, envio, Logyca, painel/ações, e2e do critério de pronto) com PostgreSQL em memória (PGlite +
    socket) e o Prisma real; migração aplicada 2× sobre o schema; nenhuma chamada a Anthropic, Evolution ou Logyca
    (envio/IA/fetch simulados), nenhum banco real.
  - `npx next build`: ✅ compilou e passou no TypeScript; ❌ parou na geração estática de `/` por falta de banco
    (`Can't reach database server at 127.0.0.1:5432`) — falha esperada neste ambiente.
- (b) manuais: nenhum (sem navegador nem banco real nesta sessão; a tela não foi aberta).
- (c) produção: aplicar a migração; abrir `/admin/central-vendas`; rodar o roteiro abaixo com um número de teste.

## Migração a aplicar (NÃO aplicada em banco real)
`web/prisma/migrations/20261113200000_central_vendas/migration.sql` — 12 tabelas `central_vendas_*` (CREATE ... IF
NOT EXISTS), FKs e CHECKs (status válidos, `decisao_humana`, config única) guardados por `DO $$ IF NOT EXISTS`, índice
parcial único (origem, idExterno), RLS + REVOKE. Idempotente (testado 2×). Reversão: `DROP TABLE` das `central_vendas_*`.
Pelo Prisma: `npx prisma migrate deploy` (ou aplicar o SQL no Supabase).

## O que o dono precisa preencher (depois de merge/deploy autorizados)
1. Aplicar a migração no Supabase.
2. Nada novo de ambiente: `ANTHROPIC_API_KEY` (já usada pelo sistema; ou a chave própria na tela, cifrada),
   `AUTH_SECRET` (cofre), `CRON_SECRET` (cron diário), Evolution conectada por QR code (já existente).
3. Central de Vendas › Configurações: operadores e analistas; números de teste; checklist(s) e checklist padrão;
   produtos/empreendimentos (descrição, preço, requisitos, condições — a IA só fala isso); sequências (nenhuma vem
   criada); campanhas; token do site (se o site for mandar leads) e, se usar, token de entrada e endpoint/token de
   envio da Logyca.
4. Ligar o interruptor geral (começa desligado; o modo de teste começa ligado).

## A validar com a Logyca (igual à Prospecta)
Resposta do envio (ID/status), envio de mídia, webhooks/contatos/tags (não implementados), formato do bloco
"HTTP Request" (`{ telefone, nome?, email?, cidade?, mensagem?, idExterno?, campanha?, consentimentoLgpd? }` com
`Authorization: Bearer <token>`).

## Riscos / pendências
- `zod` é usado sem estar no `package.json` do `web` (vem como dependência transitiva, versão 4.4.3; o repo já fazia
  isso em `incorporacao/due-diligence.ts`). Se uma atualização de dependências o remover, o build quebra.
- SLA em minutos depende de tráfego (aviso do WhatsApp, painel aberto) ou do cron diário — sem cron de minutos.
- Classificação de documento só por metadados (nome/tipo/legenda), por privacidade.
- Tela não validada em navegador.
- ROADMAP da Prospecta: registrar que o Santa Fé tem a Central na branch acima (esta sessão não pode alterar a Prospecta).

## Roteiro do teste ponta a ponta (modo de teste, produção)
1. Configurações: modo de teste ligado, seu número na lista, você como operador e analista, salvar.
2. Checklists: "MCMV" com RG (tipo rg), comprovante de renda (income_proof_formal) e de residência (address_proof).
   Produtos: código `teste` com o checklist. Ligar o interruptor geral. Salvar.
3. Do número autorizado, mandar "Olá [ref:teste]" → lead no CRM atribuído a você; a IA pede o consentimento.
4. Responder SIM e os dados → chega a lista de documentos.
5. Mandar os 3 documentos (ex.: "rg.pdf", "holerite.pdf", "comprovante de residencia.pdf") → mensagem
   "encaminhado para análise", tarefa "Análise — <nome>" na Agenda e documentos no checklist do lead.
6. Central de Vendas › Atendimentos → Aprovar (ou Pendente/Reprovar) → a mensagem correspondente chega.
7. Conferir Painel e Auditoria. 8. Mandar "SAIR" → confirmação e mais nenhuma mensagem automática.

## Próximo passo exato
Coordenador: revisar a branch `claude/paridade-central-vendas` e, com autorização do dono, abrir PR, mesclar,
aplicar a migração e executar o roteiro acima. Depois, registrar no ROADMAP da Prospecta que o Santa Fé está em dia.
