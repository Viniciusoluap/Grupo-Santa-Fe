# Lote 4 — STATUS (branch `claude/lote4-ajustes-20261030`, Prospecta e Santa Fé)

Arquivo gêmeo nos dois repositórios (mesmo conteúdo). Decisões do dono: `docs/handoffs/lote3/DECISOES-DONO-30-10.md`.

## Etapa 1 — m² com 2 casas na Incorporação — CONCLUÍDA

- Só exibição; nenhum cálculo/arredondamento interno mudou.
- SF: `formatArea` (`web/src/lib/utils.ts`, já com 2 casas) passou a ser usado em todas as abas de
  `web/src/app/admin/incorporacao/_components/` (terreno, quadro de áreas, massa, lotes avulsos,
  mapa do terreno/massa, viabilidade, orçamento parametrizado, pesquisa primária, mercado/comparáveis,
  relatório executivo PDF) e em `web/src/lib/pdf/loteamento.ts`.
- Prospecta: novo `formatArea` em `client/src/lib/format.ts` (reexportado em
  `client/src/components/incorporacao/estudo/compat/util.ts`), aplicado nos mesmos arquivos de
  `client/src/components/incorporacao/estudo/` e em `compat/pdf-loteamento.ts`.
- Hectares do relatório executivo agora com vírgula decimal (antes `toFixed(2)` mostrava ponto).
- Testes novos (guarda de regressão que varre as abas e o PDF): SF `web/src/lib/__tests__/incorporacao-area-formato.test.ts`;
  Prospecta `server/incorporacao-area-formato.test.ts`.

### Testes
- (a) automáticos: testes acima + `utils.test.ts`/`format.test.ts` passando; `pnpm check` e `tsc --noEmit` OK.
  ESLint SF: 2 erros `react-hooks/preserve-manual-memoization` em `viabilidade-tab.tsx` já existiam na main (não introduzidos).
- (b) manuais: nenhum.
- (c) produção: conferir visualmente uma aba de Incorporação e o PDF executivo após deploy.

## Próximas etapas
2. CSV de comissões no SF (paridade com `AdminRelatorios.tsx` da Prospecta).
3. Restaurar exclusões em lote do BPO (nos dois).
4. Frentes antigas (integrações únicas, erros reais Asaas/Pluggy, chaves Prospecta, alternativa ao Pluggy).
5. Suíte completa nos dois.
