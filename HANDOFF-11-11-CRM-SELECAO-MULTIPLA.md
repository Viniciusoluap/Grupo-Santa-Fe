# Handoff — CRM: seleção múltipla na Lista (11/11)

## Pedido do dono
Caixa de seleção em cada cliente da Lista do CRM para selecionar vários e excluir ou mover de etapa todos de uma vez.

## Concluído
- Prospecta `client/src/pages/admin/AdminCRM.tsx` (visão Lista): caixa em cada lead ativo e "selecionar todos" no
  cabeçalho (só os visíveis com os filtros/busca atuais). Com seleção aparece a barra: "Mover para a etapa…" +
  "Mover selecionados", "Excluir selecionados" (exclusão lógica, igual ao botão Excluir — recuperável em Ver
  arquivados) e "Limpar seleção". Cada lead passa pelas mesmas rotas de antes (`leads.update` com a etapa e
  `leads.softDelete`), com as mesmas regras e históricos; falhas são listadas por lead sem interromper os demais.
- Paridade Santa Fé `web/src/app/admin/leads/_components/leads-client.tsx` (visão lista): o mesmo, usando
  `alterarEtapaLead` (com controle de versão) e `excluirLead` (exclusão lógica da operação).

## Testes
- (a) Prospecta: suíte completa verde, typecheck e build OK; Santa Fé: typecheck e eslint limpos, testes de leads verdes.
- (b) Chromium (Prospecta) com servidor simulado: 2 selecionados → "Mover selecionados" chamou `leads.update` para os 2
  com a etapa escolhida; "selecionar todos" + "Excluir selecionados" chamou `leads.softDelete` para os 3; sem erros.
- (c) Produção: pendente — testar com leads reais (de preferência poucos de teste).

## Próximo passo
Com autorização: merge/deploy dos PRs da Prospecta e do Santa Fé.
