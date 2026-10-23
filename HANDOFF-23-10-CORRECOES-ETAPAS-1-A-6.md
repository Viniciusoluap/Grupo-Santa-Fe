# HANDOFF 23/10 — Correções Prospecta e Grupo Santa Fé (etapas 1–6)

## Estado inicial e convivência
- Prospecta: `main` / `origin/main` em `c0077571d208bfc30834bd0d0a1a11aa6ae97457`.
- Grupo Santa Fé: `main` / `origin/main` em `793a4cbcc4a558bb8703e3b8330799db510dce7f`.
- Publicação Santa Fé na branch: SHA remoto `186f89f620a92fb76f102fc23fb35104a4fa5a64`, PR #220 (rascunho). Commit Git local equivalente da implementação `5f18641904a14618eb1dab229faefb6207c697ea`.
- Prospecta: etapa 1 publicada na branch espelhada, SHA remoto `67f1432d64b158137888b0f2ab747d99e0d1125b`, PR #157 (rascunho).
- Ambos foram clonados limpos neste workspace, sem modificações de outro agente. `git fetch` confirmou a base antes de criar a branch isolada `codex/regularizacoes-indicadores-20261023` em cada repo. Não havia PRs abertos. O lote anterior H1–H6 já estava no main e publicado; ler `HANDOFF-23-10-LOTE.md`.
- Claude trabalha em paralelo: antes de integrar, fazer novo fetch, comparar main e branches/PRs recentes e preservar as duas linhas de trabalho.
- Arquivos previstos da etapa 1: núcleo financeiro de indicadores, consulta da lista de regularizações e teste/handoff em cada repositório. Etapas 2–6 ficam em frentes próprias, após a publicação desta etapa.

## Etapa 1 — Indicadores financeiros
- Prospecta: `shared/financeiro/indicadores-regularizacao.ts` e teste; `server/regularizacao-router.ts` expõe `regularizacao.indicadores`; `client/src/pages/admin/AdminRegularizacoes.tsx` mostra Valor já recebido e Valor contratado, sem atrelar ao filtro visual.
- Santa Fé: `web/src/lib/financeiro/indicadores-regularizacao.ts` e teste; consulta em `web/src/app/admin/regularizacao/page.tsx`; cards em `_components/regularizacao-client.tsx`.
- A regra usa chaves canônicas projetos, pci, agua, despachante e cnd_cno. Na ausência de chave, reconhece apenas nomes equivalentes exatos (Projeto(s), PCI, Água, Despachante, CND e CNO/CND-CNO). Chave conhecida de terceiro prevalece sobre nome editado; nomes ambíguos não entram automaticamente.
- Soma os valores previstos dos itens próprios em processos válidos (status diferente de cancelado) e os recebimentos confirmados correspondentes. Parcial e total permanecem dentro do contratado. Deduplicação por IDs de item e recebimento; histórico de edições não é agregado. Valores em centavos. Não usa `serviceValue`/`valorServico`.
- Migração de banco: nenhuma. Dados legados sem chave e fora dos aliases exigem reconciliação de nomenclatura depois de inventário controlado, sem classificação automática de despesas.
- Testes (a) automáticos: teste de unidade com parcelas, cancelamento, terceiro, duplicação de ID, item legado, renomeação e processo cancelado. Prospecta: Vitest 2/2, `corepack pnpm check` e `corepack pnpm build` passaram (avisos de chunks grandes existentes). Santa Fé: Vitest 2/2, `npx tsc --noEmit` e ESLint dos arquivos alterados passaram. `npm run build` compilou e passou TypeScript, mas falhou ao pré-renderizar `/` porque o Postgres local não está disponível (`ECONNREFUSED` em `prisma.imovel.findMany`).
- Testes (b) manuais: ainda não realizados com processo real.
- Testes (c) produção: comparar um processo com itens próprios e despesas, recebimento parcial e total, linha a linha; conferir que filtros não alteram cards.
- Riscos: novos nomes históricos fora da lista fechada ficam fora dos indicadores; investigar antes de expandir aliases. Um processo cancelado é excluído dos dois indicadores.

## Próximo passo exato
1. Conferir a etapa 1 linha a linha com um processo real em produção; não foi executado teste manual nem merge/deploy.
2. Checar o remoto de novo; criar branches isoladas para a etapa 2 a partir do main remoto mais recente, sem sobrescrever a etapa 1. Implementar prazo civil/ordem/revisão com histórico, autor e notificações em ambos.
3. Prosseguir etapas 3–6, cada qual com testes, handoff e push antes de merge/deploy.

