# Story S-04 — Portal do Cliente: Dados Reais
**Epic:** EPIC-002
**Status:** Ready
**Agent:** @dev

## Contexto

O portal do cliente (`/portal`) usa dados completamente mockados (arquivo `lib/data/portal.ts`). Precisa ser substituído por dados reais do banco, respeitando isolamento: cada cliente vê apenas seus próprios dados.

A chave de ligação é: `Lead.email === session.user.email` (ou `session.user.leadId` após extensão do auth).

## Acceptance Criteria

- [ ] AC-01: `auth.ts` extende token JWT com `leadId` (ID do Lead cujo email coincide com o email do usuário, quando `role === "cliente"`)
- [ ] AC-02: `src/lib/types/next-auth.d.ts` declara `leadId` nas interfaces `Session` e `JWT`
- [ ] AC-03: `/portal` (dashboard) mostra nome real do cliente via `session.user.name` (não hardcoded)
- [ ] AC-04: `/portal` mostra serviço real do lead (campo `servico` do Lead) e imóvel de interesse (se vinculado)
- [ ] AC-05: `/portal/visitas` lista visitas reais vinculadas ao `leadId` do cliente
- [ ] AC-06: `/portal/acompanhamento` lista interações reais do lead em ordem cronológica decrescente
- [ ] AC-07: `/portal/documentos` lista documentos enviados para o lead (se módulo de docs for aplicável) — ou exibe mensagem "Nenhum documento ainda" se não houver
- [ ] AC-08: Se `leadId` for `undefined` (cliente sem Lead cadastrado), portal exibe estado vazio gracioso (não 500)
- [ ] AC-09: Nenhuma query usa dados sem filtro por `leadId` — sem `findMany` sem `where`
- [ ] AC-10: Arquivo `web/src/lib/data/portal.ts` (mock) pode ser mantido mas não usado pelas pages de produção

## Tasks

- [ ] Editar `web/src/auth.ts` — adicionar lookup de `leadId` no callback `jwt`
- [ ] Criar `web/src/lib/types/next-auth.d.ts` — declarar campos customizados na sessão
- [ ] Criar `web/src/lib/data/portal-real.ts` — funções de query reais (`getPortalDashboard(leadId)`, `getPortalVisitas(leadId)`, `getPortalInteracoes(leadId)`)
- [ ] Reescrever `web/src/app/portal/page.tsx` como Server Component usando dados reais
- [ ] Reescrever `web/src/app/portal/visitas/page.tsx` como Server Component
- [ ] Reescrever `web/src/app/portal/acompanhamento/page.tsx` como Server Component
- [ ] Reescrever `web/src/app/portal/documentos/page.tsx` — exibir estado vazio se sem dados

## File List

- `web/src/auth.ts` (modificar)
- `web/src/lib/types/next-auth.d.ts` (novo)
- `web/src/lib/data/portal-real.ts` (novo)
- `web/src/app/portal/page.tsx` (reescrever)
- `web/src/app/portal/visitas/page.tsx` (reescrever)
- `web/src/app/portal/acompanhamento/page.tsx` (reescrever)
- `web/src/app/portal/documentos/page.tsx` (reescrever)
