# S-03 — Regularização: sem "+ Novo processo" avulso

**Status:** InReview · **Epic:** EPIC-007 · **Paridade:** Prospecta story 1.3

## Contexto

Mesmo padrão do S-02. Além disso havia **duas** actions `criarRegularizacao`:
`src/lib/actions/regularizacoes.ts` (usada pela tela) e uma cópia antiga em
`src/lib/actions/regularizacao.ts`, sem uso na UI mas exposta como server action — permitia
criar processo sem lead e sem `tipo` em JSON.

## Critérios de aceite

- [x] AC1 — "Novo Processo" exige lead do CRM (seletor); campos manuais de cliente removidos.
- [x] AC2 — `criarRegularizacao` valida o lead e copia os dados no servidor.
- [x] AC3 — Cópia antiga/órfã de `criarRegularizacao` removida (fecha o caminho avulso).
- [x] AC4 — Serviço "Regularização imobiliária" no lead ↔ registro real (nos dois sentidos).
- [x] AC5 — Edição de processo vinculado: cliente só leitura.

## Arquivos

`src/app/admin/regularizacao/novo/*`, `src/app/admin/regularizacao/[id]/editar/page.tsx`,
`src/lib/actions/regularizacoes.ts`, `src/lib/actions/regularizacao.ts`.
