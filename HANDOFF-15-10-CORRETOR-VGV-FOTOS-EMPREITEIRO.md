# HANDOFF — 15/10/2026: corretor, VGV automático, fotos no Drive e portal do empreiteiro

> Documento de continuidade para o **Codex** (ou qualquer agente/humano). **Idêntico nos dois
> repositórios**: `Prospecta/HANDOFF-15-10-CORRETOR-VGV-FOTOS-EMPREITEIRO.md` e
> `Grupo-Santa-Fe/HANDOFF-15-10-CORRETOR-VGV-FOTOS-EMPREITEIRO.md`.
> Leia também `HANDOFF-32-IMPLEMENTACOES.md` (regras, ambientes e fórmulas). Este arquivo cobre
> só o que aconteceu em 15/10/2026 e o que ficou para fazer.
> Ao terminar cada etapa, atualize a seção 6 ("Estado atual") nos dois repositórios.

---

## 1. Regras do dono que continuam valendo (texto literal)

- "NÃO FAZER MERGE OU DEPLOY SEM AUTORIZAÇÃO EXPRESSA. Commits em branches de trabalho estão
  autorizados para persistência do progresso. Merge, deploy, alterações destrutivas em produção e
  mudanças de credenciais exigem autorização separada."
- "Não excluir registros de produção, executar migrações destrutivas ou substituir cálculos sem
  validação e autorização específica."
- "Não realizar force push… Não apagar trabalho de outros agentes."
- "Não registrar segredos nos logs." O JSON da conta de serviço do Google **nunca** deve ser pedido no chat.
- "Somente afirmar que o progresso está salvo no GitHub depois de confirmar a persistência remota."
- Falar com o dono **sempre em português do Brasil**.
- **Paridade absoluta** Prospecta ↔ Santa Fé (ver `CLAUDE.md` dos dois repositórios). Exceções:
  landing/layout público, sorteios da Prospecta, diferenças de stack.
- **Automação primeiro:** migrations aplicadas por código/MCP, nunca pedir SQL manual. Ao relatar,
  separar (a) testado automaticamente, (b) testado manualmente, (c) depende de validação em produção.
- Nunca mexer em branches `codex/*` que não sejam suas. Não colocar identificador de modelo em
  commits/PRs.

## 2. Ambientes

| | Prospecta | Grupo Santa Fé |
|---|---|---|
| Stack | Vite + Express + tRPC + Drizzle (raiz do repo) | Next 16 + Prisma (pasta `web/`) |
| Banco | Neon, projeto `plain-cake-26372935` | Supabase, projeto `giulchozonhzyopmgmkv` |
| Vercel | `prj_hVT5OCL8S5GbJ5L0GArH9aDxbFHR` | `prj_W8c9sow2dxFO5GDfqABwlKWodI1v` |
| Time Vercel | `team_0ACtTLoM4VLMrijmyLUPafHy` | mesmo |
| Branch de trabalho do Claude | `claude/sync-mirrored-repos-bsqnz3` | mesma |

## 3. O que foi publicado em 15/10/2026 (merge + deploy confirmados)

| Repo | PR | Commit em `main` | Deploy de produção |
|---|---|---|---|
| Prospecta | #125 (squash) | `56b2473` | `dpl_HTJxUNnq3mLhuw5EE6rV4ufJ2Lm1` — READY |
| Santa Fé | #192 (squash) | `ab4dc4c` | `dpl_52w5kteDTro2s4ZPyNNqxZjHsiR3` — READY |

Depois do merge, a branch `claude/sync-mirrored-repos-bsqnz3` foi realinhada com `main` sem force
push (Prospecta `f17281e`, Santa Fé `3a3bbcb`).

### 3.1 Funcionalidades entregues (nos dois sistemas)

1. **Modais no iPad/celular**: todo diálogo tem altura máxima e rolagem interna, então os botões do
   rodapé (ex.: "Novo Lead") não somem.
   - Prospecta: `client/src/components/ui/dialog.tsx` e `alert-dialog.tsx`.
   - Santa Fé: modais em admin-shell, bpo, contrato-documentos, usuários e corretores.
