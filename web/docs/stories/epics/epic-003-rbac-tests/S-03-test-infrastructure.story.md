# Story S-03: Test Infrastructure + Test Suite

**Epic:** EPIC-003  
**Status:** Draft  
**Priority:** P1

---

## User Story

As a **developer**, I want `npm run test` to run a unit test suite, so that regressions in utility functions are caught before deployment.

---

## Acceptance Criteria

- [ ] AC-01: `isSsrfUrl` extracted to `web/src/lib/ssrf.ts` and exported; `route.ts` imports from there
- [ ] AC-02: `vitest` installed as devDependency
- [ ] AC-03: `web/vitest.config.ts` created with `@/*` path alias resolving to `./src/*`
- [ ] AC-04: `"test": "vitest run"` script added to `web/package.json`
- [ ] AC-05: `web/src/lib/__tests__/utils.test.ts` passes: formatCurrency (BRL formatting), formatArea (m²), formatTelefone (10/11-digit), maskPhone, maskCurrency, currencyToFloat
- [ ] AC-06: `web/src/lib/__tests__/ssrf.test.ts` passes: blocks localhost, 127.x, 10.x, 192.168.x, 172.16-31.x, IPv6 ::1; allows public IPs and valid HTTPS URLs; blocks non-http/https protocols
- [ ] AC-07: `web/src/lib/__tests__/rbac.test.ts` passes: `hasRole` returns true for allowed roles, false otherwise; `requireActionRole` throws for non-matching roles, passes for matching
- [ ] AC-08: `npm run test` exits with code 0 in CI (all tests pass)

---

## Technical Notes

- Vitest environment: `"node"` (no DOM needed for pure functions)
- `Intl.NumberFormat` works in Node.js v18+ — no polyfill needed
- `vitest.config.ts` must use `vite`'s `resolve.alias` for `@/*` mapping
- Do NOT use `@vitejs/plugin-react` (not needed for non-JSX tests)
- Test files go in `web/src/lib/__tests__/`

---

## File List

- `web/src/lib/ssrf.ts` (NEW)
- `web/src/app/api/scraper/fetch/route.ts` (MODIFIED — import from ssrf.ts)
- `web/vitest.config.ts` (NEW)
- `web/package.json` (MODIFIED — add test script + vitest devDep)
- `web/src/lib/__tests__/utils.test.ts` (NEW)
- `web/src/lib/__tests__/ssrf.test.ts` (NEW)
- `web/src/lib/__tests__/rbac.test.ts` (NEW)
