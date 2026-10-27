# HANDOFF 26/10 — AIOX, 16 correções

## Identificação

- Repositório: `Viniciusoluap/Grupo-Santa-Fe`
- Branch: `codex/aiox-16-correcoes-20261026`
- Base auditada: `main` em `a6963894010702b71d062e8180a19056b8004160`
- Aplicação: diretório `web/` (Next.js/Prisma)
- Sessão iniciada: 26/10/2026
- Autorização do proprietário: execução, merge e deploy.

## Objetivo

Auditar, implementar, testar e publicar as correções 01–16 do prompt mestre de 26/10/2026, mantendo paridade funcional com a Prospecta e preservando dados e integrações.

## Estado inicial confirmado

- Clone limpo e alinhado a `origin/main`; nenhum arquivo local pendente.
- Nenhum PR aberto no repositório no início da sessão.
- Handoffs de 25/10 e commits recentes lidos; o porte anterior de BPO, WhatsApp, mídias e integrações já está em `main`.
- As migrações anteriores `20261025220000` e `20261025230000` constam como aplicadas em produção no Handoff precedente.
- Não há código desta nova execução antes deste checkpoint.
- A auditoria requisito a requisito está em andamento para evitar duplicar funcionalidades já entregues.

## Matriz inicial

| Correções | Situação | Próxima ação |
|---|---|---|
| 01–08 WhatsApp | Em auditoria | Comparar UI, serviços, persistência e testes com os aceites |
| 09–15 BPO/integrações | Em auditoria | Mapear origem financeira, vínculos, Pluggy/Cora e migrações |
| 16 Projetos | Em auditoria | Mapear revisão, arquivos, versões e checklist |

## Proteções e decisões

- Nenhuma migração destrutiva será executada sem backup, prévia de impacto e caminho de recuperação.
- Credenciais e dados pessoais não serão registrados neste arquivo.
- Alterações serão feitas nesta branch, com checkpoints publicados por etapa.
- A ordem interna poderá mudar por dependência técnica, com justificativa registrada.
- Testes serão separados em: (a) automáticos, (b) manuais e (c) produção.

## Testes

- (a) Automáticos: ainda não executados neste checkpoint documental.
- (b) Manuais: estado Git, branch principal, HEAD, branches remotas, instruções e Handoffs conferidos.
- (c) Produção: nenhuma alteração realizada.

## Arquivos modificados

- `HANDOFF-26-10-AIOX-16-CORRECOES.md`

## Bloqueios

- Nenhum bloqueio confirmado. O GitHub CLI não está instalado; operações de PR/merge serão realizadas pelo conector GitHub.

## Próximo passo exato

Concluir a auditoria das 16 correções nos dois repositórios, publicar a matriz de lacunas neste Handoff e iniciar o primeiro lote técnico com testes focados.

## Checkpoint BPO 09/12/13/15 — 27/10/2026

- Worktree isolado: `/workspace/scratch/0452d125bfcc/wt-sf-bpo-finish`, branch `codex/aiox-sf-bpo-finish`, baseada em `codex/aiox-16-correcoes-20261026`.
- Implementado: prévia de limpeza bancária mostra contagens e exige confirmação digitando o rótulo; backup transacional sem credenciais; lançamentos Asaas e ligados a obra/regularização são desassociados da transação e preservados; os outros lançamentos e movimentos são removidos e a conta arquivada inativa.
- Implementado: edição BPO exige versão otimista, motivo e grava snapshot antes/depois com usuário e versão; categorias operacional/contábil agora têm colunas próprias.
- Implementado parcialmente: despesa manual aceita etapa de obra validada e selecionada por `SERVICOS_PROGRESSO`.
- Migração aditiva `20261026200000_bpo_audit_limpeza_categorias`, com RLS habilitado e forçado para tabelas de backup/auditoria.
- Pendências: importação CRM idempotente e remoção do fluxo “Serviços Contratados” ainda não implementadas; a edição auditável não ganhou formulário visual e a categoria contábil ainda não tem tela de classificação; não foram adicionados testes automatizados deste lote.
- (a) Automáticos: `git diff --check` aprovado. Prisma generate interrompido porque `web/node_modules` não existe; TypeScript também indisponível pelo mesmo motivo. Lint e testes focados não executados.
- (b) Manuais: instruções e branch base conferidas; operação destrutiva tem prévia, confirmação textual e backup criado na mesma transação.
- (c) Produção: nenhuma migração/dado aplicado; sem validação em produção.
- Próximo passo exato: instalar/restaurar dependências, executar `npx prisma generate`, typecheck/lint/testes focados; concluir itens 13/14 no CRM e UI da edição/categoria; revisar migração e criar commit local. Push/merge/deploy permanecem fora do escopo desta etapa.