2. **Acesso do corretor**:
   - acompanhamento das etapas dos **próprios** leads, somente leitura, régua das 7 etapas;
   - agenda sem os campos Corretor/Colaborador, com "Nome do cliente sem lead";
   - tipo de imóvel por lista fechada (casa, apartamento, lote, sala comercial, galpão);
   - preço com máscara R$ 1.000.000,00;
   - fotos pela galeria/arquivo (sem `capture`), comprimidas no aparelho, até 15;
   - logo e nome centralizados no cabeçalho;
   - comissões das obras visíveis para o corretor.
   - Prospecta: `server/broker-portal-router.ts`, `shared/broker-portal.ts`, `client/src/pages/BrokerPortal.tsx` e `AdminAgenda.tsx`.
   - Santa Fé: `src/lib/portal-corretor.ts`, `src/app/admin/meus-clientes/page.tsx`, `agenda-client.tsx`, `src/lib/actions/agenda.ts` e `comissoes/page.tsx`.
3. **Máscara de dinheiro padronizada** (`CurrencyInput`): milhar ao digitar, cursor preservado,
   2 casas. Textos de valor também passaram a 2 casas (`formatCurrency`): site, admin, e-mails, WhatsApp e mapa.
4. **VGV automático**: a obra ligada a um lead usa o **Valor Aprovado** do lead como VGV. O campo VGV
   da obra fica somente leitura ("VGV (R$) · automático"). Ao alterar o valor aprovado no lead, a
   obra e a comissão do corretor são recalculadas.
   - Prospecta: `sincronizarVgvDoLead` em `server/obra-financeiro-router.ts`, chamada por `leads.update`.
   - Santa Fé: `src/lib/financeiro/vgv-lead.ts`.
   - Decisão do dono em conflito: **"Vale o VGV da obra"**. Na migração, o VGV da obra foi copiado para o valor aprovado do lead.
5. **Fotos de imóveis no Google Drive**, na pasta padronizada `Imóveis/<Título (nº)>/`, com o checklist:
   - `01 - Fotos`
   - `02 - Documentos do imóvel`
   - `03 - Plantas e projetos`
   - `04 - Propostas e contratos`

   As fotos são renomeadas "Foto NN — dd-mm-aaaa.ext" na ordem do anúncio. O anúncio guarda apenas
   `/api/imovel-foto/<id>`; a rota é pública quando o imóvel está aprovado/publicado. Sem Drive, a
   foto fica no banco (`imovel_fotos.data` / `ImovelFoto.dados`) e o botão **"Testar Google Drive"**
   envia as pendentes. Foto removida do anúncio vai para a lixeira do Drive.
   - Prospecta: `server/imovel-fotos.ts`, `server/routes/imovel-fotos.ts` e `shared/drive-estrutura.ts`.
   - Santa Fé: `src/lib/imovel-fotos.ts`, `src/app/api/imovel-foto/[id]/route.ts` e `src/lib/drive-estrutura.ts`.

### 3.2 Migrações aplicadas em produção

| Banco | Migração | Efeito verificado |
|---|---|---|
| Neon (Prospecta) | `drizzle/0053_vgv_valor_aprovado.sql` | 7 leads receberam `approved_value` = VGV da obra: Mariana 175.000; Luciano 161.094,17; Mylca 180.000; Emily 176.985; Jesse 156.204,82; Sheilla 190.000; D'Anne 200.000. Obra #1 (Keilane): VGV preenchido com 230.000. |
| Neon (Prospecta) | `drizzle/0054_imovel_fotos.sql` | tabela `imovel_fotos` + índice criados |
| Supabase (Santa Fé) | `20261015220000_lead_valor_aprovado` | coluna `Lead.valorAprovado`; 3 leads preenchidos a partir do VGV da obra |
| Supabase (Santa Fé) | `20261015230000_imovel_fotos` | tabela `ImovelFoto` criada; `schema_migrations.version` corrigida para os 14 dígitos do nome |

