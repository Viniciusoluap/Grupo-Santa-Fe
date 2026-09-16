# S-08 — BPO: sub-rotas `[id]` e `novo` sem guarda de servidor

## Contexto

Ao concluir S-07, foi feita uma varredura de confirmação em todos os módulos com
`adminOnly: true` no sidebar para garantir que a reconciliação C2 desta auditoria (Etapa 4-5)
estava de fato completa — não apenas nos módulos onde já se sabia haver problema. A varredura
cobriu `relatorios`, `incorporacao`, `contabilidade`, `contratos`, `configuracoes`, `bpo`,
`avaliacoes` e `juridico`.

`relatorios`, `contabilidade`, `contratos` e `configuracoes` não têm sub-rotas — apenas o
`page.tsx` de topo, já guardado. `incorporacao` e `avaliacoes` têm sub-rotas, mas todas já
tinham `requirePageRole` (incorporação corrigida junto com Etapa 6/C2 anteriores; avaliações
corrigida na S-05). `juridico` tem apenas o `page.tsx` de topo.

**`bpo` foi o único módulo restante com o mesmo padrão de lacuna já visto em S-05 e S-07:** a
listagem (`/admin/bpo`) tinha `requirePageRole(session, "admin")` desde a correção C2 anterior,
mas as duas sub-rotas não:
- `src/app/admin/bpo/[id]/page.tsx` (detalhe do cliente BPO — nome, telefone, e-mail,
  lançamentos financeiros).
- `src/app/admin/bpo/novo/page.tsx` (cadastro de novo cliente BPO) — este arquivo nem sequer era
  uma função `async`, ou seja, nunca teve qualquer possibilidade de checar sessão.

Além disso, `src/lib/actions/bpo.ts` tinha a mesma lacuna de sempre nas 6 Server Actions
(`criarBpoCliente`, `criarLancamentoBpo`, `marcarLancamentoPago`, `criarCobranca`,
`pagarLancamento`, `atualizarStatusBpoCliente`): apenas `if (!session) throw new Error("Não
autorizado")`, sem checar papel.

## Exploração confirmada

Um `corretor`/`colaborador` autenticado conseguia acessar diretamente `/admin/bpo/{id}` (dados
financeiros e de contato de clientes de BPO) e `/admin/bpo/novo`, e chamar todas as 6 Server
Actions do módulo (criar clientes, lançar cobranças, marcar como pago) sem ter papel de admin —
apesar do módulo estar marcado `adminOnly` no menu.

## Correção aplicada

- `src/app/admin/bpo/[id]/page.tsx` — adicionado `const session = await auth();
  requirePageRole(session, "admin")`.
- `src/app/admin/bpo/novo/page.tsx` — convertido de função síncrona para `async function`, com o
  mesmo guard adicionado antes do `return`.
- `src/lib/actions/bpo.ts` — as 6 Server Actions trocaram `if (!session) throw new
  Error("Não autorizado")` por `requireActionRole(session, "admin")`.

## Gates executados

- `npx tsc --noEmit` → limpo.
- `npx vitest run` → 299/299 testes passando, zero regressão.
- `npx eslint .` → 39 problemas (17 erros, 22 warnings), idêntico ao baseline, zero regressão.

## Paridade obrigatória (Grupo Santa Fé ↔ Prospecta)

Verificado diretamente `server/routers.ts` (bloco `bpo`, linhas ~1440-1525): todo procedure é
`adminProcedure` (que já valida papel/permissão "bpo" via `procedureModules` em
`server/_core/trpc.ts`) ou `protectedProcedure` com `requireRole(ctx, ["admin"])` explícito no
handler (`clientes.create`, `clientes.updateStatus`). Não há equivalente de "página sem guard"
no modelo tRPC do Prospecta — o próprio roteamento nega a chamada antes de qualquer lógica.
Nenhum gap de paridade encontrado.

## Status

Correção implementada, testada localmente e implantada em produção.

## Encerramento

- **PR:** [#136](https://github.com/Viniciusoluap/Grupo-Santa-Fe/pull/136) — aberto como draft,
  sem falhas de CI (único check é o deploy Vercel, `success`), `mergeable_state: "clean"`.
  Un-drafted e squash-merged em `main` como commit `3b627830b6bd18f763f2ec4820d8f4ee0ed1c3a7`.
- **Deploy de produção:** `dpl_Bj3m1CPVwffdmtjyB287myaKEfHX`, `readyState: "READY"`, publicado
  em `gruposantafee.com.br` / `www.gruposantafee.com.br`.
- **Runtime errors:** zero erros nas últimas 24h (`get_runtime_errors`, projeto
  `prj_W8c9sow2dxFO5GDfqABwlKWodI1v`) após o deploy.
- Branch local `codex/auditoria-correcao-20260914` reconstruída a partir de `origin/main` e
  sincronizada com o branch remoto homônimo.
- Com este achado, a varredura de confirmação de C2 (todo módulo `adminOnly` do sidebar
  realmente protegido no servidor, listagem e sub-rotas) está completa para o Grupo Santa Fé.
