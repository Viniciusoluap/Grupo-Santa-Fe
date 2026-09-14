# Checkpoint — C2: Navegação e acessos visuais

**Data:** 14/09/2026
**Status:** Concluída após validação local (TypeScript, testes)
**Escopo:** conferir menus/painel administrativo/links internos, corrigir acesso a
Relatórios/Agregador/Agenda/Projetos/Mapa/Comissões, validar menu mobile

## Método

Auditoria completa (somente leitura) da navegação administrativa: rotas (`app/admin/**`),
dashboard, sidebar (`src/components/admin/sidebar.tsx`), menu público (`navbar.tsx`) e menu
mobile, além de uma checagem cruzada de qual camada de autorização protege cada rota (rota
Next.js/middleware vs guarda de página vs só ocultação de menu).

## Achados e correções aplicadas

| Achado | Severidade | Correção |
|---|---|---|
| `Relatórios`, `Agregador`, `Contabilidade`, `Contratos` têm tela funcional e rota, mas **nenhuma entrada de navegação** (só acessíveis digitando a URL) | Alto (descoberta) | Adicionadas 4 entradas em `src/components/admin/sidebar.tsx` (`navItems`), com `adminOnly: true` — mesmo padrão das demais entradas administrativas |
| `bpo`, `avaliacoes`, `juridico` ficam ocultos no menu (`adminOnly` na sidebar) mas **não têm nenhuma proteção real no servidor** — nem no middleware (`src/proxy.ts`), nem `requirePageRole` na própria página. Qualquer usuário autenticado (`corretor`, `colaborador`) acessava esses dados (financeiro, avaliações, contratos jurídicos) digitando a URL direta | **Alto (falha de segurança real)** | Adicionado `requirePageRole(session, "admin")` em `src/app/admin/bpo/page.tsx`, `src/app/admin/avaliacoes/page.tsx` e `src/app/admin/juridico/page.tsx`, replicando o padrão já usado em `relatorios/page.tsx`, `configuracoes/page.tsx`, `contabilidade/page.tsx` e `incorporacao/*` — **sem alterar** `src/proxy.ts` (middleware) nem `src/lib/auth/rbac.ts` (helper), apenas consumindo o contrato já existente |
| Menu mobile público (`navbar.tsx`): rolagem em `100dvh`, botão "Entrar" dentro da área rolável mas alcançável | Nenhuma | Nenhuma correção necessária — já está correto (ver "Situação sem correção" abaixo) |
| Rótulo "Lotes e Terrenos" duplicado no menu público (`/imoveis?type=lote` e `/servicos#lotes`) | Baixa | Não corrigido — são dois destinos válidos e propositalmente diferentes (catálogo filtrado vs seção descritiva do serviço), não é link quebrado. Registrado, sem ação. |

## Situação sem correção necessária (registrado conforme pedido)

- **Menu mobile:** `navbar.tsx:169` usa `overflow-y-auto max-h-[calc(100dvh-96px)]` — unidade
  dinâmica de viewport corretamente calculada, sem o bug clássico de `100vh` cortado por barras
  de navegador mobile. O botão "Entrar (Admin · Corretor · Cliente)" fica dentro do `<nav>`
  rolável, mas totalmente alcançável (há `pb-8` de respiro). **Nenhuma correção funcional
  necessária neste sistema** — ponto de referência positivo, inclusive comparado à Prospecta
  (onde o mesmo botão foi movido para um footer fixo nesta mesma rodada, por segurança extra).
- Nenhum link quebrado, `href="#"` real, TODO/FIXME ou rota inexistente encontrado.

## Encerramento

- **PR #119** mesclado (squash) em `main`, commit `6d9431c`.
- **Deploy de produção confirmado `READY`**: `dpl_8f6pYUuakDtEggz5mEur1MW3Hec8`
  (`prj_W8c9sow2dxFO5GDfqABwlKWodI1v`). Correção da nota anterior: este projeto **tem sim**
  um projeto Vercel configurado (descoberto ao verificar o deploy do PR) — não é uma
  limitação de ambiente como havia sido registrado antes de confirmar.
- Nenhum erro de runtime encontrado nas últimas 24h (`get_runtime_errors`).

## Gates

- TypeScript aprovado (`npx tsc --noEmit`, zero erros) — após `npm install` e
  `npx prisma generate`, necessários porque o ambiente desta sessão não tinha as dependências
  instaladas;
- Vitest: 29 arquivos, 275 testes aprovados — nenhuma regressão;
- ESLint: 39 problemas (17 erros, 22 warnings) — **idênticos ao baseline antes desta mudança**
  (confirmado via `git stash`/`git stash pop` comparando antes/depois); nenhum problema novo
  introduzido pelas 4 alterações desta entrega;
- `git diff --check` aprovado, sem erros de espaço em branco;
- **Build (`npm run build`) não pôde ser validado nesta sessão**: falha em
  `Can't reach database server at 127.0.0.1:5432` durante a pré-renderização estática da home
  — confirmado que essa falha já ocorre no baseline (sem as mudanças desta entrega), por falta
  de um banco Postgres acessível neste sandbox. Não é causada por este trabalho; não substituída
  por uma alegação de sucesso.
- `package-lock.json` foi atualizado pelo `npm install` para sincronizar com o `package.json`
  já existente (alguns pacotes estavam registrados como `devDependencies` no lockfile antigo,
  mas já eram `dependencies` reais no manifest) — nenhuma dependência nova foi adicionada.

## Não testado nesta sessão

Navegação real em navegador (sandbox sem acesso à internet externa) — mesma limitação já
documentada em checkpoints anteriores do Prospecta.
