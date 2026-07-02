# EPIC-004: Segurança do Banco (RLS) + Portal Documentos Real

**Epic Owner:** @pm (Morgan)  
**Sprint:** Session 4  
**Status:** Done

---

## Problem Statement

1. **CRÍTICO (relatado pelo Supabase em 28/06/2026):** advisors `rls_disabled_in_public` e `sensitive_columns_exposed`. Todas as tabelas do schema `public` estão expostas pela API PostgREST do Supabase sem Row-Level Security — qualquer pessoa com a URL do projeto + anon key pode ler/editar/apagar dados, incluindo hashes de senha na tabela `usuarios`.
2. A página `/portal/documentos` mostra estado vazio fixo, mesmo com `ContratoDocumento` + `Contrato.leadId` já existentes no schema (Sessão 2).
3. A migration `20260629000001_juridico_chat_schema` (Sessão 2) nunca foi aplicada em produção — o build da Vercel não roda `prisma migrate deploy`.

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-01 | Habilitar RLS em todas as tabelas do schema `public` (deny-all para roles da API; Prisma não é afetado — conecta como owner) |
| FR-02 | Revogar privilégios de `anon`/`authenticated` em tabelas/sequências/funções + default privileges (defesa em profundidade) |
| FR-03 | Build da Vercel deve aplicar migrations pendentes automaticamente (`prisma migrate deploy` no script build) |
| FR-04 | `/portal/documentos` deve listar contratos do lead da sessão com seus documentos (nome, tipo, data, link de download) e status de assinatura |
| FR-05 | Cliente sem `leadId` ou sem documentos vê estado vazio elegante (comportamento atual preservado) |

## Constraints

| ID | Constraint |
|----|------------|
| CON-01 | App usa somente Prisma (verificado: zero uso de supabase-js) — RLS sem policies não quebra nada |
| CON-02 | Migration deve ser no-op em bancos dev sem os roles `anon`/`authenticated` (blocos condicionais) |
| CON-03 | Isolamento por leadId: cliente só vê documentos dos próprios contratos |

## Stories

| Story | Title | Status |
|-------|-------|--------|
| S-01 | Migration RLS + auto-deploy de migrations no build | Done |
| S-02 | Portal Documentos com dados reais | Done |
