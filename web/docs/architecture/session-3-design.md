# Session 3 Architecture — RBAC Granular + Automated Tests

**Date:** 2026-06-29  
**Architect:** @architect (Aria)  
**Status:** APPROVED

---

## Context

After Session 2 (Jurídico, Chat, Portal, Relatórios), the system has a critical security gap: the admin layout only prevents `cliente` from accessing `/admin/*`, but any authenticated user (corretor, colaborador) can access all admin modules including financial data, user management, and system settings. This is M-02 from the Session 1 security audit.

Additionally, there are zero automated tests. The build pipeline has no safety net for regressions.

---

## ADR-6: RBAC Helper via Thin Wrapper (not Middleware)

**Decision:** Implement RBAC via a thin `rbac.ts` helper called in individual Server Components and Server Actions — not via Next.js `middleware.ts`.

**Rationale:**
- `middleware.ts` cannot access Prisma (Edge Runtime restriction)
- JWT already carries `role` — RBAC check is synchronous after `auth()` is called
- Per-page/action granularity is easier to maintain than route patterns in middleware
- Consistent pattern with existing `if (!session) throw new Error("Não autorizado")` style

**Consequence:** Each protected page/action must call `requireRole()`; there is no single enforcement choke point. This is acceptable for a system of this size (~20 admin routes).

---

## ADR-7: RBAC Role Matrix

Roles: `admin`, `corretor`, `colaborador`, `cliente`

| Module | admin | corretor | colaborador | cliente |
|--------|-------|----------|-------------|---------|
| `/admin/configuracoes` | ✅ | ❌ | ❌ | ❌ (→portal) |
| `/admin/contabilidade` | ✅ | ❌ | ❌ | ❌ |
| `/admin/relatorios` | ✅ | ❌ | ❌ | ❌ |
| `/admin/usuarios` (via configuracoes) | ✅ | ❌ | ❌ | ❌ |
| `/admin/corretores` | ✅ | view | view | ❌ |
| `/admin/leads` | ✅ | ✅ | ✅ | ❌ |
| `/admin/imoveis` | ✅ | ✅ | ✅ | ❌ |
| `/admin/contratos` | ✅ | ✅ | ✅ | ❌ |
| `/admin/juridico` | ✅ | ✅ | ✅ | ❌ |
| `/admin/agenda` | ✅ | ✅ | ✅ | ❌ |
| `/admin/financiamentos` | ✅ | ✅ | ✅ | ❌ |
| `/admin/avaliacoes` | ✅ | ✅ | ✅ | ❌ |
| `/admin/regularizacao` | ✅ | ✅ | ✅ | ❌ |
| `/admin/obras` | ✅ | ✅ | ✅ | ❌ |
| `/admin/bpo` | ✅ | ✅ | ✅ | ❌ |
| `/admin/mapa` | ✅ | ✅ | ✅ | ❌ |
| `/admin/whatsapp` | ✅ | ✅ | ❌ | ❌ |

**Destructive Action Guards (admin-only):**
- `usuarios.ts`: all 5 actions
- `configuracoes.ts`: `salvarConfiguracao`
- `contabilidade.ts`: all actions
- `banco.ts`: `criarContaBancaria`, `excluirContaBancaria`
- `corretores.ts`: `excluirCorretor` (create requires admin too)

---

## ADR-8: Test Framework — Vitest with Node Environment

**Decision:** Use Vitest (not Jest) for automated tests.

**Rationale:**
- Vitest uses Vite's bundler (ESM-native), no transform config complexity
- Same test syntax as Jest (`describe`, `it`, `expect`) — zero learning curve
- Built-in TypeScript support via esbuild
- No DOM needed for pure function tests → use `environment: "node"`

**Scope (MVP — pure function tests only):**
- `utils.ts`: `formatCurrency`, `formatArea`, `formatTelefone`, `maskPhone`, `maskCurrency`, `currencyToFloat`
- `ssrf.ts` (extracted from route): `isSsrfUrl`
- `rbac.ts`: `hasRole`, `requireActionRole`

**Out of scope (would need mocking/integration test harness):**
- Server Actions (require Prisma + auth mocks)
- API Routes (require Next.js test utils)
- UI Components (require jsdom + React Test Renderer)

**Config:** `web/vitest.config.ts` with `resolve.alias` for `@/*` path mapping.

---

## ADR-9: SSRF Utility Extraction

**Decision:** Extract `isSsrfUrl` from `route.ts` to `web/src/lib/ssrf.ts` and export it.

**Rationale:** The function is a pure utility that belongs in `lib/`, not inside a route file. Extraction enables testing without importing the Next.js route (which would fail in Vitest's Node environment due to Next.js server imports).

---

## Implementation Plan

### Story S-01: RBAC Helper + Page Guards
- Create `web/src/lib/auth/rbac.ts`
- Apply `requirePageRole("admin")` to: `configuracoes/page.tsx`, `contabilidade/page.tsx`, `relatorios/page.tsx`

### Story S-02: Server Action Role Guards
- Apply `requireActionRole("admin")` to: `usuarios.ts` (all), `configuracoes.ts`, `contabilidade.ts` (all), `banco.ts` (create+delete), `corretores.ts` (`excluirCorretor`)

### Story S-03: Test Infrastructure + Test Suite
- Extract `isSsrfUrl` to `web/src/lib/ssrf.ts`
- Install `vitest` as devDependency
- Create `web/vitest.config.ts`
- Add `"test": "vitest run"` to package.json
- Write `web/src/lib/__tests__/utils.test.ts`
- Write `web/src/lib/__tests__/ssrf.test.ts`
- Write `web/src/lib/__tests__/rbac.test.ts`

---

## Non-Functional Requirements

- RBAC checks add < 1ms overhead (synchronous after `auth()`)
- No breaking changes for `admin` role users
- Tests run in < 5s for the pure function suite
- TypeScript paths must resolve in Vitest config
