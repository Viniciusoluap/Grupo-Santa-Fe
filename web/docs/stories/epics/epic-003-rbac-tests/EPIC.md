# EPIC-003: Granular RBAC + Automated Tests

**Epic Owner:** @pm (Morgan)  
**Architect:** @architect (Aria)  
**Sprint:** Session 3  
**Status:** IN PROGRESS

---

## Problem Statement

The admin panel grants any authenticated non-cliente user full access to all modules including financial data (contabilidade, relatorios), user management (configuracoes), and system settings. This violates the principle of least privilege identified in M-02 of the security audit. Additionally, there is zero test coverage — any regression goes undetected until production.

---

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-01 | System MUST restrict `/admin/configuracoes` to `admin` role only |
| FR-02 | System MUST restrict `/admin/contabilidade` to `admin` role only |
| FR-03 | System MUST restrict `/admin/relatorios` to `admin` role only |
| FR-04 | All user management Server Actions MUST require `admin` role |
| FR-05 | All contabilidade Server Actions MUST require `admin` role |
| FR-06 | System configuration action MUST require `admin` role |
| FR-07 | Bank account create/delete actions MUST require `admin` role |
| FR-08 | Corretor deletion action MUST require `admin` role |
| FR-09 | Non-admin users attempting restricted pages MUST be redirected (not 500) |
| FR-10 | Unit tests MUST exist for `formatCurrency`, `formatArea`, `formatTelefone` |
| FR-11 | Unit tests MUST exist for `isSsrfUrl` (private IP blocking) |
| FR-12 | Unit tests MUST exist for `hasRole` and `requireActionRole` RBAC helpers |
| FR-13 | `npm run test` MUST pass all tests with exit code 0 |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-01 | RBAC check overhead < 1ms per request |
| NFR-02 | No behavior changes for `admin` role users |
| NFR-03 | Tests complete in < 10 seconds |
| NFR-04 | TypeScript strict mode must pass with no new errors |

---

## Constraints

| ID | Constraint |
|----|------------|
| CON-01 | Cannot use Next.js middleware (Edge Runtime lacks Prisma) |
| CON-02 | Vitest only (not Jest) — ESM-native, no transform config complexity |
| CON-03 | Only pure function tests in scope — no mocking of Prisma/auth in this sprint |
| CON-04 | Must not break existing `admin` user workflows |

---

## Stories

| Story | Title | Priority |
|-------|-------|----------|
| S-01 | RBAC Helper + Page Guards | P0 |
| S-02 | Server Action Role Guards | P0 |
| S-03 | Test Infrastructure + Test Suite | P1 |