### 3.3 Testes

- **(a) Automáticos:**
  - Prospecta: 790 testes passando + `pnpm check`.
  - Santa Fé: 672 testes passando (inclui `imovel-fotos.db.test.ts` e os de agenda), `tsc`, `eslint` e `next build`.
- **(b) Manuais (E2E com Playwright local):**
  - modais no tamanho de iPad;
  - portal do corretor;
  - máscara de dinheiro;
  - VGV automático no Santa Fé (confirmado por captura de tela).
- **(c) Pendente em produção:** ver §5.

## 4. Portal do Empreiteiro (pedido do dono — IMPLEMENTADO em 15/10, ver §6)

Implementar **primeiro na Prospecta e depois no Santa Fé** (paridade), conforme o pedido literal:

### 4.1 Especificação

1. **Tela inicial do empreiteiro com duas abas:** "Minhas Obras" e "Relatórios".
2. **Aba "Relatórios"**: gráficos e layout modernos, com somas de **todas as obras vinculadas a ele**:
   - lucro previsto **do empreiteiro** (somente o dele, nunca o da empresa ou dos investidores);
   - VGV total;
   - total do "valor a receber do banco" (soma por obra).
3. **Aba "Minhas Obras"** igual à lista de obras do admin:
   - os **mesmos filtros, exceto "Responsável"**;
   - cards idênticos aos do admin;
   - **sem o botão "Excluir"** (só o admin exclui);
   - só as obras vinculadas a ele.
4. **"Editar Obra"** é o mesmo painel do admin, com restrições:
   - "Informações" e "Valores da Operação": **somente leitura**;
   - "Custos": o card "Custos previstos" é **somente leitura**; o card **"Pagamentos" funciona
     igual ao admin** (lançar, ver histórico);
   - "Progresso", "Fotos" e "Relatórios": **totalmente utilizáveis**;
   - apenas para obras vinculadas a ele (validar **no servidor**, não só esconder botão).
5. **"Ver Detalhes"** mostra exatamente a página de detalhes da obra do admin.

### 4.2 O que já foi investigado na Prospecta

- `client/src/pages/EmpreiteiroPortal.tsx`: hoje é só uma lista simples de cards, usando
  `trpc.empreiteiro.minhasObras`.
- `server/obra-financeiro-router.ts` → `empreiteiroRouter.minhasObras`:
  - exige o papel `empreiteiro`;
  - busca obras com `constructionProjects.contractorUserId = ctx.user.id`;
  - chama `calcularResumoObra(id)`, de onde saem `calculo.receberBanco`, `calculo.lucroEmpreiteiro` e `valores.vgv`. **Esses são os números da aba Relatórios.**
- Permissões hoje:
  - `obraProgresso.*` (obter, detalhe, salvar, atualizarFoto, excluirFoto, relatorio) e todo `obraFinanceiro.*` são `adminProcedure`;
  - `adminProcedure` usa `canAccessAdminProcedure(user, path)` em `server/_core/trpc.ts` (admin sempre; corretor via `ROUTERS_DO_CORRETOR`; colaborador por permissões);
  - `construction.allProjects` exige o papel admin;
  - `construction.getProjectDetails` só permite dono ou admin;
  - `updateProject` e `deleteProject` são `adminProcedure`.
- Upload de fotos da obra: `server/routes/obra-fotos.ts` com `podeGerenciarFotos` / `podeVerFotosDaObra` (`shared/obra-fotos`). Conferir se o empreiteiro vinculado já passa nessas checagens.
- Telas do admin a reaproveitar:
  - `client/src/pages/AdminObras.tsx`: filtros (o "Responsável" fica por volta da linha 154), cards com Editar / Ver Detalhes / `AcoesExcluir`;
  - `AdminEditarObra.tsx`:
    - bloqueado por `user?.role === "admin"`;
    - abas de `ABAS_OBRA`: info, mcmv = "Valores da Operação", valores = "Custos", progresso, fotos, relatorios;
    - `handleSave` grava `updateProject` + `salvarValores` + `definirInvestidores`;
  - `ObraDetalhes.tsx`: prop `admin`; consulta `getProjectDetails` + `obraProgresso.detalhe`;
  - `client/src/components/obra/FinanceiroObra.tsx` → `CustosAba`: card "Custos previstos" + card "Pagamentos" (`NovoMovimento natureza="pagamento"` + `Historico`).

