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

## Paridade obrigatória Grupo Santa Fé ↔ Prospecta (REGRA ABSOLUTA — estabelecida pelo usuário em 08/09/2026)

**Esta regra tem prioridade máxima e vale nos dois repositórios (Grupo Santa Fé e Prospecta).**
Está duplicada, com o mesmo texto, em `Prospecta/CLAUDE.md`.

**Toda vez que o usuário pedir uma funcionalidade, correção ou processo em qualquer um dos
dois sistemas (Grupo Santa Fé ou Prospecta), a mesma função tem que existir e se comportar
igual no outro sistema também** — não é opcional, não depende de o usuário pedir explicitamente
nos dois lugares. As duas plataformas são a mesma operação (construção/imóveis financiados) em
duas cidades e devem permanecer espelhadas.

**Únicas exceções permitidas** — as diferenças que já existem hoje, documentadas em
`Prospecta/docs/stories/epics/ROADMAP.md`:
- Landing page e layout público de cada site (visual/institucional, não regra de negócio).
- Ecossistema de sorteios do Prospecta (`draws`, `tickets`, `utefBalances`, `utefTransactions`,
  `products`, `productConversions`) — exclusivo do Prospecta, sem equivalente no Santa Fé.
- Nomes/stack técnica de cada repositório (Next.js/Prisma no Santa Fé, Vite/Express/tRPC/Drizzle
  no Prospecta) — a regra de negócio deve ser a mesma, a implementação técnica pode diferir
  para se adequar à stack de cada lado.

**Nenhuma outra exceção deve ser assumida ou inventada.** Se uma nova diferença genuína for
necessária, ela precisa ser registrada explicitamente (com justificativa) no ROADMAP do
Prospecta antes de ser tratada como exceção — nunca implementada silenciosamente como "só faz
sentido de um lado".

**Na prática, isso significa:**
- Ao implementar algo no Grupo Santa Fé, verificar se o Prospecta já tem o equivalente; se não
  tiver, registrar como pendência/epic/story no ROADMAP do Prospecta para portar.
- Ao implementar algo no Prospecta que se originou de um pedido novo (não presente ainda no
  Santa Fé), avaliar se o Santa Fé também precisa da mesma funcionalidade e sinalizar isso ao
  usuário/à sessão responsável pelo Santa Fé.
- Nunca tratar uma funcionalidade como "exclusiva" de um dos lados sem que essa exclusividade já
  esteja listada nas exceções acima ou explicitamente autorizada pelo dono do produto.
