# S-02 — Etapa 2 (2/N): escopo de recursos quebrado (contratos/comissões)

**Status:** Done
**Contexto:** segundo incremento da Etapa 2 (autenticação/sessões/RBAC) da auditoria
integral Prospecta ↔ Grupo Santa Fé (handoff Codex). Cobre o item "páginas admin
confiando só no gate raso do layout, sem revalidar escopo/papel na própria consulta de
dados" e o item "comissões: corretor vê botões de criar/editar/excluir que o servidor
deveria rejeitar".

## Problema confirmado

`AdminLayout` (`src/app/admin/layout.tsx`) só bloqueia `role === "cliente"`. Qualquer
outro papel autenticado (`admin`, `corretor`, `colaborador`) passa e chega em **qualquer**
rota `/admin/*` — a sidebar (`src/components/admin/sidebar.tsx`) filtra links por
`adminOnly` só na navegação (client-side); nada impedia acessar a URL diretamente.
Verificado item a item nas páginas e nas server actions (não apenas aceito do handoff):

1. **`/admin/contratos` — marcado `adminOnly: true` na sidebar, mas sem nenhuma
   checagem de papel no servidor.** `ContratosPage` listava **todos** os contratos sem
   `auth()`/`requirePageRole`; as 6 actions em `src/lib/actions/contratos.ts`
   (`criarContrato`, `editarContrato`, `excluirContrato`, `salvarContratoAssinado`,
   `alterarStatusContrato`) só checavam `if (!session)`. Qualquer usuário autenticado —
   inclusive um corretor, que nem deveria ver o link — conseguia ler, editar e **excluir**
   qualquer contrato da empresa navegando direto para a URL.
2. **`/admin/comissoes` — sem escopo por corretor E sem restrição de mutação.**
   `ComissoesPage` buscava **todas** as comissões de **todos** os corretores
   (`prisma.comissao.findMany({})`, sem filtro), diferente de `leads`, `imoveis` e
   `agenda` (que já escopavam por `corretorId` quando `role === "corretor"` — código
   correto, verificado). Pior: `src/lib/actions/comissoes.ts` (`criarComissao`,
   `editarComissao`, `excluirComissao`, `alterarStatusComissao`) também só checava
   `if (!session)`. Na prática, **qualquer corretor logado podia ver a comissão de
   qualquer colega, reatribuir uma comissão para si mesmo (campo `corretorId` livre no
   formulário), alterar o valor, e — o mais grave — marcar a própria comissão como
   `"paga"` (autoaprovação de pagamento)**. Isto é mais grave do que o handoff descreveu
   ("botões que o servidor deveria rejeitar" — na realidade o servidor não rejeitava
   nada; nem o cliente escondia os botões, `comissoes-client.tsx` não tinha nenhuma
   lógica de papel).
3. **`financiamentos` — investigado e descartado como falso positivo.** O schema tem
   `Financiamento.corretorId`, mas nenhuma tela (`criarFinanciamento` e o formulário de
   criação) jamais preenche esse campo — é sempre `null` na prática. A sidebar não marca
   a seção como `adminOnly`. Ou seja, hoje `financiamentos` é uma lista operacional
   compartilhada por toda a equipe, não um recurso por-corretor — não há comportamento
   quebrado aqui para corrigir. Escopar por `corretorId` agora **inventaria** uma regra
   de negócio nova (nenhum corretor jamais usou esse campo), violando o Artigo IV (No
   Invention) da Constitution do AIOX. Registrado como investigado, não como pendência.

## Correção implementada

- **`src/app/admin/contratos/page.tsx`**: `requirePageRole(session, "admin")` antes de
  consultar `prisma.contrato.findMany` — agora o servidor aplica a mesma regra que a
  sidebar já sugeria visualmente.
- **`src/lib/actions/contratos.ts`**: as 6 actions trocaram `if (!session) throw` por
  `requireActionRole(session, "admin")`.
- **`src/app/admin/comissoes/page.tsx`**: a consulta de `comissao.findMany` agora usa
  `where: isCorretor && corretorId ? { corretorId } : {}` — mesmo padrão já usado em
  `leads`/`imoveis`/`agenda`. Página passa `isAdmin` para o client component.
- **`src/lib/actions/comissoes.ts`**: as 4 actions (`criarComissao`, `editarComissao`,
  `excluirComissao`, `alterarStatusComissao`) trocaram `if (!session) throw` por
  `requireActionRole(session, "admin")` — toda mutação de comissão (criar, editar,
  excluir, mudar status/aprovar pagamento) passou a ser exclusiva de admin. Um corretor
  pode **ver** as próprias comissões (transparência sobre o que tem a receber), mas não
  pode alterá-las — evita autoaprovação de pagamento e reatribuição.
- **`comissoes-client.tsx`**: recebe `isAdmin`; esconde o botão "Nova Comissão", as ações
  de editar/excluir e o `<select>` de status (substituído por um badge somente leitura)
  quando `isAdmin` é falso — a UI agora reflete exatamente o que o servidor permite, em
  vez de mostrar controles que resultariam em erro "Não autorizado" ao clicar (mesmo
  padrão de correção já aplicado em `usuarios-client.tsx` no incremento anterior).

## Grupo Santa Fé × Prospecta

Não se aplica paridade direta aqui — Prospecta não tem conceito de "corretor" com
recursos de negócio próprios (imóveis/comissões/contratos por corretor); seu RBAC é
`adminProcedure`/`protectedProcedure` já centralizado em `routers.ts` (migrado na Etapa 6
anterior, antes desta auditoria). Nenhuma pendência a registrar no ROADMAP do Prospecta.

## Gates

- `npx tsc --noEmit`: zero erros.
- `npx vitest run`: 31 arquivos, 288 testes aprovados — nenhuma regressão (nenhuma
  suíte existente cobria `comissoes.ts`/`contratos.ts`, então nenhum teste precisou
  mudar; o comportamento novo é coberto pelas funções `requirePageRole`/
  `requireActionRole` já testadas em `rbac.test.ts`).
- `npx eslint .`: 39 problemas (17 erros, 22 avisos) — **idênticos antes e depois**
  (mesma baseline documentada desde a Etapa 2 anterior), nenhum nos arquivos alterados.
- `git diff --check`: aprovado.
- Sem migração de banco nesta entrega (mudança é só de autorização em código, nenhum
  campo de schema novo).

**Não testado nesta sessão:** build completo do Next.js (`npm run build`) — mesma
limitação de `DATABASE_URL` ausente neste sandbox, já documentada nos checkpoints
anteriores desta auditoria.
