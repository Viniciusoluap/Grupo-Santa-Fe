# Story S-02: Server Action Role Guards

**Epic:** EPIC-003  
**Status:** Draft  
**Priority:** P0

---

## User Story

As an **admin**, I want destructive Server Actions to reject requests from non-admin users, so that corretores and colaboradores cannot modify financial records, users, or system settings.

---

## Acceptance Criteria

- [ ] AC-01: All 5 actions in `usuarios.ts` require `admin` role
- [ ] AC-02: `salvarConfiguracao` in `configuracoes.ts` requires `admin` role
- [ ] AC-03: All actions in `contabilidade.ts` require `admin` role
- [ ] AC-04: `criarContaBancaria` and `excluirContaBancaria` in `banco.ts` require `admin` role
- [ ] AC-05: `excluirCorretor` in `corretores.ts` requires `admin` role
- [ ] AC-06: Non-admin callers receive `Error("Não autorizado")` — same error type as missing session
- [ ] AC-07: TypeScript strict mode passes, no errors

---

## Technical Notes

- Use `requireActionRole(session, "admin")` from `web/src/lib/auth/rbac.ts`
- Pattern: `const session = await auth(); requireActionRole(session, "admin");`
- Must NOT remove the existing `if (!session) throw new Error("Não autorizado")` — replace it with `requireActionRole` which handles both unauthenticated and unauthorized cases

---

## File List

- `web/src/lib/actions/usuarios.ts` (MODIFIED)
- `web/src/lib/actions/configuracoes.ts` (MODIFIED)
- `web/src/lib/actions/contabilidade.ts` (MODIFIED)
- `web/src/lib/actions/banco.ts` (MODIFIED)
- `web/src/lib/actions/corretores.ts` (MODIFIED)
