# Regras do projeto Grupo Santa Fé (preferências do dono)

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
