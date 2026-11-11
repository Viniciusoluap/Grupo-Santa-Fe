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

## Bloco 2 — Due Diligence (mesmo PR #252, branch única da sessão)
- `web/src/lib/incorporacao/due-diligence.ts`: `moverItem`; aba com setas ↑ ↓ em tarefas e documentos.
- "Anexar" abre sempre o seletor; com alterações pendentes, salva antes de enviar ("Enviando..." no item).
- Anexos de qualquer tipo (foto/HEIC, DWG, Word, Excel, ZIP...) até 50 MB, na Due Diligence e no Registro:
  `web/src/lib/incorporacao/anexos.ts` (gêmeo do da Prospecta), `anexos-cliente.ts` (envio direto até 3 MB;
  acima, partes de 2 MiB por `/api/envio`), ações `enviarParteDocumentoRegistro`/`finalizarDocumentoRegistro`,
  rota `/api/incorporacao/documentos/[id]` com `?parte=N` (banco por `substring`, Drive por Range) e
  download com o nome original para tipos que não abrem no navegador (HTML/SVG nunca abrem: CSP sandbox).
  PDF/JPG/PNG/WebP sem assinatura válida ficam como arquivo genérico.
- **Migração `web/prisma/migrations/20261111180000_anexos_em_partes`** (só cria `estudo_documento_partes`):
  aplicar no banco de produção antes do deploy.
- Testes: `web/src/lib/__tests__/anexos-qualquer-tipo.test.ts` (8: tipos, mover, DWG 5 MiB em 3 partes íntegro,
  recusas, Word direto, migração idempotente em PGlite). Suíte: 161 arquivos passando (28 pulados).

## Próximo passo exato
Com autorização do dono: aplicar a migração `20261111180000_anexos_em_partes` no banco do Santa Fé, mergear o
PR #252 e conferir o deploy. Depois, bloco 3: motor de parcelamento e tipologias (grade e cul-de-sac do Santa Fé
ainda usam o motor genético antigo em `web/src/lib/geo/massa.ts`; a Prospecta usa o motor v2 para todas), desenho
técnico com Satélite, área viária manual — levantar item a item contra o ROADMAP da Prospecta.
