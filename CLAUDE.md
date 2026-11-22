# Regras do projeto Grupo Santa Fé (preferências do dono)

## Escopo específico aprovado em 11/10/2026 — limpeza e CRM

O lote `codex/santa-fe-limpeza-crm-20261011` é exclusivamente do Grupo Santa Fé,
por instrução expressa do proprietário. A remoção de Dashboard, Central de
Gestão, Relatórios, Feeds XML, Agregador, Contabilidade e Contratos independente,
o novo pipeline operacional e a centralização dos quatro serviços no CRM não
devem ser propagados automaticamente a outro repositório. A Prospecta pode
ser consultada somente como referência. Esta exceção de escopo prevalece
sobre a regra geral de paridade para este lote. Merge, deploy e aplicação em
produção dependem da autorização final.

## Automação primeiro (REGRA PERMANENTE — estabelecida pelo usuário em 05/07/2026)

**Tudo deve ser automático. O usuário só faz algo manual se NÃO houver outra opção técnica.**

- NUNCA projete uma funcionalidade que dependa de o usuário configurar algo em painéis
  externos (Vercel, Supabase, provedores) se existir um caminho que o sistema resolva sozinho.
- Preferir soluções self-contained: armazenar arquivos no próprio banco e servir por rota
  autenticada em vez de exigir Blob Store público; aplicar migrations via código/MCP em vez
  de pedir SQL manual; ler variáveis já injetadas por integrações em vez de pedir env nova.
- Quando um passo manual for realmente inevitável, deixar isso EXPLÍCITO e reduzido ao mínimo,
  e sempre oferecer a alternativa automática primeiro.
- Ao relatar status, separar com honestidade: (a) testado automaticamente, (b) testado
  manualmente por mim, (c) ainda depende de validação em produção. Nunca dar como "100%
  funcional" o que não foi verificado de ponta a ponta.

## Sistemas independentes desde 22/11/2026 (decisão do dono)

Em 22/11/2026 o dono cancelou a obrigação de paridade entre Grupo Santa Fé e Prospecta. Cada sistema segue sua própria evolução. Novos portes entre os repositórios dependem de pedido específico do dono.

As referências anteriores à paridade neste arquivo e nos handoffs registram decisões históricas. As pendências de porte que estavam abertas foram canceladas por essa decisão. A frente do Jurídico da Prospecta segue somente no repositório da Prospecta.

## Handoff a cada etapa (REGRA PERMANENTE — estabelecida pelo usuário em 19/10/2026)

**Vale nos dois repositórios (Grupo Santa Fé e Prospecta) e para qualquer agente (Claude, Codex, AIOX).**

Ao concluir cada etapa de trabalho (não só no fim da tarefa), sempre:
1. Atualizar o HANDOFF da frente em andamento (ex.: `HANDOFF-18-10-MEDICOES-CAIXA.md`; se não houver, criar `HANDOFF-<dd-mm>-<assunto>.md` na raiz) com:
   - o que foi concluído (commits e arquivos principais);
   - pendências;
   - testes executados e resultados, separando (a) automáticos, (b) manuais e (c) pendentes de validação em produção;
   - o próximo passo exato para quem continuar.
2. Fazer commit e push na branch de trabalho, e confirmar que o push chegou ao GitHub antes de dizer que está salvo.

Objetivo: se os créditos acabarem no meio, outra sessão (Claude ou Codex) continua do ponto exato, sem perder trabalho.
