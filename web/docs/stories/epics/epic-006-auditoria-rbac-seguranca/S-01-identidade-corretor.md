# S-01 — Etapa 2 (1/N): ciclo de identidade do corretor quebrado

**Status:** Done
**Contexto:** primeiro incremento da Etapa 2 (autenticação/sessões/RBAC) da auditoria
integral Prospecta ↔ Grupo Santa Fé (handoff Codex). Item mais estrutural e mais citado
do bloco "BLOQUEADORES CONFIRMADOS NO SANTA FÉ" — tratado primeiro porque RBAC/escopo de
recursos não fazem sentido se a própria identidade do usuário está quebrada.

## Problema confirmado

`Corretor` (perfil de negócio: CRECI, leads, comissões, imóveis) e `Usuario` (login:
e-mail/senha/papel) eram **duas tabelas completamente independentes**, sem nenhuma FK
entre elas — vinculadas apenas por um match frágil de `email` em `src/auth.ts`.

- `criarCorretor` (`/admin/corretores/novo`) criava **só** um `Corretor`. O formulário
  tem um campo "Senha de Acesso" rotulado *"Senha para login do corretor"*, mas esse
  valor era gravado em `corretores.senhaAcesso` — um campo que `src/auth.ts` **nunca
  lia**. Um corretor cadastrado por essa tela não conseguia logar de jeito nenhum.
- `criarUsuario` (`/admin/configuracoes` → Novo Usuário) criava **só** um `Usuario`.
  Esse formulário não coleta CRECI, então mesmo escolhendo papel="corretor" não dava
  para criar um perfil de negócio funcional.
- A única forma de um corretor funcionar (login + perfil) era um admin criar os dois
  registros manualmente, em telas diferentes, com o mesmo e-mail — sem nenhuma
  orientação da UI sobre essa dependência.
- **Confirmado em produção** (Supabase, projeto `grupo-santa-fe`): dos 3 registros em
  `corretores`, **nenhum** tem um `Usuario` com papel="corretor" correspondente. Os 3
  corretores cadastrados hoje não conseguem logar.
- Achado adicional (não estava no handoff): `criarCorretor` e `editarCorretor` só
  checavam `if (!session)`, sem checar papel admin — qualquer usuário autenticado podia
  chamar essas actions diretamente.
- Achado adicional: a proteção contra excluir/desativar o último administrador ativo
  existia **só como `disabled` no botão do cliente** — nenhuma guarda no servidor.

## Correção implementada

- **Schema**: `Corretor.usuarioId String? @unique` com FK para `Usuario.id`
  (`ON DELETE SET NULL`). Substitui o match por e-mail como fonte de verdade do
  vínculo. Nenhuma coluna existente alterada.
- **`criarCorretor`**: agora cria `Usuario` (papel="corretor") e `Corretor` **na mesma
  transação Prisma**, vinculados por `usuarioId`. Senha de acesso passou a ser
  obrigatória (mín. 6 caracteres) — é o que efetivamente vira o login. Checa
  duplicidade de e-mail em `Usuario` e `Corretor`. Ganhou `requireActionRole(admin)`.
- **`criarUsuario`**: passou a rejeitar `papel="corretor"` com uma mensagem explícita
  direcionando para a tela correta — evita recriar o bug de identidade pela metade
  (login sem perfil de negócio).
- **`editarCorretor`**: ganhou `requireActionRole(admin)`; ao editar o e-mail do
  corretor, sincroniza o e-mail do `Usuario` vinculado na mesma transação.
- **`excluirCorretor`**: exclui também o `Usuario` vinculado — um corretor excluído não
  deveria manter acesso de login.
- **`src/auth.ts`**: resolve `corretorId` da sessão via FK (`usuarioId`), não mais por
  match de e-mail.
- **Lockout administrativo**: `alternarAtivo`/`excluirUsuario` agora bloqueiam no
  servidor (não só na UI) desativar/excluir o último administrador ativo. Cliente
  (`usuarios-client.tsx`) atualizado para exibir o erro retornado em vez de assumir
  sucesso sempre.

## Pendência operacional real (registrada, não inventada)

Os 3 corretores já cadastrados em produção continuam sem `usuarioId` vinculado (não há
como inferir automaticamente as credenciais que eles deveriam usar). Esta correção
impede que o problema **piore** para novos cadastros, mas não recupera retroativamente
o acesso dos 3 já existentes — isso exige uma decisão do dono do produto (recriar as
credenciais deles, ou uma ferramenta futura de "vincular corretor existente a um
usuário"), fora do escopo desta correção estrutural.

## Migração — validada e aplicada

- Testada via `BEGIN; ...DDL...; SELECT verificação; ROLLBACK;` em uma única chamada
  contra o banco real do Supabase (branch de desenvolvimento via `create_branch` não
  ficou disponível — duas tentativas expiraram em timeout sem criar a branch; a
  validação por transação com rollback foi usada como alternativa segura, já que
  Postgres reverte DDL dentro de transação).
- Aplicada via `apply_migration` (mecanismo já usado nas migrações anteriores deste
  projeto — não existe tabela `_prisma_migrations`, o histórico é todo mantido pelo
  Supabase). Confirmado via `information_schema.columns` que a coluna foi criada e
  nenhuma coluna existente foi alterada.
- Arquivo `prisma/migrations/20260915194104_corretor_usuario_link/migration.sql`
  adicionado ao repositório para manter o schema local em sincronia com o banco.

## Gates

- `npx tsc --noEmit`: zero erros.
- `npx eslint .`: 39 problemas (17 erros, 22 avisos) — **idênticos antes e depois** da
  mudança (confirmado via `git stash`/`git stash pop`), nenhum nos arquivos alterados.
  Lint completo do repositório já estava quebrado antes desta entrega (mesma limitação
  já documentada no handoff original).
- `npx vitest run`: 31 arquivos, **288 testes aprovados** (13 novos:
  `admin-guard.test.ts` e `corretor-validacao.test.ts`, cobrindo a lógica de bloqueio de
  lockout administrativo e a validação do cadastro de corretor).
- `npx prisma generate`: schema válido, client gerado sem erros.
- `git diff --check`: aprovado.

**Não testado nesta sessão:** build completo do Next.js (`npm run build`) — a
pré-renderização de páginas que consultam o banco no build exige uma `DATABASE_URL`
válida, que não está disponível neste sandbox (mesma limitação já documentada no
handoff original: "Prisma ECONNREFUSED durante prerenderização"). A migração foi
validada e aplicada diretamente no Postgres de produção via MCP do Supabase, então o
schema do banco está correto; o que falta validar é especificamente o processo de
build do Next.js, que depende de acesso de rede que este ambiente não tem.

## Encerramento — merge e deploy confirmados

- PR #121 mesclado via squash em `main` (commit `39c6b83b2cd9594c1b46cad76b74ba39c3b4d8f8`).
- Deploy de produção confirmado `READY` (deployment `dpl_4VG3MisMe2mC8ynom3o1QocAwdTL`,
  projeto `grupo-santa-f`, alvo `production`, alias `gruposantafee.com.br` /
  `grupo-santa-f.vercel.app`).
- `mcp__Vercel__get_runtime_errors` (janela de 24h): nenhum erro de runtime encontrado.

## Grupo Santa Fé × Prospecta

Não se aplica paridade aqui — Prospecta não tem um conceito equivalente de "duas
tabelas de identidade desconectadas" para corretores (o modelo de usuários do Prospecta
já é único). Este é um problema estrutural específico do schema do Santa Fé.
