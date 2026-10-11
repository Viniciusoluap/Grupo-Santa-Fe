# S-02 — Comissões: campo Corretor lista corretores reais

**Status:** InReview (já atendia) · **Epic:** EPIC-008 · **Paridade:** Prospecta story 2.2

O select "Corretor" (`comissao-form.tsx`) já era alimentado por `prisma.corretor.findMany({ where:
{ ativo: true } })` em `src/app/admin/comissoes/page.tsx`, e `criarComissao/editarComissao` gravam
`corretorId` (FK para `Corretor`). Nenhuma mudança necessária — verificado em banco local.
