# HANDOFF 17/11 — Paridade bloco 1 (CRM, Usuários e acesso, Mapa operacional)

Branch: `claude/paridade17-b1-crm` (worktree `/home/user/sf-b1-crm`). Sem merge, sem PR, sem deploy.
Autorização: dono, 17/11. Fonte da verdade (Prospecta, só leitura): EPIC-023 S-A e S-B; commits `204ac53`, `2cf71ba`,
`2cb1fd2`, `8aacdcd`. Maquete 3D fica de fora (decisão do dono).

## Situação por item

| # | Item | Situação | Commit |
|---|------|----------|--------|
| 1 | CRM no iPad (altura do viewport, só cartões rolam, arrasto lateral sobre o cartão) | Concluído | `79b9433` |
| 2 | Corretores em "Usuários e acesso" + remoção da tela + colaborador sem acesso | Concluído | `9f69535` |
| 3 | Filtro por perfil em "Usuários e acesso" | Concluído (as abas já existiam) | ver `git log` |
| 4 | Mapa operacional no MapLibre | Pendente | — |

### Item 1 — CRM no iPad
- `web/src/app/admin/leads/_components/leads-client.tsx`: no quadro (kanban), a raiz tem a altura do viewport
  menos a barra do topo (h-14) e o respiro do `<main>` (p-4 / md:p-6): `h-[calc(100dvh-5.5rem)]` /
  `md:h-[calc(100dvh-6.5rem)]`, `overflow-y-auto overscroll-none relative`. Na lista (tabela) nada muda.
- `web/src/components/crm/lead-kanban.tsx`: trilho `relative min-h-0 flex-1 touch-pan-x overflow-x-auto
  overflow-y-hidden overscroll-contain`; colunas `flex h-full flex-col`; lista de cartões `relative min-h-0 flex-1
  overflow-y-auto overscroll-y-contain`, **sem touch-action** (arrasto lateral volta ao trilho, Prospecta 2cf71ba).
- Diferença de layout própria do Santa Fé: a faixa "A CLASSIFICAR" (só existe aqui, fora das colunas) ganhou
  `max-h-[40%]` com rolagem própria, para não empurrar o quadro para fora da tela.
- Teste novo: `web/src/lib/__tests__/crm-ipad-layout.test.ts` (3 cenários, render estático).

### Item 2 — Corretores em "Usuários e acesso" (só admin)
- `web/src/app/admin/configuracoes/_components/usuarios-client.tsx`: busca (nome, e-mail, CRECI, telefone, cliente
  do CRM) e filtro "Situação" (Todos/Ativos/Inativos), combinados com as abas de perfil; no "Novo usuário" com perfil
  Corretor: comissão padrão (%), observações e a caixa "Enviar agora o e-mail para o corretor definir a senha"
  (marcada por padrão). Cada corretor ganha o botão "Corretor" (nome, e-mail, telefone, CRECI, cadastro ativo,
  comissão padrão, observações). Todo usuário ganha o botão de e-mail "Enviar link de acesso" (novo link de 7 dias).
  Corretores antigos **sem conta de acesso** passam a aparecer na lista (marcados "Sem conta de acesso") com
  "Vincular conta", "Corretor" e excluir — antes só existiam na tela "Corretores".
- `web/src/lib/actions/usuarios.ts`: `criarUsuario` grava comissão/observações e aceita `enviarConvite=nao` só para
  corretor (sem token, sem e-mail; retorna `convidado: false`); novas `salvarDadosCorretor` e `enviarLinkAcesso`
  (só admin). `web/src/lib/actions/corretores.ts`: fica só `excluirCorretor`, agora só admin; `criarCorretor` e
  `editarCorretor` saíram (substituídas pelas de cima).
- `web/src/lib/usuarios/filtro.ts` e `corretor-cadastro.ts`: regras puras (busca/situação; observações até 5000;
  convite).
- Tela "Corretores" removida (`web/src/app/admin/corretores/**`); `[[...rota]]/page.tsx` redireciona qualquer rota
  antiga para `/admin/configuracoes?perfil=corretor`. Link do menu lateral removido.
- `web/src/lib/auth/modulos-lista.ts`: "Corretores" deixou de ser módulo; `web/src/lib/auth/modulos.ts`: permissão
  gravada com módulo que não existe mais (ex.: `corretores`) é ignorada na leitura.
- Comissões e vínculos: nada mudou em comissões, contratos, leads, imóveis, financiamentos e agenda; a comissão
  padrão continua em `regras_comissao_corretor`.
- Expectativa antiga que mudou: `colaborador-modulos.test.ts` esperava 15 módulos com "Corretores"; agora 14, sem ele
  (mesma mudança feita na Prospecta em `admin-permissions.test.ts`).
- Sem equivalente aqui: a página de perfil do corretor (`/admin/corretores/[id]`, com leads/imóveis/comissões dele) e
  o resumo "Últimas comissões" saíram junto com a tela, como na Prospecta; os números continuam em Comissões.
  `criarCorretor` avisava os admins ("novo_corretor"); como só o admin cadastra agora, o aviso não foi levado.
  `web/src/lib/corretores/validacao.ts` ficou sem uso em produção (o teste dele foi mantido, sem apagar).

### Item 3 — Filtro por perfil
- Já existia quase igual: as abas Todos/Admin/Colaborador/Engenheiro/Corretor/Cliente/Empreiteiro de "Usuários e
  acesso" são "Todos" + os perfis do formulário (na Prospecta é uma lista suspensa; aqui ficaram as abas, mesma regra).
- O que faltava e foi feito: as abas agora combinam com a busca e a situação (contagem por aba também); `?perfil=` na
  URL abre a aba (usado pelo redirecionamento da antiga tela Corretores); o botão "Novo usuário" já abre no perfil da
  aba escolhida (como na Prospecta). Lista das abas centralizada em `PERFIS_DO_FILTRO` (`web/src/lib/usuarios/filtro.ts`).
- Teste: `web/src/lib/__tests__/usuarios-filtro-perfil.test.ts` (5 cenários, render estático).

## Testes
- (a) Item 3: `usuarios-filtro-perfil.test.ts` 5/5.
- (a) Automáticos: `corretores-usuarios-acesso.test.ts` (14 cenários, inclui a migração em PGlite);
  `colaborador-modulos`, `perfis-acesso`, `api-acesso-modulos`, `modulos-removidos` passando; `crm-ipad-layout.test.ts` 3/3; `crm-pipeline.test.ts` passou; `tsc --noEmit` sem erros; eslint
  sem achados nos 3 arquivos.
- (b) Manuais: nenhum (sem navegador/iPad neste ambiente).
- (c) Pendente em produção: uso real no iPad (retrato e paisagem), como na Prospecta.

## Migração
`web/prisma/migrations/20261117100000_corretor_observacoes/migration.sql` — `ALTER TABLE "corretores" ADD COLUMN IF
NOT EXISTS "observacoes" TEXT NOT NULL DEFAULT ''`. Aditiva e idempotente (testada 2x em PGlite). **Não aplicada em
banco real** — aplicar no Supabase antes de publicar (sem ela, a tela de Configurações quebra ao ler `observacoes`).

## Próximo passo
Item 4 (Mapa operacional no MapLibre, Prospecta `2cb1fd2`).
