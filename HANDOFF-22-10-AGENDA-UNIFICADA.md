# Handoff — agenda unificada — 22/10/2026

Branch: `codex/agenda-unificada-20261022`, criada de `main` `24a91aa`. Trabalho somente no worktree `Grupo-Santa-Fe-agenda-unificada`; alterações antigas em outros worktrees preservadas.

## Concluído
- Calendário e lista inferior passam a usar a mesma união de leads, tarefas e agendamentos. Dia com nove cards passa a listar nove registros; dia com cards e tarefa inclui ambos.
- Filtro Exibir permite Data selecionada, Leads vencidos, Leads do dia, Leads a vencer e Todas as tarefas. A última opção inclui sem prazo/encerradas e só aparece mediante seleção explícita. Clicar um dia volta para data; mês seleciona dia 1.
- Removidas as listagens paralelas redundantes. Controles de visitas e status/prazo individual de tarefa mantidos. Sem migração ou alteração de permissões.
- AIOX/IDS, critérios e limitações documentados em `docs/stories/2026-10-22-agenda-unificada.md`.

## Testes
(a) 7 testes focais aprovados (5 helper e 2 SSR do componente real); ESLint focal aprovado; lint completo passou (0 erros/29 avisos preexistentes); diff check aprovado. `typecheck` não existe; `tsc` local bloqueado por types React/Node ausentes no node_modules compartilhado.
(b) QA independente aprovado, incluindo nove cards na lista e cenário misto, também com fuso America/Fortaleza; navegador autenticado não executado.
(c) Pendente build Vercel com dependências completas e homologação autenticada em produção.

## Próximo passo
DevOps AIOX deve fazer commit/push, confirmar prévia e seguir merge/deploy autorizado. Atualizar este handoff com commits e URLs antes de encerrar. Paridade Prospecta revisada. Nenhum commit/push foi feito pelo Dev. CLI CodeRabbit e tasks/checklists `.aiox-core` indisponíveis; revisão independente e testes reais usados, com build Vercel obrigatório antes do merge.
