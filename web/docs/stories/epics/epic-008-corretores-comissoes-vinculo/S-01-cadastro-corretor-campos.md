# S-01 — Cadastro de Corretor: remover "URL HTTPS da foto" e "Especialidades"

**Status:** InReview · **Epic:** EPIC-008 · **Paridade:** Prospecta story 2.1

## Diagnóstico

- "URL HTTPS da foto": **não existe** no cadastro de corretor do Santa Fé (só no Prospecta,
  `AdminBrokerDirectory.tsx`). Nada a remover.
- "Especialidades": existia (checkboxes em Novo/Editar Corretor) e foi removido.

## Critérios de aceite

- [x] AC1 — Checkboxes de Especialidades removidos de `/admin/corretores/novo` e `/editar`.
- [x] AC2 — `criarCorretor` não lê mais o campo (coluna fica com o default `[]`);
  `editarCorretor` **não sobrescreve** o valor legado (sem perda de dados).
- [x] AC3 — Chips de especialidade e busca por especialidade removidos da listagem e do perfil
  (o dado deixou de ser gerenciável, não faz sentido exibir valor congelado).
- Coluna `corretores.especialidades` mantida no banco (sem migration destrutiva).

## Arquivos

`src/app/admin/corretores/{novo/page.tsx,[id]/editar/page.tsx,[id]/page.tsx,_components/corretores-client.tsx}`,
`src/lib/actions/corretores.ts`.
