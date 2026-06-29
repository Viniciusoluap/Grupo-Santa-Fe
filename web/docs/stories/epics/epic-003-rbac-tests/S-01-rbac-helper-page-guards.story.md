# Story S-01: RBAC Helper + Page Guards

**Epic:** EPIC-003  
**Status:** Draft  
**Priority:** P0

---

## User Story

As an **admin**, I want non-admin users to be blocked from accessing financial and configuration pages, so that sensitive business data is protected.

---

## Acceptance Criteria

- [ ] AC-01: `web/src/lib/auth/rbac.ts` created with exported `hasRole`, `requirePageRole`, `requireActionRole` functions
- [ ] AC-02: `requirePageRole("admin")` applied in `/admin/configuracoes/page.tsx` — non-admin redirected to `/admin`
- [ ] AC-03: `requirePageRole("admin")` applied in `/admin/contabilidade/page.tsx` — non-admin redirected to `/admin`
- [ ] AC-04: `requirePageRole("admin")` applied in `/admin/relatorios/page.tsx` — non-admin redirected to `/admin`
- [ ] AC-05: `admin` role users are NOT affected — they continue to access all pages normally
- [ ] AC-06: TypeScript compiles with strict mode, no errors in new files

---

## Technical Notes

- `requirePageRole` must call `redirect("/admin")` (not throw) to avoid Next.js unhandled error pages
- Session is obtained by calling `auth()` in the page, then passing to `requirePageRole`
- RBAC helper must be pure TypeScript with no side effects except the redirect/throw

---

## File List

- `web/src/lib/auth/rbac.ts` (NEW)
- `web/src/app/admin/configuracoes/page.tsx` (MODIFIED)
- `web/src/app/admin/contabilidade/page.tsx` (MODIFIED)
- `web/src/app/admin/relatorios/page.tsx` (MODIFIED)
