# HANDOFF 26/10 — AIOX, 16 correções

## Retomada após limite dos agentes — 27/10/2026, entrega controlada

- Trabalho interrompido recuperado dos worktrees e protegido em commits: Prospecta 038f8f3 e Santa Fé cb9647c; integrados na branch de trabalho.
- Recebimentos parciais implementados com chave idempotente, limite do saldo, histórico e quitação apenas no total. Testes adicionais: Prospecta arquivo BPO 12/12; Santa Fé 5/5 testes de baixas. TypeScript Santa Fé aprovado.
- Prospecta: transações interativas agora usam sessão Neon WebSocket nativa do Node 24, preservando consultas e batch HTTP existentes. Teste real SELECT 1/transação e rollback aprovados sem alterações de dados.
- Migrações de produção já aplicadas: Prospecta 0077–0082; Santa Fé projeto_documentos, identificador Pluggy, auditoria BPO, índice CRM sem exclusão, templates e vínculos operacionais.
- Revisão automática rejeitou a antiga migração CRM por conter exclusões; alternativa aditiva aplicada com sucesso, sem apagar clientes nem reescrever vínculos. Coluna histórica servicos preservada.
- Backups aiox_backup_20261027 preservados. Registros bancários legados com origem não comprovada protegidos como legado.
- Ainda aplicar: Prospecta 0083 e Santa Fé 20261027150000 (recebimentos parciais), após publicação deste checkpoint.
- Pendências reais: build remoto dos últimos ajustes, PR/merge, deploy produção e smoke. Validação de dispositivos físicos iPhone/Android/PWA não realizada nesta sessão; não declarar aceite físico.

## Pré-entrega autorizada — 27/10/2026

- Autorização reiterada pelo proprietário para concluir, migrar, merge e deploy.
- Suíte completa em lotes: Prospecta 147 arquivos/1.093 testes aprovados; Santa Fé 115 arquivos/829 testes aprovados (arquivos de banco real separados não executados nessa rodada). Logs locais temporários em /tmp; contagens registradas aqui para continuidade.
- As duas prévias Vercel estavam READY nos commits remotos 532e6e7 (Prospecta) e 4c636a6 (Santa Fé).
- Estrutura real dos bancos consultada por conectores; migrações iniciais validadas em PGlite sobre cópia do schema real.
- Neon recusou nova branch e snapshot por limites do plano; nenhum recurso de outro agente foi removido.
- Backup lógico pré-migração criado em schema privado aiox_backup_20261027 nos dois bancos: lançamentos, clientes e revisões. Prospecta: 1.011 lançamentos, zero clientes; Santa Fé: 5 lançamentos, zero clientes.
- Restauração: tabelas de backup mantêm os valores anteriores; realizar recuperação seletiva por ID após inspeção, nunca substituir integralmente dados novos.
- Diagnóstico Pluggy real: autenticação 200; endpoint legado 410 ENDPOINT_DEPRECATED; v2 200, sem transações; item UPDATED/SUCCESS. Não declarar importação de movimentações sem registros retornados.
- Integrações finais BPO/WhatsApp/Projetos em revisão; migrações novas, testes finais e smoke autenticado ainda pendentes. Merge/deploy do lote ainda não realizados.

## Revisão de aceite WhatsApp/Projetos — 27/10/2026

- Repositório: Grupo Santa Fé; branch isolada `codex/aiox-whatsapp-projects-acceptance`, base HEAD da branch principal de trabalho publicada.
- Objetivo desta etapa: fechar lacunas 03/05/06 encontradas na revisão estática e manter paridade.
- Corrigido: serviços não são mais inferidos automaticamente do cadastro ao montar o envio; a seleção explícita prevalece e a ausência bloqueia a variável.
- Corrigido: campos de dia/horário permanecem visíveis e editáveis após preenchimento. PDF abre em visualizador com retorno; outros documentos têm diálogo e download em outra aba, preservando a montagem da conversa.
- Correção 01: restaurada a renderização de Conexões dos Corretores na aba Conexão; a página já carregava os mesmos registros, mas o componente ignorava a propriedade recebida.
- A rota de mídia agora entrega PDF como `application/pdf; inline`, mantendo sandbox e download forçado para HTML/SVG.
- Santa Fé: RLS habilitado em templates, sem acesso para anon/authenticated via Data API; uso exclusivamente via servidor autorizado.
- Correção 16: revisão estática confirmou reserva de versão e checklist derivado do status ativo após upload concluído. Validação real da disponibilidade no Drive e navegação em dispositivos depende de ambiente autenticado.
- Correção 16: PDF rejeitado no campo Editável para impedir dupla conclusão usando o mesmo documento PDF nos dois campos; quatro testes de documentos passaram novamente em cada sistema.
- (a) Automáticos: TypeScript aprovado em ambos; Prospecta 22 testes focados e Santa Fé 18 testes focados aprovados.
- (b) Manuais: revisão estática; nenhum navegador/dispositivo real usado nesta etapa.
- (c) Produção: nenhuma migração aplicada, nenhum deploy e nenhuma mensagem real enviada. Publicação remota será feita pelo agente principal após integração.
- Próximo passo exato: integrar o commit desta branch, publicar checkpoint e realizar smoke test autenticado dos documentos/templates.

## Recebimentos parciais — início 27/10/2026

