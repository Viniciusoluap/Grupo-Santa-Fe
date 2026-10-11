# S-02 — Projetos: sem cadastro avulso; vínculo com lead cria/popula o registro

**Status:** InReview · **Epic:** EPIC-007 · **Paridade:** Prospecta story 1.2

## Contexto

"Novo Projeto" tinha busca de lead rotulada "OBRIGATÓRIO", mas o servidor aceitava `leadId`
vazio e gravava o nome/telefone digitados à mão (cadastro avulso). Projeto criado pelo cadastro
do lead usava `tipo` como string simples (`"projeto_completo"`), fora do formato JSON usado no módulo.

## Critérios de aceite

- [x] AC1 — Campos manuais "Nome do Cliente"/"Telefone" removidos da criação; seletor de lead obrigatório.
- [x] AC2 — `criarProjeto` exige lead (erro sem lead) e copia os dados do lead no servidor.
- [x] AC3 — Marcar "Projeto de engenharia" no lead (cadastro **ou edição**) cria o registro real
  vinculado (idempotente); abrir pelo módulo marca o serviço no lead.
- [x] AC4 — Edição de projeto vinculado: cliente só leitura ("Editar no CRM"); servidor ignora
  nome/telefone do formulário e usa o lead. Projetos legados sem lead seguem editáveis.

## Decisão

O botão "Novo Projeto" da listagem **foi mantido**: ele não é mais um cadastro avulso, porque o
formulário só cria projeto para um lead do CRM. O Prospecta pode ter optado por remover o botão
e abrir só pelo CRM — a regra de negócio (nenhum serviço sem lead; dados vindos do lead) é a mesma.

## Arquivos

`src/app/admin/projetos/novo/*`, `src/app/admin/projetos/[id]/editar/page.tsx`,
`src/lib/actions/projetos.ts`, `src/lib/crm/*`.
