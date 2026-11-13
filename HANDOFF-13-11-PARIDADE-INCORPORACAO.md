# HANDOFF 13/11 — Paridade da Incorporação (bloco 4: Prospecta → Grupo Santa Fé)

Branch: `claude/paridade-incorporacao` (a partir de `origin/main` 335211a). Worktree: `/home/user/sf-incorporacao`.
Origem: pedido de porte do "bloco 4" da Incorporação (ROADMAP da Prospecta, pendências de 08/11 e Correções 09–12).
Paridade retomada por ordem do dono em 13/11 (commit 6e75154 na Prospecta).

## Ordem de execução escolhida
1. Item 3 — Negociação do Terreno (pré-requisito do custo do terreno na Viabilidade).
2. Item 4 — Correções 09–12 da Viabilidade integrada.
3. Item 2 — Chaves de integração do Mercado no banco.
4. Item 1 — Inteligência de Mercado (IBGE pelo navegador + anúncios Tavily/IA).

## Item 3 — Negociação do Terreno — CONCLUÍDO
Arquivos:
- `web/src/lib/incorporacao/negociacao.ts` — regra da Prospecta (`shared/incorporacao/negociacao.ts`):
  `resolverVgvBruto` (Viabilidade › cenário escolhido do Estudo de Massa › manual legado), `calcularPermutaFinanceira`
  (VGV × % ÷ 100 em centavos, BigInt), `estimarProposta` (misto = dinheiro + permuta; sem VGV →
  "Cálculo pendente — VGV não disponível"), `resumoNegociacaoV2` (selecionada › aceita › mais recente),
  `excluirProposta` (auditoria em `historicoExclusoes`, aceita exige confirmação reforçada),
  `mesclarNegociacaoParaGravar`, `parseNegociacao`. Funções antigas mantidas (relatório executivo continua igual à Prospecta).
  Diferença de stack: `excluidaPorId` é `string` (id do usuário no Santa Fé é texto); autor continua `grupo_santa_fe`.
- `web/src/lib/actions/incorporacao.ts` — `salvarNegociacaoTerreno` agora mescla com o gravado (não apaga auditoria nem
  ressuscita excluída) e devolve erro como dado (`capturarErroAcao`); nova `excluirPropostaNegociacao`.
- `web/src/app/admin/incorporacao/_components/negociacao-terreno-tab.tsx` — "Excluir proposta" com confirmação
  (e digitar EXCLUIR para aceita), "Usar como atual", "Limpar seleção", painel proposta atual/aceita/mais recente,
  lista de exclusões (auditoria), VGV usado com a origem.
- `web/src/lib/__tests__/negociacao.test.ts` — cenários da Prospecta adicionados (nenhum teste antigo alterado).
Compatibilidade: JSON salvo antigo (sem `propostaSelecionadaId`/`historicoExclusoes`) abre normalmente (campos opcionais).
Sem migração (dados ficam no `negociacaoTerrenoJson` existente).

## Testes
(a) automáticos: `vitest run src/lib/__tests__/negociacao.test.ts` 22/22; `tsc --noEmit` sem erros; eslint nos alterados sem erros.
(b) manuais: nenhum (sem banco local com dados reais).
(c) produção: excluir proposta gravada/aceita e conferir auditoria; "usar como atual".

## Migrações a aplicar
Nenhuma até aqui.

## Próximo passo
Item 4 — Correções 09–12 (Viabilidade integrada).
