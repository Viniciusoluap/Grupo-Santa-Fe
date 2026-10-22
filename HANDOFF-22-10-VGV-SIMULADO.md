# Handoff — VGV da obra = VGV simulado do lead (22/10/2026)

## Pedido do dono
"O VGV total do imóvel está puxando o valor errado cadastrado no lead; deveria puxar o VGV simulado (no caso 291 mil). Isso impacta o cálculo do corretor." Iniciado pelo Codex: as branches `codex/vgv-obra-simulado-20261022` ficaram iguais à `main` porque a correção dele não chegou ao GitHub. Concluído pelo Claude na branch `claude/sync-mirrored-repos-bsqnz3`.

## Causa
A obra com lead usava o valor financiado aprovado como VGV, na tela, na gravação e na sincronização a partir do CRM. A comissão já usava o VGV simulado, então a operação ficava inconsistente.

## Correção (paridade nos dois)
- Obra com lead: VGV = VGV simulado do lead (Prospecta `leads.simulation_value`; Santa Fé `Lead.orcamento`), na tela, nos cálculos (resultado da operação), na gravação, na sincronização ao editar o lead e nas listagens. A comissão usa o mesmo valor.
- O valor financiado aprovado continua separado: é usado no financiamento, não no VGV.
- Prospecta: `server/obra-financeiro-router.ts` (carregarObra, sincronizarVgvDoLead), `client/src/components/obra/FinanceiroObra.tsx` (texto da tela), comentários em `operacional-router.ts` e `routers.ts`.
- Santa Fé: `src/lib/financeiro/vgv-lead.ts` (novo `vgvSimuladoDoLead`), `obra-dados.ts`, `actions/obra-financeiro.ts`, `obras/lista-dados.ts`, `financeiro-obra.tsx`.

## Testes
- (a) Prospecta 915/915, check e build OK. Teste novo com o caso real: VGV simulado 291.000 × 4% = R$ 11.640,00; sincronização a partir do lead.
- (a) Santa Fé: tsc e lint OK. 767 testes passam; as 13 falhas de banco local (medições, PCI, projetos) já existem na `main`, sem relação com esta mudança. Os testes de VGV e comissão foram atualizados para a regra nova.
- (c) Pendente em produção: abrir a obra do lead #92 (Prospecta) e conferir VGV R$ 291.000 e comissão R$ 11.640.

## Dados existentes em produção
- Prospecta: 9 obras com o VGV aprovado gravado (1, 14, 16, 18, 19, 25, 31, 32, 48).
  - A tela passa a ler do lead; a coluna gravada é alinhada por SQL depois do deploy.
  - Comissões gravadas com corretor que mudam: obra 14, de R$ 3.600,45 para R$ 5.140,50 (230.000 × 2,235%); obra 31, de R$ 7.000,00 para R$ 6.800,00 (170.000 × 4%).
  - Obras 18 e 48 já estavam certas.
- Santa Fé: 3 obras (Vilton, Alessandra, Ageu Galpão), sem corretor, então nenhuma comissão muda. Atenção: "Ageu Galpão" tem VGV simulado de R$ 20.000 contra R$ 200.000 aprovado, e "Vilton" tem R$ 1.000. Parecem erros de digitação no lead e precisam de revisão do dono.

## Próximo passo
PRs → merge → deploy READY → teste rápido → alinhar a coluna `vgv` (e a comissão gravada da Prospecta) com o VGV simulado.

## Concluído em produção (22/10)
- PRs mesclados: Prospecta #153 (`5ad5123`) e Santa Fé #216 (`929a7c1`). Deploys READY: `dpl_82XBz4YyKv6SAkVYpNMXAFpVmN3x` e `dpl_EAkAEU4csiYtQdYSMMN8uqKSz6wx`.
- Teste rápido: `/api/trpc/auth.me` da Prospecta responde 200 (sem falha de módulo). Santa Fé sem erros de execução.
- Dados alinhados com UPDATE protegido (só os ids listados e só onde o valor divergia):
  - Prospecta: `vgv` = VGV simulado nas 9 obras; comissão gravada da obra 14 em R$ 5.140,50 (antes 3.600,45) e da obra 31 em R$ 6.800,00 (antes 7.000,00). Conferido: 0 obras divergentes; obra 48 (lead #92) com R$ 291.000 e comissão R$ 11.640.
  - Santa Fé: `vgv` das 3 obras = VGV simulado (Vilton 1.000; Alessandra 260.000; Ageu Galpão 20.000).
- (c) Pendente com o dono: revisar o VGV simulado dos leads "Ageu Galpão" (R$ 20.000 contra R$ 200.000 aprovado) e "Vilton" (R$ 1.000), que parecem digitados errado. Ao corrigir no lead, a obra acompanha sozinha.
- Próximo passo: nenhum técnico. Aguardar a conferência visual do dono na obra do lead #92.
