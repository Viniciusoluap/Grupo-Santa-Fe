# S-05 — Etapa 2 (5/N): páginas de Avaliações sem guarda de servidor

**Status:** Done (parcial — ver "Pendência real registrada" abaixo)
**Contexto:** quinto incremento da Etapa 2 (autenticação/sessões/RBAC) da auditoria
integral Prospecta ↔ Grupo Santa Fé. Investigação partiu do item "public Blob storage
for avaliação documents" do handoff; a investigação revelou um problema mais estrutural
e mais grave no mesmo módulo, tratado primeiro.

## Problema confirmado

`Avaliações` é `adminOnly: true` na sidebar (`src/components/admin/sidebar.tsx`) e a
página de listagem (`/admin/avaliacoes`) já tinha `requirePageRole(session, "admin")`
— aplicado no C2 desta mesma auditoria. Mas **nenhuma das 5 sub-rotas** do módulo
repetia essa checagem:

- `/admin/avaliacoes/nova`
- `/admin/avaliacoes/[id]` (detalhe — onde ficam os documentos, checklist de vistoria,
  valor estimado, dados do cliente: nome, CPF, telefone, endereço)
- `/admin/avaliacoes/[id]/editar`
- `/admin/avaliacoes/[id]/laudo`
- `/admin/avaliacoes/batch-laudos`

Nenhuma dessas páginas chamava `auth()`/`requirePageRole` — qualquer usuário
autenticado não-cliente (corretor, colaborador) que soubesse ou adivinhasse uma URL
(`/admin/avaliacoes/{id}`, por exemplo) via diretamente dados pessoais de clientes de
avaliação (CPF, telefone, endereço) e o laudo completo, sem nunca passar pela checagem
da tela de listagem.

Todas as **7 server actions** em `src/lib/actions/avaliacoes.ts`
(`criarAvaliacao`, `atualizarStatusAvaliacao`, `editarAvaliacao`, `excluirAvaliacao`,
`salvarChecklistAvaliacao`, `salvarDocumentosAvaliacao`, `salvarSugestaoAvaliacao`)
tinham o mesmo problema — só checavam `if (!session)`, nunca o papel — então mesmo sem
acessar a página, um usuário podia chamar essas actions diretamente e criar, editar ou
**excluir** qualquer avaliação.

A rota `/api/avaliacoes/documentos` (geração de token de upload + fallback de leitura
do blob para o iOS Safari) tinha a mesma lacuna: só `if (!session)`, sem checar papel.

**Impacto real verificado em produção** (Supabase, `giulchozonhzyopmgmkv`): 5
avaliações cadastradas hoje, **0 com documentos anexados** — o problema de acesso
indevido às páginas/actions era real e explorável, mas não houve exposição retroativa
de documentos (nenhum documento existia para vazar até agora).

## Correção implementada

- As 5 páginas ganharam `requirePageRole(session, "admin")`, no mesmo padrão já usado
  na listagem e em outras seções `adminOnly` (relatórios, configurações, contabilidade,
  incorporação, contratos, comissões — corrigidos em incrementos anteriores desta
  auditoria).
- As 7 actions em `avaliacoes.ts` trocaram `if (!session) throw` por
  `requireActionRole(session, "admin")`.
- `/api/avaliacoes/documentos/route.ts` (GET e POST) ganharam a mesma checagem via uma
  função `requireAdmin` local.

## Pendência real registrada — não inventada nem silenciada

O achado original do handoff ("Blob público") **continua parcialmente aberto**: os
documentos são enviados via `@vercel/blob` com `access: "public"`
(`documentos-avaliacao.tsx`), e a URL retornada pelo storage é publicamente acessível
por qualquer pessoa que a obtenha — sem exigir sessão — indefinidamente, mesmo depois
desta correção. A correção desta entrega fecha **quem consegue chegar à URL através do
app** (agora só admin), mas não torna a URL em si privada.

Duas saídas reais foram avaliadas e **nenhuma foi aplicada nesta entrega**:

1. **Blob privado** (`access: "private"` — suportado pelo SDK instalado, `@vercel/blob`
   v2.5.0, confirmado nos tipos: `get(url, { access: "private" })`): exigiria um Blob
   Store configurado como privado no painel da Vercel — não é algo que este ambiente
   consiga fazer via código/MCP; é o tipo de passo manual que a regra "Automação
   primeiro" do projeto pede para minimizar e sinalizar explicitamente, não inventar
   uma solução parcial em torno dele.
2. **Migrar para armazenamento no próprio banco** (a alternativa self-contained que a
   regra "Automação primeiro" recomenda por padrão): exigiria trocar o fluxo de upload
   direto-do-cliente-para-o-Blob por um proxy via servidor, e reescrever o mecanismo de
   fallback para iOS Safari (`uploadComFallback`/watchdog/retentativas em
   `documentos-avaliacao.tsx`) que já existe, funciona, e não pode ser validado de
   ponta a ponta neste sandbox (sem `DATABASE_URL`, sem Safari real para testar). Fazer
   essa reescrita sem conseguir testá-la de verdade seria trocar um problema conhecido
   e documentado por um risco de regressão não verificado — contrário à disciplina desta
   sessão de só declarar concluído o que foi de fato testado.

**Registrado explicitamente como pendência para decisão do dono do produto**: qual das
duas rotas (Blob Store privado no painel da Vercel, ou migração para armazenamento no
banco) deve ser seguida — não fica quieto nem é reportado como "100% resolvido".

### Atualização (investigação Etapa 3) — por que a opção 2 não é um simples swap