Base `36eb490`, branch `codex/sf-bpo-links-final`. Em execução: baixas auditáveis/idempotentes, saldo restante e indicadores de caixa; DRE por competência mantém valor contratado sem criar receitas duplicadas. Migração adicional 20261027150000. Nenhum banco remoto alterado.

## Correções 13/15 — início 27/10

Branch isolada `codex/sf-bpo-links-final`, base `c69e361`. Confirmado erro de categoria operacional confundida com etapa de obra. Em execução: catálogo dos módulos reais, IDs persistentes, validação backend e seletores criar/editar, com categoria contábil independente. Nenhuma produção alterada.

### Conclusão técnica do lote BPO — 27/10/2026

- 13/15: categorias operacionais corretas para receita e despesa; catálogo dos módulos reais com busca e referência persistente; despesa de comissão seleciona Imóvel; obra possui tipo e etapa derivados da lista existente; criar/editar validam categoria, existência do registro e exclusividade de etapa/tipo; categoria contábil preservada separadamente. Link do lançamento para serviço e dentro do formulário.
- Criação usa `requestKey` única por formulário para proteger retry/duplo clique. Parcelas distintas são lançamentos distintos com referências operacionais compartilhadas.
- 14: sincronização serializada por lock do banco, atualização apenas de nome/documento/e-mail/telefone e vínculo CRM; reaproveitamento de avulso pelo documento normalizado; documentos ambíguos ou ligados a outro lead são reportados para revisão, sem duplicação nem substituição dos vínculos financeiros.
- 09: limpeza exige administrador, backup identifica autor, contagens são revalidadas, saldos da conta arquivada são zerados. Exclusão só para origem `extrato` comprovada; manual/legado/Asaas e qualquer vínculo operacional são preservados. `origemTransacaoKey` mantém identidade bancária ao desassociar, permitindo reanexar na reimportação sem duplicar o lançamento legítimo.
- Migração aditiva `20261027140000_bpo_vinculos_operacionais`: colunas de referência/tipo/requestKey/origem/chave bancária e índices únicos. Etapas legadas são mantidas; origem legada é explicitamente protegida, não inferida apenas pela conciliação.
- (a) Automáticos: Prisma generate e TypeScript aprovados; cinco arquivos focados/21 testes aprovados; migração aplicada duas vezes em PGlite preservou etapa legada e chave de origem; `git diff --check` aprovado.
- (b) Manuais: revisão de código/campos e contratos, sem teste de UI em navegador.
- (c) Produção: não aplicado; depende de integração do commit, migração com backup/preflight e testes reais. Limpeza de importações legadas ambíguas exige apuração da origem antes de reclassificá-las como extrato; o sistema preserva esses registros por segurança.
- Próximo passo: integrar este commit na branch principal de trabalho, publicar checkpoint remoto, aplicar migração de modo controlado e validar criar/editar/reimportar/limpar em ambiente seguro. A navegação reversa serviço → financeiro e validação de pagamentos parciais ainda requerem conferência global do responsável pela entrega.

## Validação real Pluggy/Cora — 27/10/2026

- Diagnóstico real somente leitura na conexão ativa do Prospecta: autenticação HTTP 200; endpoint legado /transactions HTTP 410, código ENDPOINT_DEPRECATED, instruindo usar /v2/transactions. Endpoint v2 HTTP 200, results vazio e next nulo; item HTTP 200, status UPDATED, execução SUCCESS, conector MeuPluggy. Não afirmar recuperação de movimentações: a conta não disponibilizou transações nesta leitura.
- Documentação oficial consultada: https://v2.docs.pluggy.ai/en/reference/transaction/transactions-list-by-cursor e https://v2.docs.pluggy.ai/en/reference/transaction/transactions-list .
- Corrigido parâmetro de data para dateFrom; cursor aceito somente no formato query string previsto na API; chave externa histórica t.id preservada para não duplicar ao trocar v1 por v2. providerId/providerCode permanecem em identificador bancário separado.
- OFX agora preserva FITID. Importação consulta tanto a chave bancária nova como a chave histórica calculada por atributos/ocorrência, usando a existente antes de inserir. Isso impede duplicação ao reimportar um OFX antigo após a melhoria da extração.
- Nenhuma credencial foi alterada e nenhuma movimentação foi gravada em produção nesta validação.
- Testes automáticos: Santa Fé: 2 arquivos/14 testes focados aprovados e TypeScript aprovado usando Prisma Client gerado existente.
- Próxima etapa: integrar os commits, aplicar migrações aditivas, publicar e testar a sincronização administrativa. Reconciliação de itens recriados com IDs diferentes continua dependente do identificador bancário disponibilizado pelo provedor.

## Publicação remota confirmada — 27/10/2026

- Branch: `codex/aiox-16-correcoes-20261026`.
- Checkpoint publicado: `4d8b190e60952d1dd5cf7f20a0205a8077dfb4a1`.
- HEAD local de origem preservado: `9004c0d7dae2d2ce24bbe597aeb81a98fa931fc7`.
- Publicação por conector GitHub em commit consolidado; a árvore remota foi comparada com a árvore local e é idêntica (`f98be4fa948e3eb849c1d64eeeeafb235de83c6d`).
- Todos os arquivos e Handoffs pendentes deste HEAD estão protegidos no GitHub. Os hashes dos commits locais originais não foram reescritos.
- Este checkpoint não representa merge, aplicação de migrações nem deploy. Pendências de validação permanecem registradas abaixo.

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
