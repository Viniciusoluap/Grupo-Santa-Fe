# S-03 — Comissões: "Imóvel/negócio" por seletor de registro pré-cadastrado

**Status:** InReview · **Epic:** EPIC-008 · **Paridade:** Prospecta story 2.3

## Contexto

Na criação já era seletor (imóveis de venda/locação, financiamentos, obras); na **edição** o campo
virava texto livre "Imóvel / Negócio".

## Critérios de aceite

- [x] AC1 — Criação e edição usam o mesmo bloco: Tipo de Comissão + seletor do registro
  ("Imóvel cadastrado", "Financiamento cadastrado" ou "Obra cadastrada"), com o valor de cada um.
- [x] AC2 — Na edição, o negócio é reencontrado pelo rótulo gravado; comissão antiga com texto
  livre aparece como "(registro antigo)" até o usuário escolher um registro real — sem perda.
- [x] AC3 — Servidor rejeita comissão sem negócio (`lerNegocioEValor`).
- "Extra" continua com descrição livre (não é imóvel).

## Testes

`src/lib/__tests__/comissao-calculo.test.ts` (`encontrarNegocio`, `rotuloNegocio`).
