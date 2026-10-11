# S-05 — Financiamento: vínculo real com o lead

**Status:** InReview · **Epic:** EPIC-007 · **Paridade:** Prospecta story 1.5

## Contexto

Além do mesmo padrão de pré-preenchimento editável, o financiamento criado pelo cadastro do lead
gravava `tipo` "MCMV"/"Convencional" (inexistentes em `TIPO_CONFIG`) e nascia **sem checklist**
documental (a tela de criação gerava o checklist; o fluxo do lead não).

## Critérios de aceite

- [x] AC1 — "Novo Financiamento" exige lead do CRM; nome/telefone/e-mail manuais removidos.
- [x] AC2 — `criarFinanciamento` valida o lead e copia os dados no servidor.
- [x] AC3 — Financiamento criado pelo lead usa `mcmv`/`sbpe` e recebe o checklist padrão
  (constante única `CHECKLIST_FINANCIAMENTO_PADRAO`).
- [x] AC4 — Idempotência compara tipos normalizando os legados ("MCMV" ≡ `mcmv`).
- [x] AC5 — Edição de financiamento vinculado: cliente só leitura.

## Decisão

**CPF continua na criação** como complemento opcional: o lead não tem CPF (não é recadastro) e o
banco exige o dado. Na Avaliação o CPF saiu da criação por pedido explícito (ver S-01).

## Arquivos

`src/app/admin/financiamentos/novo/*`, `src/app/admin/financiamentos/[id]/editar/page.tsx`,
`src/lib/actions/financiamentos.ts`, `src/lib/crm/vinculo-lead.ts`.
