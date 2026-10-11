# S-05 — Comissões: "Construção" → "Obra", vinculada a obra cadastrada

**Status:** InReview · **Epic:** EPIC-008 · **Paridade:** Prospecta story 2.5

O Santa Fé não tinha o rótulo "Construção" nas comissões: já existia "Comissão por Obra"
(somente para beneficiário corretor) com seletor das obras cadastradas. Ajustes feitos:

- [x] Rótulo do tipo padronizado como **"Obra"** (igual à listagem, `TIPO_NEGOCIO_LABELS.obra`).
- [x] Seletor "Obra cadastrada" mostra o valor total de cada obra e alimenta o cálculo do S-04.
- [x] A edição também mantém o vínculo com a obra (S-03).

Observação: em Financiamentos, `TIPO_CONFIG.construcao` ("Construção") é uma **modalidade de
financiamento**, não tipo de comissão — mantido.
