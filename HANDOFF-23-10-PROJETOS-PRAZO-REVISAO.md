# HANDOFF 23/10 — Etapa 2 Projetos (prazo, ordem e revisão)

## Bases e isolamento
- Prospecta: `origin/main` / `c0077571d208bfc30834bd0d0a1a11aa6ae97457`, branch `codex/projetos-prazo-revisao-20261023`, worktree isolada `prospecta-projetos`.
- Santa Fé: `origin/main` / `793a4cbcc4a558bb8703e3b8330799db510dce7f`, mesma branch em `santa-fe-projetos`.
- Subetapas A/B publicadas no GitHub: Prospecta `ee28bd4b0c78b9d68b0183c8a4b60971e5662918` PR #158; Santa Fé `84ccbe26d77548df4317a70f7af0e43e725df91b` PR #221. Ambos rascunhos. Commits Git locais equivalentes `747ece5` e `b62fdc4`.
- Ambos limpos ao criar a worktree. Etapa 1 está em PRs separados Prospecta #157 e SF #220; não misturar branches. Claude pode avançar em paralelo. Novo fetch/revisão de PRs antes de integrar.

## Subetapa 2A/B — prazo civil e ordenação
- `projetos-prazo.ts` (compartilhado por regra): persiste uma data informada em UTC meio-dia; lê legados com horário no calendário de America/Fortaleza, com exceção do antigo UTC 00:00 que representa data ISO sem hora. Formata DD/MM/AAAA sem exibir hora. Valida dia real.
- Lista ordenada pelo prazo ascendente (vencidos, hoje, futuros), empates por ID, sem prazo ao fim. Busca/filtro atuam antes da ordenação e não a quebram. A data de hoje é implícita na ordem cronológica; não depende do timezone do navegador.
- Prospecta: `shared/projetos-prazo.ts`, `server/projetos-prazo.test.ts`, `client/src/pages/admin/AdminProjetos.tsx` (input date, leitura/exibição/ordem).
- Santa Fé: `web/src/lib/projetos-prazo.ts` e teste; `web/src/lib/actions/projetos.ts`; lista, detalhe e edição em `web/src/app/admin/projetos`.
- Nenhuma migração para prazo: mantém coluna DateTime/timestamp existente para compatibilidade.

## Testes
- (a) automáticos: Vitest 2/2 em cada repo; casos de dia, horário legado, timezone, data inválida, empate e sem prazo. Prospecta `pnpm check` e build passaram. Santa Fé `prisma generate`, `tsc --noEmit` e ESLint dos arquivos tocados passaram (três avisos preexistentes de variável não usada). Build SF ainda não repetido nesta branch; na etapa 1 ele compilou e falhou apenas no pré-render da home por falta de Postgres local.
- (b) manuais: não realizados.
- (c) produção: conferir prazo real legado com horário, vencido/hoje/futuro/sem prazo e salvamento/edição nos dois sistemas.
- Risco: um horário legado exatamente 00:00 UTC é interpretado como o próprio dia UTC; é indistinguível de uma data ISO legada. Um registro criado originalmente no fim da noite de Fortaleza e gravado exatamente 00:00 UTC requer conferência pontual.

## Subetapa 2C — ainda pendente
- Criar tabela de solicitações de revisão com ID do projeto, autor, texto, data, estado e entrega do colaborador; migrações em ambas as stacks.
- Validar engenheiro vinculado por ID e e-mail; registrar pedido mesmo quando envio de e-mail falhar, com estado de entrega do canal independente. Notificação interna endereçada ao engenheiro. Sem engenheiro/e-mail, explicar e não alegar envio.
- Mostrar histórico de pedidos e entregas no card do projeto e permitir upload da versão revisada pelo engenheiro no Drive com vínculo à solicitação; não sobrescrever arquivos anteriores.
- Verificar permissões de colaborador e rota de upload; testar notificação/e-mail e falhas.
- Depois, seguir etapas 3–6 em branches próprias com handoff a cada etapa. Merge/deploy ainda não foram feitos.

