# S-04 — Comissões: valor auto-calculado (percentual × valor do negócio), editável

**Status:** InReview · **Epic:** EPIC-008 · **Paridade:** Prospecta story 2.4

## Critérios de aceite

- [x] AC1 — Ao escolher o negócio ou mudar o percentual, "Valor da Comissão" é recalculado:
  `round(valorBase × percentual) / 100` (centavos). Base: preço do imóvel (venda/aluguel),
  `valorImovel` do financiamento, `valorTotal` da obra.
- [x] AC2 — O valor continua editável à mão; a dica mostra a conta
  ("6% × R$ 300.000,00 = R$ 18.000,00").
- [x] AC3 — Sem base (valor 0/ausente) ou percentual inválido → não sobrescreve o valor.
- [x] AC4 — Abrir uma comissão existente para editar **não** recalcula sozinho (preserva o valor salvo).

## Testes

`calcularValorComissao` em `src/lib/__tests__/comissao-calculo.test.ts`.
