# S-06 — CRM, Cadastrar/Editar Lead: Renda/Tipo de Renda e corretor opcional

**Status:** InReview · **Epic:** EPIC-007 · **Paridade:** Prospecta story 1.6

## Diagnóstico

- **Renda / Tipo de Renda não existem no Santa Fé** (nem no schema `Lead`, nem nos formulários
  `novo-lead-form.tsx`/`editar-lead-form.tsx`). Nada a remover — o Santa Fé já está no estado
  pedido. O campo "Budget" (`orcamento`) é outro conceito e foi mantido.
- O vínculo opcional com **Corretor cadastrado** já existia (`Lead.corretorId`, select com
  corretores ativos reais), rotulado "Corretor Responsável".

## Critérios de aceite

- [x] AC1 — Campo renomeado para "Corretor vinculado (opcional)" para não se confundir com o
  novo "Responsável" (S-08).
- [x] AC2 — Bug corrigido: escolher "Sem corretor" na edição não desvinculava (`|| undefined`
  mantinha o antigo) — agora grava `null`. Mesmo ajuste para e-mail vazio.

## Arquivos

`src/app/admin/leads/novo/*`, `src/app/admin/leads/[id]/editar*`, `src/lib/actions/leads.ts`.