### 4.3 Plano de implementação sugerido (Prospecta)

1. **Servidor: procedimento "admin ou empreiteiro da obra"** (ex.: `obraDoEmpreiteiroProcedure`):
   - admin passa sempre;
   - empreiteiro passa só se `constructionProjects.contractorUserId = ctx.user.id` para o `obraId` / `projectId` do input;
   - aplicar a: `obraProgresso.*` (exceto excluir obra), `getProjectDetails`, leituras de `obraFinanceiro` (resumo/histórico) e o **lançamento de movimento com natureza `pagamento`**;
   - escritas de Informações / Valores / Custos previstos / investidores / exclusão continuam só admin;
   - testes unitários cobrindo o empreiteiro de outra obra (FORBIDDEN).
2. **`empreiteiro.minhasObras`**: devolver os mesmos campos que a lista do admin usa (para reaproveitar o card).
3. **Relatórios**: nova query `empreiteiro.relatorio` com totais (lucro do empreiteiro, VGV, a receber do banco) e a série por obra, para os gráficos (recharts já está no projeto).
4. **Cliente**:
   - extrair o card/filtros de `AdminObras.tsx` para um componente compartilhado com props `podeExcluir` e `mostrarFiltroResponsavel`;
   - `EmpreiteiroPortal.tsx` com `Tabs` (Minhas Obras | Relatórios);
   - rotas `/empreiteiro/obras/:id/editar` e `/empreiteiro/obras/:id` reaproveitando `AdminEditarObra` (prop `modo="empreiteiro"`, que bloqueia campos e esconde o salvar das abas só leitura) e `ObraDetalhes`;
   - em `CustosAba`, receber `somenteLeituraPrevistos`.
5. **Santa Fé (paridade)**:
   - hoje `src/app/empreiteiro/page.tsx` é uma lista simples (obras `where: { empreiteiroId: user.id }` + `carregarResumoObra`);
   - telas do admin: `src/app/admin/obras/page.tsx` + `_components/obras-client.tsx`, e `src/app/admin/obras/[id]/editar/` (`editar-obra-client.tsx`, `financeiro-obra.tsx`, `relatorio-obra-botao.tsx`);
   - as server actions de progresso/fotos/pagamento precisam da mesma regra "admin ou empreiteiro da obra";
   - o redirecionamento do papel está em `src/lib/auth/modulos.ts` (`area === "empreiteiro"` → `/empreiteiro`).
6. Testes:
   - unitários (permissão por obra);
   - E2E Playwright com o usuário empreiteiro (local: `e2e-empreiteiro@teste.local` / `Teste123!` no Santa Fé).
7. Commit na branch de trabalho, PR em rascunho. **Merge/deploy só com autorização do dono.**

## 5. Pendências fora do portal do empreiteiro

- [ ] **Santa Fé:** o dono deve clicar em **"Testar Google Drive"** (Configurações) para enviar ao Drive a foto de 1 imóvel que hoje está no banco. Na Prospecta, idem se houver pendentes.
- [ ] Validar em produção, com login real:
  - fotos (rota `/api/imovel-foto/<id>` e pastas no Drive);
  - VGV automático;
  - comissões das obras no acesso do corretor;
  - máscara de dinheiro.
- [ ] SMTP de produção (variáveis de ambiente) — baixa prioridade; precisa de ação do dono na Vercel.

## 6. Estado atual