## Checkpoint BPO — fechar pendências após integração c6edbc1 (27/10/2026)

- Branch de trabalho nova: `codex/aiox-sf-bpo-pendencias`, criada sem reset a partir do HEAD integrado `c6edbc1` (que contém o commit anterior `17851cf`).
- CRM → BPO: botão “Importar Clientes CRM” importa leads não arquivados/não excluídos que ainda não têm cliente BPO e retorna resumo de encontrados/criados/já vinculados; índice único por `leadId` torna repetição e concorrência idempotentes. O cadastro manual também redireciona para o cliente BPO existente ao selecionar lead já importado. Seleção de lead nos lançamentos agora usa o cliente BPO vinculado ao mesmo `leadId` quando disponível.
- Serviços contratados: removidos do formulário, detalhe, ação de criação e modelo Prisma. Migração arquiva os valores antigos em tabela protegida por RLS antes de retirar a coluna; reconcilia duplicatas CRM BPO, redirecionando vínculos para o cliente canônico e arquivando snapshots antes de criar o índice único.
- Edição: tabela de cobranças/despesas oferece edição com confirmação de motivo; ação valida campos, compara `version`, grava antes/depois e usuário no histórico, e preserva categoria contábil enquanto classifica categoria operacional/módulo por `SERVICOS_PROGRESSO`.
- Categorias e vínculos: formulário distingue categoria contábil e módulo operacional; a categoria contábil existente continua alimentando DRE/relatórios. Lançamentos ligados a lead passam a usar a relação BPO→CRM de verdade quando o lead já foi importado.
- Teste focado criado: `web/src/lib/__tests__/bpo-importacao-crm.test.ts`, cobrindo primeira importação e repetição sem duplicatas via helper puro.
- (a) Automáticos: `git diff --check` aprovado. Prisma generate, TypeScript, ESLint e Vitest não executados: `web/node_modules` não existe neste worktree e o repositório não contém `.bin` local.
- (b) Manuais: conferidos os campos/rotas BPO, todas as referências de “Serviços Contratados” removidas do módulo BPO, a migração salva snapshots antes do drop e a branch parte de `c6edbc1`.
- (c) Produção: nenhuma migração ou dado aplicado; sem validação de produção.
- Próximo passo exato: em ambiente com dependências instaladas, rodar `npx prisma generate`, `npx tsc --noEmit`, `npx eslint` nos arquivos alterados e o teste focado; revisar interação visual da edição e aplicação da migração antes de qualquer publicação.

## Checkpoint de retomada — 26/10/2026, noite

- Recuperados e inventariados todos os checkpoints locais da execução AIOX interrompida, sem descarte.
- Correções 10/11 integradas: Pluggy `/v2/transactions` por cursor, erro detalhado, identificador bancário e paridade do importador Cora.
- Correção 16 integrada parcialmente: estrutura aditiva de revisão/documentos e helper de nome canônico; UI, transações de status/prioridade e checklist derivado ainda pendentes.
- Correções 01–09 e 12–15 ainda aguardam o porte/implementação específico da stack Next.js/Prisma.

### Testes deste checkpoint

- (a) Automáticos: Prisma generate e TypeScript aprovados; 3 arquivos focados/10 testes de Pluggy, Cora/BPO e documentos de projeto aprovados.
- (b) Manuais: commits parciais inventariados e cherry-picks sem conflito.
- (c) Produção: nenhuma migração ou dado alterado; merge/deploy ainda não executados.

### Próximo passo exato

Concluir a paridade de WhatsApp e BPO, finalizar a Correção 16, adicionar testes das regras críticas e executar lint/suíte/build antes de qualquer migração de produção.

