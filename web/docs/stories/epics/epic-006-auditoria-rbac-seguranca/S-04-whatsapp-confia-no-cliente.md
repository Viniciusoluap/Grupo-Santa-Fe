# S-04 — Etapa 2 (4/N): WhatsApp confiava em dados enviados pelo cliente

**Status:** Done
**Contexto:** quarto incremento da Etapa 2 (autenticação/sessões/RBAC) da auditoria
integral Prospecta ↔ Grupo Santa Fé (handoff Codex). Cobre o item "WhatsApp trusting
client-supplied recipient/leadId without validating the corretor's ownership of that
lead" do bloco "BLOQUEADORES CONFIRMADOS NO SANTA FÉ".

## Problema confirmado

1. **`src/app/api/whatsapp/enviar/route.ts` — envio confiava 100% no corpo da
   requisição.** `destinatarios` (array `{id, nome, telefone, leadId}`) vinha
   diretamente do `req.json()` e era usado sem nenhuma validação contra o banco: o
   `telefone` ia direto para a API oficial/paga do WhatsApp Business da empresa, e o
   `leadId` era gravado no histórico (`mensagemWhatsapp`) como se fosse verdadeiro. Na
   prática, qualquer usuário não-cliente (inclusive corretor) podia:
   - Enviar mensagem para **qualquer número de telefone**, sem esse número precisar
     corresponder a um lead real — usando a conexão Business oficial da empresa (risco
     de abuso/spam que pode levar ao banimento do número pela Meta).
   - Atribuir a mensagem a um **`leadId` de outro corretor** (ou um `leadId`
     inexistente), corrompendo o histórico de atendimento.
   - Um corretor podia mensagear leads que não são dele — a página já filtrava
     `leads` por `corretorId` no carregamento (`page.tsx`), mas isso é só a lista que
     a UI mostra; a rota de envio em si não repetia essa checagem.
2. **`src/lib/actions/whatsapp.ts`, `salvarConexaoBusiness` — aceitava um `usuarioId`
   vindo do cliente.** A action só checava `if (!session)`, nunca se o `usuarioId`
   recebido era o do próprio usuário logado. A UI só chama essa action com o próprio
   ID (confirmado em `whatsapp-client.tsx`), mas isso é uma garantia só do lado do
   cliente — uma Server Action do Next.js pode ser invocada diretamente. Um usuário
   malicioso podia sobrescrever o token/número da conexão Business de **qualquer outro
   usuário**, inclusive um admin.

## Correção implementada

- **`src/app/api/whatsapp/enviar/route.ts`**: cada `leadId` recebido é buscado no
  banco (`prisma.lead.findMany`); um destinatário só é aceito se o lead existir e,
  para `role === "corretor"`, se `lead.corretorId` bater com o corretor da sessão.
  `telefone`/`nome` usados no envio real e no histórico agora vêm sempre do lead
  encontrado no banco, nunca do corpo da requisição. Requisição sem nenhum
  destinatário válido retorna 400 em vez de silenciosamente enviar zero mensagens.
- **`src/lib/whatsapp/validacao.ts`** (novo): função pura `filtrarDestinatariosValidos`
  extraída da rota para ser testável sem banco.
- **`src/lib/actions/whatsapp.ts`**: `salvarConexaoBusiness` ignora o `usuarioId`
  recebido como parâmetro e usa `session.user.id` — o parâmetro fica só por
  compatibilidade de assinatura com a chamada existente no client component (que já
  só passava o próprio ID).

## Grupo Santa Fé × Prospecta

**Investigado e descartado como já correto.** `server/whatsapp-router.ts` (Prospecta):
- `salvarConexao` já deriva `userId` de `ctx.user.id` (tRPC context), nunca de um
  parâmetro do cliente — não tem o bug do item 2 acima.
- `enviar` é `adminProcedure` (só admin envia WhatsApp no Prospecta — não existe
  envio por corretor nesta plataforma). Como só o papel mais privilegiado pode chamar
  essa mutation, o vetor "corretor mensageia lead de outro corretor" não existe
  estruturalmente aqui; a diferença de escopo (quem pode enviar) é uma divergência de
  produto pré-existente, não uma falha de autorização a corrigir — nenhuma mudança
  proposta para não inventar uma capacidade nova (envio por corretor) fora do escopo
  desta auditoria de segurança.

## Gates

- `npx tsc --noEmit`: zero erros.
- `npx vitest run`: 32 arquivos, **299 testes aprovados** (6 novos em
  `whatsapp-validacao.test.ts`, cobrindo: lead próprio aceito, lead de outro corretor
  rejeitado, leadId inexistente rejeitado, destinatário sem leadId rejeitado,
  admin/colaborador podem mensagear qualquer lead encontrado, telefone/nome sempre
  vêm do lead do banco).
- `npx eslint .`: 39 problemas (17 erros, 22 avisos) — idênticos antes e depois,
  nenhum nos arquivos alterados.
- `git diff --check`: aprovado.
- Sem migração de banco nesta entrega (mudança é só de validação em código).

**Não testado nesta sessão:** envio real de mensagem via API do WhatsApp Business
(exigiria credenciais reais e `DATABASE_URL`, indisponíveis neste sandbox). A lógica
de filtragem está coberta por teste unitário; a integração com `prisma.lead.findMany`
foi revisada linha a linha.

## Encerramento — merge e deploy confirmados

- PR #126 mesclado via squash em `main` (commit `655ac63b53b2ee327ce9912b58f500c07b459bb4`).
- Deploy de produção confirmado `READY` (deployment `dpl_HjK26f2XCLECqa5iphNHKkG5ELBJ`,
  projeto `grupo-santa-f`, alvo `production`, alias `gruposantafee.com.br` /
  `grupo-santa-f.vercel.app`).
- `mcp__Vercel__get_runtime_errors` (janela de 24h): nenhum erro de runtime encontrado.
