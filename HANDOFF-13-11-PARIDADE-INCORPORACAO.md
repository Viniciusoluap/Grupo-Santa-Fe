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

Testes do item 3: (a) `negociacao.test.ts` 22/22, tsc e eslint limpos; (b) nenhum manual; (c) produção: excluir proposta
gravada/aceita e conferir a auditoria; "usar como atual".

## Item 4 — Correções 09–12 da Viabilidade integrada — CONCLUÍDO
Origem na Prospecta: commits de586d7 (motor), 4fcd71e (UI), ce69850 (revisão Codex). O autosalvamento (93edc7c) NÃO foi
portado (é outra frente; o Santa Fé continua com o botão "Salvar premissas").
Arquivos:
- `web/src/lib/finance/loteamento.ts` — motor da Prospecta (`viabilidade-economica.ts`) inteiro: desembolsos do terreno,
  captação (aporte/devolução do principal/remuneração = único custo financeiro), permuta física (unidades não vendáveis,
  mas construídas), obras residenciais separadas da infraestrutura, Casa Pronta (`casaPronta`/`precoUnidade`,
  `vgvItemMix`), convenção M0/M1–M12 = Ano 1 com horizonte sem meses artificiais (prazo 0 recebido no mês da venda),
  `paybackDetalhado`/`trocasDeSinal`/`tirMotivo` (TIR só com uma troca de sinal), lucro/ROI/margem com custos nominais +
  terreno + custo financeiro, indicadores do projeto sem captação. vpl/tir continuam vindo de `eve.ts`; mix fica no mesmo arquivo.
- `web/src/lib/incorporacao/composicao-custos.ts` (novo) — fontes "Valor manual"/"Valor do sistema" (infra e obras
  residenciais do Orçamento, marketing = fornecedores elegíveis + material publicitário sem duplicar, terreno pela
  Negociação), captação do Business Plan, demonstrativo auditável (`composicaoFinanceira`), `grupoDaLinha`, `programarPagamento`.
- `web/src/lib/incorporacao/fluxo-anual.ts` (novo) — vendas, recebimentos, custos e fluxo por ano.
- `web/src/lib/incorporacao/premissas-loteamento.ts` — `configFontes` (migração dos dados antigos), `montarViabilidade`,
  `montarViabilidadeDoEstudo`; `marketingDoLancamento` removida (substituída por `marketingDoSistema`, igual à Prospecta).
- `web/src/lib/finance/captacao.ts` (`mesAporte`), `web/src/lib/orcamento/parametrizado.ts` (`grupo` por linha).
- `web/src/lib/incorporacao/relatorio-executivo.ts`, `relatorio-tab.tsx`, `web/src/lib/pdf/loteamento.ts` — terreno, custo
  financeiro, lucro, payback/TIR com estado, tabelas por ano, Casa Pronta nos PDFs.
- `viabilidade-tab.tsx` — reconstruída a partir da versão da Prospecta (pré-autosalvamento) com os imports e o contraste do
  Santa Fé (cinzas 400→600 / 300→500); seletores Manual/Sistema, terreno, captação com mês do aporte, tabelas anuais,
  demonstrativo, Casa Pronta. `business-plan-tab.tsx` (mês do aporte; investimento = custos + terreno),
  `orcamento-importacao.tsx` (grupo por linha). `salvarViabilidade` devolve erro como dado.
Compatibilidade com estudos salvos: `loteamentoJson` antigo abre — campos novos são opcionais; `marketingFonte`
"fornecedores"/"publicidade" viram "sistema"; `custoInfraModo` legado migra (sistema quando há Orçamento); valores manuais
nunca são sobrescritos; item de mix sem `casaPronta` calcula como antes; linha de orçamento sem `grupo` é deduzida pela descrição.
ATENÇÃO (regra nova, igual à Prospecta): estudo com proposta ACEITA passa a descontar o terreno (fonte "sistema" por padrão)
e com Business Plan passa a considerar a captação → lucro/ROI/margem/payback mudam ao reabrir.
Sem migração (tudo em JSON já existente).

## Testes (acumulado)
(a) automáticos: `npx vitest run` 1258 passados / 156 pulados (os pulados são os de banco que já eram pulados);
novo `viabilidade-correcoes-09-12.test.ts` (dados reais do estudo 2 da Prospecta, fixture `__tests__/fixtures/estudo-2-daniel-mota.ts`);
`lancamento-viabilidade.test.ts` teve a expectativa trocada pela regra nova, igual à Prospecta (antes: marketing por
"fornecedores" = 300 / "publicidade" = 75 somando qualquer fornecedor; agora: sistema = fornecedores elegíveis + material
aprovado sem duplicar = 630, e o manual nunca é sobrescrito). `npx tsc --noEmit -p .` sem erros.
eslint: `viabilidade-tab.tsx` tem 1 erro `react-hooks/preserve-manual-memoization` (antes desta mudança havia 2 do mesmo
tipo no mesmo arquivo); 1 aviso `_r` não usado em `composicao-custos.ts` (igual ao original da Prospecta).
(b) manuais: nenhum (sem banco com dados reais aqui).
(c) produção: abrir estudos já salvos (com e sem proposta aceita/Business Plan) e conferir Viabilidade, Business Plan,
Relatório e PDFs.

## Migrações a aplicar
Nenhuma até aqui.

## Próximo passo
Item 2 — chaves de integração do Mercado no cofre existente (`web/src/lib/integracoes.ts`), depois item 1.