## Etapa WhatsApp Santa Fé — checkpoint local

- Branch de trabalho: `codex/aiox-sf-whatsapp-finish`, criada a partir de `codex/aiox-16-correcoes-20261026`.
- Concluído neste checkpoint: aba Histórico removida sem operações de exclusão/alteração nos registros; controles de conexão QR/API operacional acessíveis na aba Conexão do WhatsApp; bloco Integrações mantém o cadastro/validação das credenciais e agora aponta para a operação em Serviços › WhatsApp; nome de conversa é atualizado a partir do CRM e o webhook já mantém a precedência CRM sobre `pushName`; PDF de conversa abre em visualizador interno e o botão voltar preserva a conversa; texto de confirmação usa dia e horário, sem endereço; teste de integração cobre prioridade do nome CRM sobre `pushName`.
- Arquivos principais: `web/src/app/admin/whatsapp/_components/whatsapp-client.tsx`, `web/src/app/admin/whatsapp/_components/conversas-whatsapp.tsx`, `web/src/app/admin/integracoes/_components/integracoes-client.tsx`, `web/src/lib/actions/whatsapp.ts`, `web/src/lib/__tests__/whatsapp-conversas.db.test.ts`.
- Pendências deste lote (não declarar 01–08 concluídas): templates seguem estáticos, faltam CRUD administrativo/persistência/migração e seed; falta checklist de serviços reais opcional na captação de lead sem serviço; aba Templates ainda não foi convertida em gerenciador exclusivo. Revisar também a hierarquia de navegação para garantir visualmente Serviços › WhatsApp.
- (a) Automáticos: teste e lint/typecheck ainda não executados; a árvore não contém `web/node_modules`, então os comandos locais estão indisponíveis sem instalação.
- (b) Manuais: revisão do diff e das rotas/telas alteradas; nenhuma UI navegada em browser.
- (c) Produção: nenhuma alteração em banco, credenciais ou serviço externo; nenhuma validação de produção.
- Próximo passo exato: implementar templates persistentes com migration/seed e CRUD limitado a admin; completar captura opcional dos serviços corretos; executar testes focados, `tsc` e lint numa instalação com dependências.

## Checkpoint de retomada — 27/10/2026, validação 1

- Dependências existentes confirmadas; `npx prisma generate` concluiu com Prisma Client 7.8.0.
- O primeiro typecheck encontrou uma referência inválida `BPO` no revalidate da edição auditável; corrigido para a rota real `/admin/bpo`.
- `npx tsc --noEmit` passou após a correção.
- Os agentes especializados retomaram, em worktrees isolados, as lacunas remanescentes de BPO e templates WhatsApp; nenhuma produção foi alterada.

### Próximo passo exato

Integrar os dois commits especializados após revisão, executar testes e build completos e publicar o checkpoint remoto antes de migrações, merge ou deploy.

## Checkpoint de validação — 27/10/2026, BPO e WhatsApp

- Correção 14 concluída: importação CRM idempotente por `leadId`, resumo de inseridos/atualizados/inalterados, cadastro livre preservado e “Serviços Contratados” removido da UI e do fluxo de gravação.
- Correção 12: formulário de edição auditável integrado ao detalhe BPO, com versão e motivo.
- Correções 04–07 concluídas: templates persistentes com seed idempotente, criação/edição restrita ao administrador, validação de variáveis, prévia e uso na aba Enviar.
- Correção 05: checklist múltiplo utiliza `SERVICOS_LEAD`; somente os selecionados entram em `{{servico}}`/`{{servicos}}` e o envio é bloqueado sem seleção.
- Prisma generate e TypeScript aprovados. Nove arquivos focados/43 testes aprovados.
- Build Next compilou e passou TypeScript, mas o prerender da página `/` foi bloqueado por `ECONNREFUSED` ao consultar `Imovel`; o ambiente local não alcança o banco configurado. Nenhuma falha foi atribuída às páginas alteradas.
- Produção continua inalterada neste checkpoint.

### Próximo passo exato

Executar a suíte restante em lotes, publicar a branch remota, abrir PR e aplicar as migrações aditivas somente após preflight/backup do Supabase.
