# S-01 — Avaliações: seletor de lead no lugar do cadastro manual

**Status:** InReview · **Epic:** EPIC-007 · **Paridade:** Prospecta story 1.1

## Contexto

"Nova Avaliação" tinha uma busca de lead *opcional* que só pré-preenchia "Dados do Solicitante"
(Nome, CPF, Telefone, E-mail) — campos continuavam editáveis e o `leadId` **nem era enviado**
(`criarAvaliacao` não lia o campo). Toda avaliação aberta pela tela ficava sem vínculo; a
criada a partir do cadastro do lead também (`criarLead` não gravava `leadId` na avaliação).

## Critérios de aceite

- [x] AC1 — Bloco "Dados do Solicitante" removido do formulário de criação; no lugar, seletor
  obrigatório de lead do CRM (busca por nome/telefone) que exibe nome/telefone/e-mail do lead.
- [x] AC2 — `criarAvaliacao` exige `leadId` válido e copia `clienteNome/clienteTel/clienteEmail`
  do lead no servidor (valores do formulário ignorados); grava `leadId`.
- [x] AC3 — Avaliação criada a partir do cadastro do lead nasce com `leadId`.
- [x] AC4 — `?leadId=` pré-seleciona o cliente (usado pelo "Vincular" da página do lead).
- [x] AC5 — Edição: registro vinculado mostra o cliente só leitura; trocar o lead recopia os
  dados; registro vinculado não volta a ser avulso (opção "Nenhum lead" só para legados).

## Decisões

- **Endereço/Bairro/Cidade continuam no formulário**: aqui eles são "Dados do Imóvel" (o imóvel
  avaliado), não do cliente — e o `Lead` do Santa Fé não tem endereço para copiar.
- **CPF** saiu da criação (pedido explícito do dono); continua disponível em "Editar" como
  complemento (o lead não tem CPF), aparecendo no laudo quando preenchido.

## Arquivos

`src/app/admin/avaliacoes/nova/{page.tsx,nova-avaliacao-form.tsx}`,
`src/app/admin/avaliacoes/[id]/editar/page.tsx`, `src/lib/actions/avaliacoes.ts`,
`src/components/crm/lead-selector.tsx`, `src/components/crm/cliente-vinculado-info.tsx`,
`src/lib/crm/*`.
