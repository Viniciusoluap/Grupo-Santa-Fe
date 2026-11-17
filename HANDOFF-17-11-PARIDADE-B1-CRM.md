# HANDOFF 17/11 — Paridade bloco 1 (CRM, Usuários e acesso, Mapa operacional)

Branch: `claude/paridade17-b1-crm` (worktree `/home/user/sf-b1-crm`). Sem merge, sem PR, sem deploy.
Autorização: dono, 17/11. Fonte da verdade (Prospecta, só leitura): EPIC-023 S-A e S-B; commits `204ac53`, `2cf71ba`,
`2cb1fd2`, `8aacdcd`. Maquete 3D fica de fora (decisão do dono).

## Situação por item

| # | Item | Situação | Commit |
|---|------|----------|--------|
| 1 | CRM no iPad (altura do viewport, só cartões rolam, arrasto lateral sobre o cartão) | Concluído | ver `git log` |
| 2 | Corretores em "Usuários e acesso" + remoção da tela + colaborador sem acesso | Pendente | — |
| 3 | Filtro por perfil em "Usuários e acesso" | Pendente | — |
| 4 | Mapa operacional no MapLibre | Pendente | — |

### Item 1 — CRM no iPad
- `web/src/app/admin/leads/_components/leads-client.tsx`: no quadro (kanban), a raiz tem a altura do viewport
  menos a barra do topo (h-14) e o respiro do `<main>` (p-4 / md:p-6): `h-[calc(100dvh-5.5rem)]` /
  `md:h-[calc(100dvh-6.5rem)]`, `overflow-y-auto overscroll-none relative`. Na lista (tabela) nada muda.
- `web/src/components/crm/lead-kanban.tsx`: trilho `relative min-h-0 flex-1 touch-pan-x overflow-x-auto
  overflow-y-hidden overscroll-contain`; colunas `flex h-full flex-col`; lista de cartões `relative min-h-0 flex-1
  overflow-y-auto overscroll-y-contain`, **sem touch-action** (arrasto lateral volta ao trilho, Prospecta 2cf71ba).
- Diferença de layout própria do Santa Fé: a faixa "A CLASSIFICAR" (só existe aqui, fora das colunas) ganhou
  `max-h-[40%]` com rolagem própria, para não empurrar o quadro para fora da tela.
- Teste novo: `web/src/lib/__tests__/crm-ipad-layout.test.ts` (3 cenários, render estático).

## Testes
- (a) Automáticos: `crm-ipad-layout.test.ts` 3/3; `crm-pipeline.test.ts` passou; `tsc --noEmit` sem erros; eslint
  sem achados nos 3 arquivos.
- (b) Manuais: nenhum (sem navegador/iPad neste ambiente).
- (c) Pendente em produção: uso real no iPad (retrato e paisagem), como na Prospecta.

## Migração
Nenhuma até aqui.

## Próximo passo
Item 2 (corretores em "Usuários e acesso").
