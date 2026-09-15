# S-03 — Etapa 2 (3/N): redefinição de senha não revoga sessões existentes

**Status:** Done
**Contexto:** terceiro incremento da Etapa 2 (autenticação/sessões/RBAC) da auditoria
integral Prospecta ↔ Grupo Santa Fé (handoff Codex). Cobre o item "password reset
session revocation" do bloco "BLOQUEADORES CONFIRMADOS NO SANTA FÉ".

## Problema confirmado

`src/auth.ts` usa `session: { strategy: "jwt" }` (NextAuth v5). Estratégia JWT não tem
estado no servidor por padrão: o callback `jwt()` só recebia o parâmetro `user` (e
gravava os claims no token) no momento do login — em toda chamada subsequente
(`trigger` sem `user`), o token existente era devolvido sem nenhuma revalidação contra
o banco.

Consequência verificada diretamente no código (não apenas aceita do handoff): se um
admin usa `redefinirSenha` (`src/lib/actions/usuarios.ts`) para trocar a senha de um
usuário — por exemplo, após suspeitar de acesso indevido — **qualquer sessão JWT já
emitida para aquele usuário continua válida normalmente**, já que só a senha no banco
muda; nada invalida o token que já está no cookie de quem quer que o tenha. O mesmo
valia para desativação de conta (`alternarAtivo`): um usuário desativado com uma sessão
já aberta continuava com acesso total até o token expirar (30 dias, padrão do NextAuth),
mesmo não conseguindo mais fazer um novo login.

## Correção implementada

- **`prisma/schema.prisma`**: `Usuario.sessionVersion Int @default(0)` — contador
  incrementado a cada evento que deve invalidar sessões existentes.
- **`src/lib/auth/admin-guard.ts`**: nova função pura `sessaoAindaValida(usuarioAtual,
  sessionVersionDoToken)` — `false` se o usuário não existe mais, está inativo, ou a
  versão do token diverge da versão atual no banco. Extraída para ser testável sem
  depender do NextAuth (mesmo padrão de `deveBloquearDesativacaoUltimoAdmin`).
- **`src/auth.ts`**:
  - `authorize()` agora inclui `sessionVersion` no usuário retornado no login.
  - Callback `jwt()`: no login (`user` presente), grava `token.sessionVersion`. Em
    qualquer chamada subsequente, busca `{ ativo, sessionVersion }` do usuário no banco
    e chama `sessaoAindaValida`; se inválida, **retorna `null`** — mecanismo suportado
    pelo NextAuth para invalidar o token (o próximo `auth()` passa a ver a sessão como
    inexistente, equivalente a logout forçado). Isso também fecha, de graça, o caso de
    desativação de conta com sessão já aberta (mesma checagem de `ativo`).
- **`src/lib/actions/usuarios.ts`**: `redefinirSenha` agora incrementa
  `sessionVersion` (`{ increment: 1 }`) na mesma escrita que troca o hash da senha.
- **`src/lib/types/next-auth.d.ts`**: `sessionVersion?: number` adicionado à
  augmentação de `JWT` em `next-auth/jwt`.

**Não há fluxo de autoatendimento de troca de senha nesta base de código** (busca por
`senha` em `src/app/admin` confirma: só `redefinirSenha`, exclusivo de admin) — não há
um segundo ponto a instrumentar.

## Migração — validada e aplicada

- Testada via `BEGIN; ALTER TABLE ... ADD COLUMN; SELECT verificação; ROLLBACK;` contra
  o banco real do Supabase (`giulchozonhzyopmgmkv`, produção) — confirmado que a coluna
  seria criada com `DEFAULT 0` e que as 2 linhas existentes em `usuarios` receberiam o
  valor `0` corretamente; confirmado via `information_schema.columns` que a coluna não
  existia mais após o `ROLLBACK` (prova de que a reversão funcionou).
- Aplicada via `apply_migration` (`giulchozonhzyopmgmkv`, mesmo mecanismo das migrações
  anteriores deste projeto). Confirmado via `information_schema.columns` que a coluna
  `sessionVersion` (integer, default `0`) existe em produção.
- Arquivo `prisma/migrations/20260915203000_usuario_session_version/migration.sql`
  adicionado ao repositório.
- Puramente aditiva — nenhuma coluna existente alterada, nenhum dado de usuário lido
  além da contagem de linhas para confirmar o backfill do default.

## Gates

- `npx prisma generate`: schema válido, client gerado sem erros.
- `npx tsc --noEmit`: zero erros.
- `npx vitest run`: 31 arquivos, **293 testes aprovados** (5 novos em
  `admin-guard.test.ts`, cobrindo `sessaoAindaValida`: versão batendo, versão
  divergente, usuário inativo, usuário inexistente, token sem `sessionVersion`).
- `npx eslint .`: 39 problemas (17 erros, 22 avisos) — idênticos antes e depois, nenhum
  nos arquivos alterados.
- `git diff --check`: aprovado.

**Não testado nesta sessão:** o fluxo de login/logout/troca-de-senha de ponta a ponta
em um navegador real (exigiria `DATABASE_URL` e um servidor Next.js rodando, ambos
indisponíveis neste sandbox — mesma limitação documentada nos checkpoints anteriores).
A lógica de decisão (`sessaoAindaValida`) está coberta por teste unitário; a integração
com o callback `jwt()` do NextAuth foi revisada linha a linha contra a documentação
oficial (retornar `null` do callback `jwt` é o mecanismo documentado do Auth.js para
invalidar um token — confirmado no arquivo de tipos `@auth/core/src/index.ts`,
`jwt?: (...) => Awaitable<JWT | null>`), mas não roda um teste de integração real.

## Grupo Santa Fé × Prospecta

**Paridade aplicada, não descartada.** Verificação direta no código do Prospecta
(`server/_core/auth-utils.ts`) mostrou que ele **também** usa JWT stateless
(`jsonwebtoken`, 30 dias), sem nenhuma versão de revogação — a mesma classe de
vulnerabilidade, não uma exclusividade do Santa Fé. Corrigido em paralelo nesta mesma
sessão: `users.sessionVersion` no schema Drizzle, embutido no JWT
(`createSessionToken`/`verifySessionToken`), validado em `createContext` (que já
recarregava o usuário do banco a cada requisição), e incrementado em `resetPassword`
(`configuracoes-router.ts`) e em `admin.provisionAccess` (`portal-router.ts`). Migração
aditiva validada e aplicada em produção (Neon, `plain-cake-26372935`). Ver
`Prospecta/docs/stories/epics/epic-013-auditoria-pagamentos-seguranca/CHECKPOINT-ETAPA-2-sessao.md`.
