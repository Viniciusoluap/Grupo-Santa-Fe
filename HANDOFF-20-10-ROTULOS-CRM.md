# Handoff — nomenclatura dos valores do CRM — 20/10/2026

## Escopo autorizado
Renomear os dois valores no formulário de edição e na leitura do lead, com paridade Prospecta e Grupo Santa Fé. Merge e deploy autorizados pelo usuário.

## Concluído nesta etapa
- Primeiro campo: VGV simulado (R$); leitura: VGV simulado.
- Segundo campo: Valor financiado aprovado (R$); leitura: Valor financiado aprovado.
- Prospecta: AdminLeadDetail.tsx; Santa Fé: editar-lead-form.tsx e page.tsx do detalhe do lead.
- Santa Fé usa orcamento como campo equivalente ao valor simulado (antigo rótulo Budget).
- Alteração somente de rótulos; preservados campos persistidos, valores, cálculos e integrações.
- Logyca segue em planejamento, fora deste lote.

## Testes
(a) Automáticos: diff restrito às substituições previstas, git diff --check e sintaxe TSX dos três arquivos aprovados.
(b) Manuais: revisão do diff; tela autenticada ainda não verificada em navegador.
(c) Produção: aguardar build/deploy e validar os rótulos na tela autenticada.

## Próximo passo exato
Publicar a branch codex/rotulos-valores-crm-20261021 em ambos os repositórios, abrir PRs, verificar checks, fazer merge e acompanhar os deploys de produção na Vercel. Registrar resultados neste handoff.
