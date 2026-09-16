# S-06 — Etapa 3: rotas órfãs de WhatsApp (uma delas com IDOR)

**Status:** Done
**Contexto:** segundo incremento da Etapa 3 (adapter/webhooks/integrações) da auditoria
integral Prospecta ↔ Grupo Santa Fé, continuação direta do achado da S-05 (rota órfã
`upload-doc`, PR #130) — mesma classe de problema, módulo diferente.

## Problema confirmado

Duas rotas em `src/app/api/whatsapp/` não são chamadas por nenhum código do
repositório (confirmado via grep em `src/` — o app real usa apenas `enviar` e
`desconectar`, ambas com chamadas `fetch()` localizadas em `whatsapp-client.tsx`):

- **`/api/whatsapp/status/route.ts`** — aceitava um `usuarioId` arbitrário via query
  string (`req.nextUrl.searchParams.get("usuarioId")`) de **qualquer usuário
  autenticado**, sem checar papel nem posse, e devolvia o status de conexão e o
  **número de telefone vinculado** desse outro usuário. Um IDOR clássico: qualquer
  corretor ou colaborador logado que soubesse/adivinhasse o `usuarioId` de outro
  usuário (ex.: de outro corretor) conseguiria consultar se o WhatsApp dele está
  conectado e qual número está vinculado — informação que hoje só é exposta,
  corretamente, ao admin (`page.tsx` monta `conexoesCorretores` no servidor, escopado
  por papel).
- **`/api/whatsapp/conectar/route.ts`** — stub morto: sempre retorna 400 pedindo para
  usar a aba de Conexão. Não representa risco por si só, mas é código morto sem
  motivo para permanecer.

**Por que ninguém percebeu antes**: o fluxo real de status de conexão é resolvido
inteiramente no servidor em `src/app/admin/whatsapp/page.tsx` (Server Component),
que já escopa corretamente por papel — admin vê a própria conexão e a de todos os
corretores; corretor e colaborador veem só a própria (ou a do admin, no caso do
colaborador). As duas rotas API nunca fizeram parte desse fluxo; provavelmente
sobras de uma versão anterior client-side da tela.

**Impacto real**: como as rotas são órfãs, não há exploração através do app hoje —
mas ambas ficavam publicamente acessíveis via URL direta a qualquer requisição
autenticada (nenhuma proteção de "rota não usada" existe em Next.js — todo arquivo
`route.ts` sob `app/api` é um endpoint real e alcançável).

## Correção implementada

- Removidas as duas rotas (`git rm`). Nada no app deixa de funcionar — confirmado via
  grep que nenhuma chamada `fetch("/api/whatsapp/status"...)` ou
  `fetch("/api/whatsapp/conectar"...)` existe em `src/`.

## Gates

- `npx tsc --noEmit`: zero erros.
- `npx vitest run`: nenhuma regressão esperada (rotas não tinham teste próprio;
  nenhum teste referenciava os paths removidos).
- `npx eslint src/app/api/whatsapp`: zero problemas.
- Sem migração de banco nesta entrega.

## Grupo Santa Fé × Prospecta

Investigado como parte da varredura mais ampla da Etapa 3. O Prospecta usa
`server/whatsapp-router.ts` (tRPC) — não tem rotas REST equivalentes a
`status`/`conectar`; o padrão do Prospecta é inteiramente via `protectedProcedure`/
`adminProcedure`, com `conexaoParaPapel(ctx.user.id, ctx.user.role)` sempre derivando
o usuário do contexto autenticado (`ctx.user`), nunca de um parâmetro livre vindo do
cliente. Confirmado que a classe de bug (aceitar um id de usuário arbitrário sem
checar posse) não existe lá. Nenhuma pendência a registrar no ROADMAP do Prospecta.

## Outros achados da varredura Etapa 3 (sem ação necessária)

- **Prospecta `_core/stripeWebhook.ts`**: webhook Stripe com assinatura verificada
  corretamente (`stripe.webhooks.constructEvent`), mas a integração está
  explicitamente desabilitada em código (retorna 410, loga o evento e não altera
  nenhum saldo) — decisão já tomada na Etapa 1 desta auditoria, documentada no
  próprio arquivo. Nenhuma ação necessária.
- **Prospecta `_core/pluggy.ts`**: cliente REST de saída para a API da Pluggy (Open
  Finance) — não é um webhook recebido, não há assinatura a verificar. Nenhum
  problema encontrado.
- **Prospecta `_core/whatsapp-business.ts`**: confirmado uso real da API oficial do
  WhatsApp Cloud (Meta) via `graph.facebook.com/v18.0/...` — mesmo modelo do Grupo
  Santa Fé (`salvarConexaoBusiness`, já corrigido na Etapa 2/C4). Nenhuma divergência
  de paridade encontrada.
- **"Prisma-preview build" (item original do handoff)**: `prisma/schema.prisma` não
  usa `previewFeatures` nem `directUrl`/shadow database — o `generator`/`datasource`
  são simples. O build (`prisma generate && next build`) não roda `prisma migrate
  deploy` nem `db push` — migrações continuam sendo aplicadas manualmente via MCP
  (mesmo padrão usado o tempo todo nesta auditoria). Não foi encontrada nenhuma
  configuração de banco de dados separado para Preview Deployments da Vercel: o
  mesmo `DATABASE_URL` de produção parece ser usado também em deployments de preview
  (branches/PRs), o que significa que uma Preview Deployment de um PR aberto roda
  contra o banco de produção real. Isto **não foi corrigido nesta entrega** — é uma
  mudança de infraestrutura (configurar um banco de preview separado no painel da
  Vercel/Supabase) que este ambiente não pode fazer via código/MCP, e está fora do
  escopo pontual desta story. Registrado aqui como pendência a ser avaliada
  separadamente pelo dono do produto, na mesma linha da pendência de Blob público da
  S-05: um passo manual real, não uma correção de código.
