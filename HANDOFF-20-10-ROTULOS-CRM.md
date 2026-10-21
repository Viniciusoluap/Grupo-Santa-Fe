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
(a) Automáticos: diff restrito às substituições previstas, git diff --check e sintaxe TSX dos três arquivos aprovados. Build de preview e produção na Vercel aprovados (READY).
(b) Manuais: revisão do diff; tela autenticada ainda não verificada em navegador.
(c) Produção: deploy READY confirmado e domínios de produção atribuídos. Validação visual na tela autenticada ainda pendente.

## Próximo passo exato
Implementação concluída e publicada. PR #207 mesclado: https://github.com/Viniciusoluap/Grupo-Santa-Fe/pull/207. Commit de implementação: 3cd643268f83164ba11c91d2c1985c03dfdab726. Merge em main: 5a14cc44505ad11949dd51bc80b130a4f044004a. Deploy de produção: dpl_6kzZYvzRf3kUDP8Ucurh31UaimtH (READY). Apenas conferir os rótulos no formulário e na leitura de um lead autenticado. Este checkpoint final fica na branch de trabalho; o handoff inicial também integra main.