- 15/10/2026: PRs #125 (Prospecta) e #192 (Santa Fé) mergeados e em produção; handoff mergeado (#126 / #193).
- 15/10/2026 (tarde): **Portal do Empreiteiro implementado nos dois sistemas** na branch `claude/sync-mirrored-repos-bsqnz3`
  — **mergeado e em produção** (autorizado pelo dono): Prospecta #127 → `8443d1d` (`dpl_E8eya3kL8TyAu9nHE9vpeSE51o1X` READY),
  Santa Fé #194 → `2fbe6e4` (`dpl_CoyvfJAXgF86GxtLUbbYuAPi3Mfk` READY). Sem migração de banco.
  - Prospecta: `server/obra-acesso.ts` (vínculo por obra no `adminProcedure`), `empreiteiro.minhasObras` com os
    campos da lista do admin + indicadores, `client/src/components/obra/ListaObras.tsx` (lista compartilhada),
    `EmpreiteiroPortal.tsx` (abas + gráficos), `AdminEditarObra` com `modo="empreiteiro"`, `ObraDetalhes empreiteiro`,
    rotas `/empreiteiro/obras/editar/:id` e `/empreiteiro/obras/:id`, fotos do empreiteiro (`shared/obra-fotos.ts`).
  - Santa Fé: `src/lib/obras/acesso-empreiteiro.ts` nas actions de progresso/fotos/pagamentos/relatório,
    `src/components/obras/{lista-obras,obra-detalhe,editar-obra-pagina}.tsx` (telas compartilhadas com o painel),
    `src/app/empreiteiro/{layout,page}.tsx` + `obras/[id]` e `obras/[id]/editar`, rotas de foto aceitam o empreiteiro.
  - Regras: empreiteiro só vê/edita obras com `contractorUserId`/`empreiteiroId` = ele; lança/exclui só pagamentos
    (sem vincular BPO); Informações, Valores da Operação, Custos previstos e Salvar ficam bloqueados; diário de obra
    (Santa Fé) só leitura.
  - Testes: Prospecta 798 ✓ (`server/portal-empreiteiro.test.ts`); Santa Fé 679 ✓
    (`src/lib/__tests__/portal-empreiteiro.test.ts`) + `next build` ✓. E2E local: Prospecta com API simulada;
    Santa Fé com servidor real e usuário `e2e-empreiteiro@teste.local` (lista, relatórios, editar restrito,
    pagamento gravado, obra de outro → 404, /admin bloqueado).
  - Pendente: validação em produção com um empreiteiro real vinculado a obras.

## 7. Como testar localmente (resumo)

- Postgres local: `pg_ctlcluster 16 main start`.
- **Prospecta:**
  - `pnpm check`, depois `npx vitest run` (inclui `server/**/*.test.ts`);
  - funções de `server/db.ts` usam o driver HTTP do Neon, então teste os helpers diretamente com banco local.
- **Santa Fé (`web/`):**
  - variáveis: `DATABASE_URL=DIRECT_URL=postgresql://postgres:<senha>@localhost:5432/<banco>`;
  - `TEST_DATABASE_URL=$DATABASE_URL npx vitest run`, `npx tsc --noEmit`, `npx eslint <arquivos>`, `npx next build`;
  - para subir: `AUTH_SECRET=... AUTH_TRUST_HOST=true npx next start -p <porta>`. Mate servidores antigos antes (`pkill -f "next start"`), pois um servidor velho na porta dá resultado falso.
- **Migrações:**
  - Santa Fé: Supabase `apply_migration`, depois `update supabase_migrations.schema_migrations set version = substring(name from 1 for 14) where name in (...)`;
  - Prospecta: arquivo `drizzle/00NN_*.sql` + `drizzle/meta/_journal.json`, aplicado no Neon via `run_sql`.
- **Merge** (quando autorizado):
  - PR pronto → squash com `expectedHeadSha` → conferir o deploy de produção READY na Vercel;
  - para realinhar a branch sem force push: `git checkout -B <branch> origin/main && git merge -X ours origin/<branch>`.
