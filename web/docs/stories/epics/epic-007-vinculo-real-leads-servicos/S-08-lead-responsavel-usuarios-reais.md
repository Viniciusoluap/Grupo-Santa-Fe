# S-08 — CRM, campo "Responsável" com usuários reais do sistema

**Status:** InReview · **Epic:** EPIC-007 · **Paridade:** Prospecta story 1.8

## Diagnóstico

No Prospecta o responsável do lead é um enum fixo no código (sarah/vinicius/bianca). No Santa Fé
**não existia campo Responsável**: só o corretor (`corretorId`). Para manter a mesma regra de
negócio dos dois lados (responsável interno + corretor opcional), o campo foi criado.

## Critérios de aceite

- [x] AC1 — `Lead.responsavelId` → `Usuario` (FK `ON DELETE SET NULL`), migration aditiva
  `20261011160000_lead_responsavel`.
- [x] AC2 — Select "Responsável" no cadastro/edição lista usuários **ativos** com papel admin,
  colaborador ou corretor (nunca cliente, nunca nomes fixos).
- [x] AC3 — Padrão no cadastro = usuário logado; o servidor valida o id recebido
  (`resolverResponsavelId`) — id inválido/cliente/inativo vira `null`.
- [x] AC4 — Página do lead e Quadro de serviços mostram o responsável (leads antigos sem
  responsável mostram o corretor, como antes).

## Testes

`src/lib/__tests__/lead-responsavel.test.ts`.

## ⚠ Deploy

A migration precisa estar aplicada em produção antes do merge (ver EPIC.md).
