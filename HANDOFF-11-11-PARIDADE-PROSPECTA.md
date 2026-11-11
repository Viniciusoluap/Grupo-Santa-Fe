# Handoff — Paridade com a Prospecta (11/11)

Pedido do dono: levar ao Santa Fé tudo o que foi feito na Prospecta (regra de paridade). Autorizado em 11/11.
Ordem combinada: (1) Vias públicas + rua por lados; (2) Due Diligence (setas, Anexar, anexos de qualquer tipo);
(3) motor de parcelamento e tipologias; (4) Mercado e Viabilidade. Um PR por bloco.

## Bloco 1 — Vias públicas e rua por lados (este PR)
O motor `web/src/lib/geo/massa-parcelamento.ts` do Santa Fé era idêntico ao da Prospecta antes do PR #195 de lá;
os módulos foram trazidos da Prospecta (mesma regra; só os caminhos de import mudam):
- `web/src/lib/geo/rua-divisa.ts` (extras: ocupados, fundo variável, sem via, redivisão por área)
- `web/src/lib/geo/lados-gleba.ts` (rua de cima/esquerda/direita/baixo, combináveis)
- `web/src/lib/geo/vias-publicas.ts` e `vias-publicas-faixas.ts` (tipologia Vias públicas; desenho em faixas como o
  memorial aprovado do Lote 01 Qd O — 60 lotes; transcrição em `docs/referencias/memorial-lote01-qdo-60-lotes.md`)
- `web/src/lib/geo/massa-parcelamento.ts` (tipologia `vias_publicas`, `ladosVia`)
- `web/src/lib/geo/massa.ts` (tipologia nova e `ladosVia` no tipo; vias públicas vai para o motor v2)
- `web/src/app/admin/incorporacao/_components/massa-tab.tsx`: 4 caixas (rua de cima/esquerda/direita/baixo, com o
  comprimento medido) no lugar de "Trocar rua de lado"; Vias públicas roda no motor v2 (worker, com progresso);
  texto de ajuda com a regra do dono (só frente ≥ testada e área ≥ mínima; profundidade é referência; sem sobras).
- Testes: `web/src/lib/__tests__/massa-lados-via-v2.test.ts`, `massa-vias-publicas-v2.test.ts` (+ fixtures).

## Testes
- (a) automáticos: suíte completa do web 160 arquivos passando (28 pulados, como antes); typecheck limpo; eslint
  limpo nos arquivos novos (2 erros de lint antigos, já existentes no main, não mexidos: `let brutos` e
  `Date.now()` em massa-tab). `next build` compilou; parou na geração estática por falta de banco no ambiente.
- (b) manuais: nenhum ainda neste repositório.
- (c) produção: pendente — após merge/deploy, abrir um estudo com KML e testar Vias públicas e os 4 lados.

## Próximo passo exato
Bloco 2: Due Diligence (setas ↑↓ em tarefas/documentos, Anexar com alterações pendentes, anexos de qualquer tipo
até 50 MB em partes) — comparar `web/src/lib/incorporacao/due-diligence.ts`, a aba de Due Diligence e as rotas de
documentos do Santa Fé com a Prospecta (PRs #197 e #199 de lá).
