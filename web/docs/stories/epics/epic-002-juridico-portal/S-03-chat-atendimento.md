# Story S-03 — Chat de Atendimento: Polling API + UI
**Epic:** EPIC-002
**Status:** Ready
**Agent:** @dev
**Depends on:** S-01

## Contexto

Clientes e corretores precisam se comunicar por texto dentro do sistema. Vercel serverless impede WebSockets — solução: polling a cada 4s com UI otimista.

## Acceptance Criteria

- [ ] AC-01: `GET /api/chat/[leadId]?after={iso-timestamp}` retorna array de mensagens mais novas que `after`; sem `after` retorna últimas 50
- [ ] AC-02: `POST /api/chat/[leadId]` aceita `{ texto: string }`, cria `ChatMensagem`, retorna mensagem criada
- [ ] AC-03: Autenticação em ambas as rotas: corretor acessa qualquer `leadId`; cliente acessa apenas próprio `leadId` (comparar com `session.user.leadId`)
- [ ] AC-04: Interface admin em `/admin/juridico` tem tab "Chat" mostrando lista de leads com mensagens e um painel de conversa ao selecionar lead
- [ ] AC-05: Painel de chat admin faz polling 4s, exibe mensagens novas sem reload
- [ ] AC-06: Interface cliente em `/portal/chat` mostra conversa com o corretor responsável
- [ ] AC-07: Portal chat faz polling 4s, exibe mensagens novas sem reload
- [ ] AC-08: Mensagens do cliente aparecem à direita (balão azul); mensagens do corretor à esquerda (balão cinza)
- [ ] AC-09: Campo de texto + botão Enviar; Enter envia mensagem
- [ ] AC-10: `setInterval` limpo no `useEffect` cleanup (sem memory leak)
- [ ] AC-11: Portal nav sidebar inclui link "Chat" com ícone `MessageSquare`

## Tasks

- [ ] Criar `web/src/app/api/chat/[leadId]/route.ts` (GET + POST)
- [ ] Criar `web/src/app/admin/juridico/_components/chat-admin.tsx` (client component)
- [ ] Atualizar `web/src/app/admin/juridico/page.tsx` — adicionar tab Chat
- [ ] Criar `web/src/app/portal/chat/page.tsx` (client component com polling)
- [ ] Atualizar `web/src/app/portal/layout.tsx` — adicionar item Chat na nav

## File List

- `web/src/app/api/chat/[leadId]/route.ts` (novo)
- `web/src/app/admin/juridico/_components/chat-admin.tsx` (novo)
- `web/src/app/admin/juridico/page.tsx` (modificar — adicionar tabs)
- `web/src/app/portal/chat/page.tsx` (novo)
- `web/src/app/portal/layout.tsx` (modificar — adicionar nav item)
