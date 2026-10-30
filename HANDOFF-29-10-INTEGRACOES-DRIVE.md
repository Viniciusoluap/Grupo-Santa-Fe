# Integrações e gestão de usuários — 29/10/2026

## Etapa 1 — levantamento
- Branch: `codex/integracoes-drive-20261030`, criada a partir da main publicada.
- Escopo: concentrar o Google Drive em Integrações e remover sua configuração e o atalho dessa integração de Usuários e acesso.
- Reutilizar o card existente, preservar credenciais, permissões administrativas e operações; ajustar retorno OAuth e orientações para a nova tela.
- Paridade funcional entre as duas aplicações; sem alterações em dados ou credenciais.

## Verificação
(a) Automáticos: levantamento de rotas, componentes e retornos existente; implementação ainda pendente.
(b) Manuais: não executados nesta etapa.
(c) Produção: pendente após publicação.

## Próximo passo
Publicar este checkpoint, implementar a movimentação, validar tipos e verificações pertinentes, revisar e publicar.

## Etapa 2 — implementação e verificação local
- ADAPT: mover a montagem do card existente para Integrações sem duplicar sua lógica; em Santa Fé, o arquivo também foi movido para a pasta de Integrações.
- ADAPT: remover o atalho de Integrações da página de usuários/configurações; atualizar títulos e orientações.
- ADAPT: o retorno OAuth (sucesso/erro), as orientações de erro e a invalidação de página apontam para Integrações.
- Operações e controles administrativos existentes preservados, inclusive conectar, JSON OAuth, testar, desconectar e organizar o Drive. Não houve alteração de dados, credenciais ou callback cadastrado no provedor.
- Santa Fé: `maxDuration = 60` transferido com o card, para manter o prazo da organização manual via Server Action; dados da empresa e preferências legadas preservados.
- AIOX: definições dev disponíveis lidas. Núcleo de tarefas e CodeRabbit CLI indisponíveis; revisão direta, verificações reais e QA independente utilizados sem alegar execução dos recursos ausentes.

### Testes
(a) Automáticos: TypeScript `tsc --noEmit` passou em ambos; testes existentes de erros do Drive e OAuth passaram (22/22 em cada aplicação); `git diff --check` passou. ESLint focado passou no Santa Fé. Prospecta não define script de lint.
(b) Manuais: revisão do diff e das referências de navegação, permissões e componentes, com checklist React. Navegador ainda pendente.
(c) Produção: aguardando QA, publicação e validação de navegação; não executadas reconexão nem organização real nesta correção de localização.

### Arquivos principais
- `web/src/app/admin/configuracoes/page.tsx`, `web/src/app/admin/integracoes/page.tsx`, `web/src/app/admin/integracoes/_components/google-drive-card.tsx` (movido)
- `web/src/app/api/google-drive/{conectar,callback}/route.ts`, `web/src/lib/google-drive-retorno.ts`, `google-drive-conexao.ts`, `drive-erro.ts`, `actions/google-drive.ts`, `__tests__/drive-erro.test.ts`

### Próximo passo
Concluir QA independente, publicar a etapa e abrir PRs; validar builds, merge e deploy, depois verificar a localização das telas em produção sem modificar a conexão do Drive.

## Etapa 3 — revisão e merge
- QA independente aprovado; testes existentes 22/22 por aplicação e revisão automática Codex concluída sem apontamentos nos heads publicados.
- PR #244 mesclada; commit de merge: `88bf83d1a320e7932672fa789c8241dd89939590`.
- Preview `dpl_D5iyqi9wKZTB1eQDJpD6MyPPTcDV` confirmado READY antes do merge. O status GitHub do Prospecta ainda estava pending por atraso de sincronização, mas o deployment correspondente ao head exato estava READY na API Vercel.
- Build de produção iniciado: `dpl_4nLD7Pc7kiQ2n8gjVnXmZ9Jca7vH`.
(a) Automáticos: checks locais descritos acima e build de preview aprovados.
(b) Manuais: revisão de código concluída; navegação de produção pendente.
(c) Produção: aguardando READY e smoke; nenhuma operação real do Drive executada.
- Próximo passo: conferir produção READY e aliases oficiais, executar smoke e verificar a organização das telas sem alterar a conexão.