Ao investigar a Etapa 3, foi confirmado que o Santa Fé **já tem** um padrão de
armazenamento no próprio banco funcionando em produção (`src/lib/blob.ts` →
`uploadPublico`, tabela `arquivos`, servido por `/api/arquivo/[id]`), usado hoje por
contratos (`juridico.ts`, `portal.ts`) e por incorporação (KML/levantamento). Cheguei a
avaliar reaproveitar esse mesmo padrão para os documentos de avaliação, o que pareceria
resolver a pendência acima sem depender de configuração manual na Vercel.

**Mas os dois caminhos não são equivalentes** — achado técnico concreto, não presente na
avaliação anterior: o padrão `uploadPublico` recebe o arquivo via `request.formData()`
numa rota serverless da Vercel, cujo corpo de requisição tem limite rígido de ~4.5 MB
(documentado no próprio código: `/api/avaliacoes/upload-doc/route.ts`, `MAX_FILE_BYTES = 4 * 1024 * 1024`
— rota órfã, sem nenhum chamador, ver abaixo). O fluxo atual de avaliações permite até
**50 MB no total / 5 arquivos** via upload direto do navegador para o Blob (que contorna
esse limite porque os bytes nunca passam pelo servidor). Trocar para o padrão de banco
sem contornar esse teto seria uma regressão real e não documentada anteriormente:
laudos/fotos de vistoria escaneados frequentemente passam de 4 MB. Confirma que a
opção 2 não é uma troca mecânica — exigiria também resolver o limite de tamanho (ex:
upload em chunks para o próprio servidor), o que é trabalho adicional não coberto por
esta pendência original.

**Achado adicional**: `/api/avaliacoes/upload-doc/route.ts` existe no repositório mas
**não é chamado por nenhum código** (`documentos-avaliacao.tsx` usa exclusivamente o
fluxo direto-para-Blob via `@vercel/blob/client`) — é uma rota órfã, provavelmente uma
tentativa anterior abandonada do caminho de banco. Ela tem a mesma lacuna que o C5 desta
story corrigiu em outros lugares: só checa `if (!session)`, nunca o papel. Por estar
morta (nenhum caminho de execução chega nela), não há exploração real, mas era uma
lacuna de autorização "adormecida". **Removida nesta entrega** (`git rm`) após
aprovação explícita do usuário — a primeira tentativa foi bloqueada pelo classificador
de modo automático do Claude Code como "Irreversível/Destruição Local" mesmo sendo um
arquivo versionado (reversível via histórico do git); o usuário confirmou a remoção e
ela foi aplicada.

## Gates

- `npx tsc --noEmit`: zero erros.
- `npx vitest run`: 32 arquivos, **299 testes aprovados** — nenhuma regressão (as
  mudanças são só de gating de página/action, cobertas pelas funções já testadas
  `requirePageRole`/`requireActionRole` em `rbac.test.ts`).
- `npx eslint .`: 39 problemas (17 erros, 22 avisos) — idênticos antes e depois, nenhum
  nos arquivos alterados.
- `git diff --check`: aprovado.
- Sem migração de banco nesta entrega.

**Não testado nesta sessão:** o fluxo real de upload/visualização de documento em um
navegador (exigiria `DATABASE_URL` e credenciais do Vercel Blob reais).

## Grupo Santa Fé × Prospecta

Investigado e descartado como já correto. `server/routers.ts`, `avaliacoes: router({...})`
no Prospecta: todos os procedures (`list`, `getById`, `create`, `update`, `delete`,
`updateChecklist`, `sugestaoValor`, `leadOptions`) já são `adminProcedure`. A classe de
bug encontrada no Santa Fé (rota de página sem guarda própria, só a listagem
protegida) não existe estruturalmente no Prospecta: é uma SPA com tRPC como único
ponto de entrada de dados — não há páginas Next.js renderizadas no servidor, cada uma
precisando repetir sua própria checagem. Nenhuma pendência a registrar no ROADMAP do
Prospecta a partir desta correção pontual.

## Encerramento — merge e deploy confirmados

- PR: `Viniciusoluap/Grupo-Santa-Fe#128` — mesclado (squash) em `main`.
- Commit de merge: `d1274078d885f11882eebf76a19a19b0e4cbe2b0`.
- Deploy de produção: `dpl_79wCMPTX2rPrygXSL5R6zrz2tBjD` — `READY`.
- `mcp__Vercel__get_runtime_errors` (últimas 24h, projeto
  `prj_W8c9sow2dxFO5GDfqABwlKWodI1v`): nenhum erro de runtime encontrado.
- Pendência de Blob público (seção acima) permanece registrada — não fechada por este
  deploy, segue aguardando decisão do dono do produto.

## Encerramento (follow-up Etapa 3) — remoção da rota órfã upload-doc

- PR: `Viniciusoluap/Grupo-Santa-Fe#130` — mesclado (squash) em `main`.
- Commit de merge: `977dfcba1455fd69739fe6946405c99bfe00d6a2`.
- Deploy de produção: `dpl_GFTJoukNeYjsntdv8vNPTvQtXq3t` — `READY`.
- `mcp__Vercel__get_runtime_errors` (últimas 24h, projeto
  `prj_W8c9sow2dxFO5GDfqABwlKWodI1v`): nenhum erro de runtime encontrado.
- Pendência de Blob público (seção acima) continua registrada e aberta — a remoção da
  rota órfã e o achado do limite de 4.5 MB das funções serverless da Vercel apenas
  esclarecem a pendência existente, não a resolvem.
