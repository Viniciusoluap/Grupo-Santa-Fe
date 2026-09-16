# S-07 — Agregador/Obras/Projetos/Regularização: sidebar `adminOnly` sem guarda real

## Contexto

Durante a reconciliação C1/C2 da Etapa 4-5 (auditoria integral), ao verificar se as flags
`adminOnly: true` do sidebar (`src/components/admin/sidebar.tsx`) tinham um gate de servidor
correspondente, foi descoberto que **quatro módulos inteiros** dependiam apenas do sidebar
client-side para "esconder" a navegação, sem nenhuma verificação real no servidor:

- **Agregador** (`/admin/agregador`)
- **Obras** (`/admin/obras`)
- **Projetos** (`/admin/projetos`)
- **Regularização** (`/admin/regularizacao`)

O único gate de servidor existente é `src/app/admin/layout.tsx`, que bloqueia apenas
`role === "cliente"` — ou seja, `corretor` e `colaborador` atravessavam livremente qualquer
uma dessas páginas e Server Actions, apesar de a UI escondê-las do menu.

Este é o mesmo padrão de vulnerabilidade já identificado e corrigido em S-01/S-02 (identidade e
escopo do corretor), S-05 (avaliações) e C2 (bpo/avaliações/jurídico) nesta mesma epic — mas
nunca havia sido auditado especificamente para estes quatro módulos.

## Exploração confirmada

Um usuário autenticado com role `corretor` ou `colaborador` conseguia, sem nenhuma restrição:
- Ler e mutar `AgregadorImovel` (importar/atualizar status/catálogo).
- Criar, editar, excluir `Obra` e seus diários.
- Criar, editar, excluir `Projeto`, alterar status, salvar checklist/arquivos.
- Criar, editar, excluir `Regularizacao` e seus documentos, alterar status.

Nenhum desses dados é de propriedade ou escopo do corretor — são operações administrativas.

## Correção aplicada

Seguindo o padrão já estabelecido (`requirePageRole`/`requireActionRole` de
`src/lib/auth/rbac.ts`), foi adicionado `const session = await auth(); requirePageRole(session,
"admin")` em toda página server-rendered dos 4 módulos, e `requireActionRole(session, "admin")`
em toda Server Action correspondente:

### Páginas (top-level, já tinham apenas 1 `page.tsx` cada)
- `src/app/admin/feeds/page.tsx`
- `src/app/admin/agregador/page.tsx`
- `src/app/admin/obras/page.tsx`
- `src/app/admin/projetos/page.tsx`
- `src/app/admin/regularizacao/page.tsx`

### Sub-rotas (mesmo padrão de gap encontrado em S-05: a listagem tinha o guard, os
sub-`page.tsx` de detalhe/edição/criação, não)
- `src/app/admin/obras/[id]/page.tsx`
- `src/app/admin/obras/[id]/editar/page.tsx`
- `src/app/admin/obras/novo/page.tsx`
- `src/app/admin/projetos/[id]/page.tsx`
- `src/app/admin/projetos/[id]/editar/page.tsx`
- `src/app/admin/projetos/novo/page.tsx`
- `src/app/admin/regularizacao/[id]/page.tsx`
- `src/app/admin/regularizacao/[id]/editar/page.tsx`
- `src/app/admin/regularizacao/novo/page.tsx`

Confirmado via `find`: `feeds` e `agregador` não têm sub-rotas — apenas o `page.tsx` de topo,
já corrigido.

### Server Actions
- `src/lib/actions/agregador.ts` (3 funções: `atualizarStatusAgregador`,
  `criarAgregadorImovel`, `importarParaCatalogo`)
- `src/lib/actions/agregador-xml.ts` (3 funções: `executarAgregacao`, `salvarFeedsAgregador`,
  `getFeedsAgregador`)
- `src/lib/actions/obras.ts` (4 funções: `criarDiarioObra`, `criarObra`, `excluirObra`,
  `editarObra`)
- `src/lib/actions/projetos.ts` (7 funções: `alterarStatusProjeto`, `salvarChecklistProjeto`,
  `salvarArquivosProjeto`, `alterarStatusProjetoFromDetail`, `criarProjeto`, `excluirProjeto`,
  `editarProjeto`)
- `src/lib/actions/regularizacao.ts` (5 funções: `alterarStatusRegularizacao`,
  `adicionarDocumentoReg`, `atualizarStatusDocumento`, `excluirDocumentoReg`,
  `criarRegularizacao`)
- `src/lib/actions/regularizacoes.ts` — arquivo separado (plural), mesmo domínio, mesmo gap
  (3 funções: `criarRegularizacao`, `excluirRegularizacao`, `editarRegularizacao`)

Todas as Server Actions trocaram `if (!session) throw new Error("Não autorizado");` (que só
verificava autenticação, não role) por `requireActionRole(session, "admin")` (que verifica
autenticação E role).

### Não precisou de correção
- `src/app/admin/corretores/page.tsx` — já tinha verificação manual de role correta.
- `comissoes`, `financiamentos`, `whatsapp` — corretamente NÃO marcados `adminOnly`, pois
  corretor tem acesso legítimo e escopado a esses módulos (já auditado em sessões anteriores).

## Gates executados

- `npx tsc --noEmit` → limpo, zero erros.
- `npx vitest run` → 299/299 testes passando (32 arquivos), zero regressão.
- `npx eslint .` → 39 problemas (17 erros, 22 warnings), idêntico ao baseline pré-existente e
  não relacionado a estas mudanças — zero regressão introduzida.

## Paridade obrigatória (Grupo Santa Fé ↔ Prospecta)

Verificado diretamente o código-fonte de `server/routers.ts` no Prospecta (não apenas por
memória) para os dois domínios equivalentes:

- **`construction` (obras)** — todo procedure (`createProject`, `updateProject`,
  `deleteProject`, `createStage`/`updateStage`/`deleteStage`, `uploadPhoto`/`deletePhoto`) é
  `protectedProcedure` com checagem de posse em cada handler: `project.userId !== ctx.user.id
  && ctx.user.role !== "admin"` → `FORBIDDEN`. Isso é correto e **não é o mesmo modelo de
  negócio** do "Obras" do Santa Fé: no Prospecta, `construction` é a obra do próprio cliente
  (o usuário do portal acompanha a construção da sua casa), então a checagem correta é
  posse-ou-admin, não admin-only. `allProjects` (listar todas) já usa `requireRole(ctx,
  ["admin"])`. Não há gap — o padrão de proteção é o esperado para o modelo de dados.
- **`budgetRequests` (equivalente a Projetos/orçamentos)** — `getAll`, `getById`, `update`,
  `delete`, `getStats` chamam `requireRole(ctx, ["admin"])` explicitamente. Sem gap.

Prospecta não possui equivalente direto a "Agregador" e "Regularização" como módulos
separados: agregador de imóveis no Prospecta está coberto por
`imovel-feeds.ts`/`imovel-scraper.ts` (já auditados na Etapa 3, com proteção `isSsrfUrl` e
rotas públicas por design onde aplicável); regularização de imóveis não tem equivalente
funcional no Prospecta hoje. Não é uma exceção nova a registrar no ROADMAP — é simplesmente
escopo de negócio que o Prospecta ainda não implementou, fora do escopo desta correção de
segurança.

**Conclusão:** nenhum gap de paridade encontrado para este achado específico.

## Status

Correção implementada e testada localmente. Aguardando commit/push/PR/merge/deploy conforme
protocolo padrão desta auditoria.
