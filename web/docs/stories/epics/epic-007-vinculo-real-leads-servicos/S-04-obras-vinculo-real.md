# S-04 — Obras: vínculo real com o lead

**Status:** InReview · **Epic:** EPIC-007 · **Paridade:** Prospecta story 1.4

## Critérios de aceite

- [x] AC1 — "Nova Obra / Reforma" exige lead do CRM (seletor); nome/telefone manuais removidos.
- [x] AC2 — `criarObra` valida o lead e copia os dados no servidor (notificação usa o nome do lead).
- [x] AC3 — "Obra e reforma" no lead ↔ registro real; edição do lead propaga nome/telefone.
- [x] AC4 — Edição de obra vinculada: cliente só leitura; obras legadas sem lead continuam editáveis.

## Validação manual (banco local)

Edição de obra vinculada com `clienteNome=INJETADO` → gravou o nome do lead; obra legada sem
lead → gravou o nome digitado.

## Arquivos

`src/app/admin/obras/novo/*`, `src/app/admin/obras/[id]/editar/page.tsx`, `src/lib/actions/obras.ts`.
