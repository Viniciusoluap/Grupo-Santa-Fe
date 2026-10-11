# Grupo Santa Fé — limpeza estrutural e CRM central

## Escopo e isolamento

- Exclusivamente `Viniciusoluap/Grupo-Santa-Fe`.
- Branch: `codex/santa-fe-limpeza-crm-20261011`.
- Baseline auditado: `6e3e1f4` (PR #157 do Claude integrada).
- Trabalho anterior não commitado foi preservado em seu checkout original.
- Nenhuma alteração deste lote foi aplicada em produção. Nenhum merge autorizado.
- As instruções AIOX foram usadas como fases de auditoria, desenvolvimento,
  banco e qualidade. Não houve instalação de orquestrador ou infraestrutura nova.

## Lotes e comportamento

1. Dependências, rotas, Prisma, autenticação, permissões e registros auditados.
2. Sete módulos independentes removidos estruturalmente, incluindo páginas,
   componentes, server actions exclusivas e APIs. `/admin` passa a redirecionar
   para `/admin/leads`. `/mercado` era exclusivamente Agregador e foi removido.
3. Sete etapas operacionais: NOVO LEAD; EM ATENDIMENTO; APROVADO E FOLLOW-UP;
   PROJETOS E VISTORIAS; CONTRATOS E CARTÓRIO; MEDIÇÕES; FINALIZADO.
4. Obras, Financiamentos, Regularização e Projetos nascem exclusivamente da
   seleção no CRM. Suas antigas ações de criação foram removidas; `/novo`
   redireciona ao CRM. Os módulos mantêm edição, administração e vínculo inverso.
5. Demandas têm ID, `leadId`, módulo e `requestKey` únicos. O lead é bloqueado
   dentro de transação serializável, com retry limitado para P2034. Gravação do
   lead, operações, checklist e sincronização cadastral é atômica.
6. Novas operações do mesmo tipo são intenções explícitas na ficha do lead.
   Reenvio do mesmo requestKey não cria outro processo. Arquivar uma operação
   preserva seus IDs e impede recriação na próxima sincronização.
7. Operações pendentes não recebem valores financeiros/técnicos fictícios.
   Configuração operacional usa campos nullable e status aguardando configuração.
   Alterar a modalidade de financiamento mantém o mesmo processo/demanda e
   atualiza interesses e histórico na mesma transação.

## Preservação e reconciliação

Preflight de produção somente-leitura:

| Entidade | Total | Sem lead |
|---|---:|---:|
| Leads | 26 | — |
| Obras | 4 | 1 |
| Financiamentos | 20 | 1 |
| Projetos | 4 | 1 |
| Regularizações | 5 | 0 |

Status atuais: novo 18, contato 2, proposta 3, negociação 2 e ganho 1.
Somente novo e contato têm correspondência automática segura. Os seis outros
leads ficam A CLASSIFICAR. O campo comercial original não é sobrescrito;
perdidos/arquivados/excluídos permanecem fora do pipeline ativo e acessíveis no
histórico conforme permissões. Mudanças de etapa, arquivamento e exclusão
lógica deixam Interacao de auditoria, com o ator consultado no servidor.

Três operações sem lead são preservadas e sinalizadas nos módulos. Para
reconciliá-las, revisar seus documentos e identificar o lead por ID confirmado;
não usar nome semelhante, não criar cliente duplicado e não mover operações já
pertencentes a outro lead. Este lote não inventa as três correspondências.

A migração cria demandas para operações cujo leadId já é uma FK válida. Não
altera seus números, documentos, etapas, prazos ou históricos. FK composta e
triggers garantem correspondência entre processo, demanda, módulo e lead.

## Banco e limpeza

`web/prisma/migrations/20261011233000_crm_central_limpeza/migration.sql`:

- Transação única e lock_timeout de 10 segundos.
- Novas colunas operacionais/arquivamento/exclusão lógica e chave de reenvio.
- Tabela servicos_lead, índices únicos, FKs compostas e proteção de origem.
- Mapeamento seguro dos status e backfill por FKs existentes.
- RLS na tabela nova; acesso Data API anon/authenticated revogado.
- Sem DROP TABLE, TRUNCATE ou apagamento de leads/operações.
- AgregadorImovel e Lancamento saem do modelo Prisma e do esquema public.
  Suas tabelas ficam em arquivo_modulos_removidos, privado, deliberadamente
  retido para recuperação. Isto não é tabela operacional órfã: proprietário,
  origem e rotina de restauração ficam documentados neste manifesto.

Contrato e ContratoDocumento permanecem: são compartilhados com Jurídico,
Comissões, CRM e Portal. Configuracao, Imovel, arquivos, bancos, BPO e relatórios
internos dos módulos ativos também permanecem. Nenhuma dependência de pacote
foi retirada sem provar que deixou de ser usada.

O procedimento `web/prisma/operations/restaurar_arquivo_modulos.sql` permite
restaurar as duas tabelas sem apagar dados novos. Não executar rollback que
remova colunas/demandas já usadas. Eventual purga física do arquivo exige backup
validado e autorização específica adicional; não está incluída neste lote.

## Verificação reproduzível

- `npm test`: 374 testes passaram em 45 arquivos antes da revisão final visual.
- TypeScript: `node_modules/.bin/tsc --noEmit`.
- Lint dos arquivos alterados: aprovado; aviso preexistente de img na Sidebar.
- Lint global: 12 erros preexistentes, em hooks locais, seed, AdminShell,
  sugestão de avaliação, BPO e chat do Jurídico. Esses arquivos não foram
  alterados para mascarar ou desligar regras. Não declarar lint global aprovado.
- `scripts/verify-crm-integration.ts` usa somente PostgreSQL local, recusa
  servidores remotos e testa migração/arquivo, idempotência, rollback,
  múltiplos serviços, auditoria, FK cruzada e bloqueio de criação independente.
- Banco de testes PGlite com protocolo pg: teste funcional de persistência.
  O multiplexador serializa conexões; não equivale a teste de carga concorrente
  de PostgreSQL nativo. Proteção está também em índice único e lock/transação.
- `scripts/verify-crm-browser.mjs`: login, navegação, rotas, seis larguras e
  ausência de overflow/erros. Os resultados finais são registrados abaixo.

## Gate antes de produção

1. Atualizar main e revisar qualquer alteração concorrente do Claude.
2. Repetir preflight: contagens, status ambíguos, FKs, índices, triggers, views
   e privilégios das tabelas a arquivar. Validar backup recuperável do Supabase.
3. Revisar/aprovar a migração e o destino; não executar reset ou db push.
4. Aplicar a migração antes do código que seleciona as novas colunas.
5. Validar contagens/arquivo/serviços/checklists e que seis casos ambíguos não
   foram avançados indevidamente; confirmar as três operações ainda sem lead.
6. Merge e deploy somente após autorização final. Validar fluxos reais na
   produção com registros controlados, incluindo isolamento entre corretores.

## Resultado final de build e navegador

- Build completo Next.js 16.2.7/Turbopack: aprovado (compilação, TypeScript,
  geração estática e rotas). Dependências instaladas pelo lockfile, sem alteração
  de versões no projeto.
- QA de leitura no Chromium: login, sete colunas, seis larguras, zero overflow
  global, seis módulos removidos retornando 404, quatro módulos contendo os
  registros reais do banco isolado e rotas `/novo` redirecionando para Leads.
- Capturas em `docs/aiox/evidencias/crm-{320,375,390,430,768,1280}.png`.
  Inspeção visual de 320 e 1280 realizada; nenhum corte/sobreposição encontrado.
- Teste completo de cadastro/edição pela interface NÃO aprovado: o servidor
  PGlite Socket sob conexões simultâneas apresentou portais SQL misturados,
  falhas de sessionVersion e timeout de transação. Não enfraquecer autenticação
  nem aumentar timeout de produção para contornar o ambiente de teste. Repetir
  o fluxo em PostgreSQL nativo isolado antes de liberar o merge.
- A revisão automática bloqueou uma execução ao identificar possível redirect
  HTTP para o domínio real. Nenhum registro de teste foi encontrado em produção
  na consulta posterior. O preload `scripts/local-network-only.mjs` e a rota de
  rede do navegador agora bloqueiam destinos externos e redirects; manter esta
  proteção em toda repetição. Não declarar aprovação de testes em produção.

## Execução local isolada

Gerar um SQL baseline a partir do schema no commit auditado usando
`prisma migrate diff --from-empty --to-schema <baseline.prisma> --script`.
O script de persistência exige AIOX_TEST_DATABASE=1, conexão exclusivamente
localhost/127.0.0.1 e AIOX_BASELINE_SQL apontando para esse SQL. O script de
navegador exige runtime de testes com Playwright/Chromium em
AIOX_TEST_RUNTIME_DIR. Iniciar servidor PostgreSQL local, executar a verificação
de persistência, build e navegador na mesma sessão. O modo
AIOX_BROWSER_READONLY=1 verifica leitura/layout sem considerar cadastro/edição
aprovados. Em PGlite, usar capacidade suficiente de conexões para leitura, mas
manter explícita a limitação de concorrência do multiplexador.
