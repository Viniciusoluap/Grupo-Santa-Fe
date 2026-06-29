# Story S-05 — Relatórios: Filtros, Avaliações, Contabilidade e Export CSV
**Epic:** EPIC-002
**Status:** Ready
**Agent:** @dev

## Contexto

A página de Relatórios (`/admin/relatorios`) já funciona com dados básicos (leads, comissões, imóveis). Precisa ser expandida com dados de avaliações e lançamentos contábeis, filtro de período e exportação CSV.

## Acceptance Criteria

- [ ] AC-01: Filtro de período com dois campos de data (início/fim) no topo da página — aplicado como `searchParams` no Server Component
- [ ] AC-02: Cards adicionais: total de avaliações, valor médio de avaliação, total de lançamentos financeiros (receitas e despesas)
- [ ] AC-03: Gráfico de pizza ou barra mostrando avaliações por status (`pendente`, `em_progresso`, `concluida`)
- [ ] AC-04: Gráfico mensal de lançamentos: receitas vs despesas por mês (últimos 12 meses ou período filtrado)
- [ ] AC-05: Botão "Exportar CSV" na página de relatórios
- [ ] AC-06: `GET /api/admin/relatorios/export?from=&to=` retorna arquivo CSV com todas as comissões no período — headers: `data,corretor,imovel,valor,status`
- [ ] AC-07: CSV usa separador `;` e BOM UTF-8 (para abrir corretamente no Excel BR)
- [ ] AC-08: Rota de export tem autenticação obrigatória
- [ ] AC-09: Filtro de período vazio = últimos 12 meses (padrão)

## Tasks

- [ ] Atualizar `web/src/app/admin/relatorios/page.tsx` — adicionar `searchParams`, queries de avaliações e lançamentos
- [ ] Atualizar `web/src/app/admin/relatorios/relatorios-client.tsx` — adicionar DateRangePicker, novos gráficos, botão export
- [ ] Criar `web/src/app/api/admin/relatorios/export/route.ts` — rota CSV

## File List

- `web/src/app/admin/relatorios/page.tsx` (modificar)
- `web/src/app/admin/relatorios/relatorios-client.tsx` (modificar)
- `web/src/app/api/admin/relatorios/export/route.ts` (novo)
