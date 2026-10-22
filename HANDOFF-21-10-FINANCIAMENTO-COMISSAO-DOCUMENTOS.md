# Handoff — 21/10/2026 — financiamento, comissão e documentos

Branch: `codex/fin-crm-bidirecional-20261021`, a partir de `main` 3563a431ad68049878e49618f0f568716d909b16. Paridade com `Viniciusoluap/Prospecta` na branch homônima.

## Pedido e implementação
- CRM é a fonte inicial: `Lead.orcamento` é **VGV simulado** e `Lead.valorAprovado` é **Valor financiado aprovado**. Criação e visualização de financiamentos vinculados usam esses campos, inclusive processos antigos. Edição no financiamento atualiza o lead e outros processos vinculados em transação com lock; edição no CRM sincroniza os processos. Rótulos foram ajustados na lista e no detalhe.
- Comissão automática de obra vinculada a lead é calculada sobre `Lead.orcamento` para admin, equipe e corretor. `Obra.vgv` continua sincronizado com `Lead.valorAprovado` para os demais cálculos da obra. Foram ajustados listagem de comissões, formulário manual, resumo financeiro, cálculo em tela, persistência de comissão e sincronização ao editar valores no financiamento/CRM.
- Upload documental CRM/financiamento aceita até 20 MiB. A rota recebe partes de 1 MiB ligadas a usuário/item e só grava o documento no Google Drive após validação integral. Partes expiram em 30 minutos e a migração `20261021140000_documento_upload_partes` define a tabela. O download também é realizado em partes de 1 MiB; a página recompõe o arquivo.

## Verificação
- `cd web && ./node_modules/.bin/tsc --noEmit` passou.
- 50 testes direcionados passaram, incluindo comissão com VGV simulado R$ 250.000 e aprovado R$ 200.000, além do limite de 20 MiB.
- `git diff --check` passou.

## Continuidade
- Verificar estado do PR, merge e Vercel de ambos os projetos após publicação.
- Validar em produção upload e consulta reais de um PDF de ~15 MiB e comissão de corretor com valores distintos, usando conta de teste e removendo o documento após conferência.
