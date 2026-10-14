# HANDOFF — 10 implementações (Prospecta ↔ Grupo Santa Fé)

> Documento de continuidade do "PROMPT MESTRE DEFINITIVO — 10 implementações" (13/10/2026).
> **Idêntico nos dois repositórios** (`Prospecta/HANDOFF-10-IMPLEMENTACOES.md` e
> `Grupo-Santa-Fe/HANDOFF-10-IMPLEMENTACOES.md`). Qualquer IA (Claude, Codex, ChatGPT) que retome
> o trabalho lê este arquivo primeiro, depois `HANDOFF-32-IMPLEMENTACOES.md` (projeto anterior,
> EPIC-020, concluído e publicado). Atualizar a cada etapa relevante, antes de encerrar sessão.

## 0. Regras deste projeto (do prompt mestre)

- **Sem merge nem deploy sem autorização expressa do proprietário.** Commits e push em branch de
  trabalho estão autorizados para persistir progresso. (Substitui, para este projeto, a regra antiga
  do EPIC-020 de "merge + deploy ao fim de cada lote".)
- Sem operações destrutivas em produção, troca de credenciais ou migrações destrutivas sem autorização.
- Não refazer trabalho concluído; investigar branches/PRs/HANDOFFs antes.
- Paridade funcional nos módulos equivalentes (CLAUDE.md dos dois repos), com as exceções do prompt:
  04 só Santa Fé; 08 só Prospecta; 10 = Prospecta (Santa Fé é a referência visual).
- Implementação 10: **preservar o motor funcional da Prospecta**; modernizar só apresentação/navegação
  com o modelo de 5 fases do Santa Fé; comparar resultados financeiros antes/depois.
- Branch de trabalho do Claude: `claude/sync-mirrored-repos-bsqnz3` (recriada a partir do `main`).

## 1. Diagnóstico (Lote 1) — 13/10/2026, Claude

**Estado dos repositórios:** `main` Prospecta `6e2627c` (PR #110) e Santa Fé `3ca076b` (PR #179);
EPIC-020 (32 implementações) inteiro publicado. Nenhum trabalho anterior sobre estas 10
implementações (branches/PRs/commits). PRs abertos: só os rascunhos antigos do Codex #105
(Prospecta) e #174 (Santa Fé), superados pelo Lote 5 do EPIC-020 — não mesclar; podem ser fechados.
Branch `codex/epic020-lote7-20261013` difere do `main` só no HANDOFF-32 (nada pendente).

| ID | Implementação | Prospecta (achado) | Santa Fé (achado) |
|---|---|---|---|
| 01 | Obras: exclusão e filtros | Sem ação de excluir obra no router; lista sem filtros combinados | `excluirObra` existe em `lib/actions/obras.ts` (verificar se apaga ou cancela); filtros parciais |
| 02 | Login unificado | `Login.tsx` com 3 entradas (`/login?perfil=cliente|corretor|admin`) no Navbar | Já tem `/login` único ("Entrar (Admin · Corretor · Cliente)"); conferir redirecionamento por papel e empreiteiro |
| 03 | Excluir ≠ cancelar | A auditar módulo a módulo | **Confirmado o defeito:** "Excluir" grava `status: "cancelado"` em Regularização (`regularizacoes.ts:21`), Financiamentos (`financiamentos.ts:27`), Projetos (`projetos.ts:48`); obras a verificar |
| 04 | Responsável do CRM | Não aplicável | Selects de responsável em novo/editar lead — conferir se corretores entram na lista e validar no backend |
| 05 | Cadastro dos 5 perfis | Enum `user_role` no Drizzle; tela `AdminAcesso` — conferir os 5 papéis | `Role = admin | corretor | colaborador | cliente | empreiteiro` em `rbac.ts`; tela `configuracoes/usuarios` — conferir os 5 no formulário e vínculos |
| 06 | Permissões globais | Já existe `shared/admin-permissions.ts` (módulos por colaborador) + mapa em `_core/trpc.ts` — estender, não recriar | Já existe `Usuario.permissoes` (JSON) + `rbac.ts` — estender, não recriar |
| 07 | Projetos: validação e engenheiro | A verificar equivalente | Erro `types too_small` vem de `tiposObrigatorios` (`configuracao-servico.ts`) chamado em `projetos.ts:66`; engenheiro é texto livre (`name="engenheiro"`) — trocar por colaborador por ID |
| 08 | E-mails Prospecta | "Grupo Efficaz"/"Prospecta Empreendimentos" em `server/_core/email-smtp.ts`, `email.ts` (+ telas públicas: só e-mails estão no escopo) | Não aplicável |
| 09 | Google Drive | CRM: `lead-documents-router.ts:80` e `incorporacao-documents-router.ts:87` escondem o erro real ("Não foi possível armazenar…") | Incorporação: "Google Drive indisponível (403)" (`incorporacao/registro-drive.ts`). OAuth funciona (senão seria "OAuth recusou"); a API do Drive responde 403 |
| 10 | Incorporação progressiva | 17 componentes em `client/src/components/incorporacao` + grade de módulos em `AdminIncorporacaoDetail.tsx` | Referência: ~35 abas em `app/admin/incorporacao/_components` organizadas em 5 fases |

**Google Drive (09) — leitura técnica do erro 403 (fotos do proprietário em 12/10 22:25 e 22:30):**
autenticação aceita, recurso recusado. Causas possíveis, todas devolvem 403 do Google e o código
atual não mostra qual: (a) **conta de serviço sem cota** — em Gmail comum, a conta de serviço não
grava arquivos em pasta do "Meu Drive" (`storageQuotaExceeded`); só funciona em Drive compartilhado
(Google Workspace); (b) **API do Drive não ativada** no projeto do Google Cloud da credencial
(`accessNotConfigured`); (c) pasta compartilhada com a conta de serviço como Leitor, não Editor
(`insufficientFilePermissions`). Primeiro passo do Lote 4: fazer os dois sistemas mostrarem o
`reason` do Google (sem segredos) para fechar o diagnóstico com evidência.

## 2. Plano de execução

| Lote | Conteúdo | Observação |
|---|---|---|
| 2 | 02, 04, 05, 06 — login e permissões | Estender a estrutura de permissões já existente; testes de acesso indevido por URL/API/ID |
| 3 | 01, 03 — Obras e exclusão real | Exclusão só quando não houver vínculo que exija guarda (movimentos financeiros, contratos); senão explicar e oferecer cancelar |
| 4 | 07, 08, 09 — Projetos, e-mails, Drive | 09 começa pela mensagem com o motivo do Google |
| 5 | 10 — Incorporação da Prospecta em 5 fases | Só apresentação/navegação; teste de equivalência financeira antes/depois |
| 6 | Testes integrados, segurança e paridade | — |

Ordem sugerida pelo diagnóstico: começar pelo **Lote 4 item 09 (Drive)** e pelo **03 (exclusão)**,
por serem os defeitos em uso hoje; depois Lote 2. Aguardando o proprietário autorizar os lotes.

## 3. Estado atual

**Autorização do proprietário (13/10/2026):** "siga a recomendação, pode executar todos os
lotes, porém o 10 da incorporação antes de executar eu preciso autorizar novamente".
Lotes 2, 3, 4 e 6 autorizados; **Lote 5 (item 10) BLOQUEADO até nova autorização.**
Merge, deploy e migrações em produção continuam dependendo de autorização separada.

| ID | Prospecta | Santa Fé |
|---|---|---|
| 01 | **Concluído no código** (`1c18ed8`) | **Concluído no código** (`3de3f9a`) |
| 02 | **Concluído no código** (`9b19e3a`) | **Concluído no código** (`3925984`) |
| 03 | **Concluído no código** (`644a941`) | **Concluído no código** (`36c37c2`) |
| 04 | Não aplicável | **Concluído no código** (`3925984`) |
| 05 | **Concluído no código** (`9b19e3a`) | **Concluído no código** (`3925984`) |
| 06 | **Concluído no código** (`9b19e3a`) | **Concluído no código** (`3925984` + correção do portal no Lote 6) |
| 07 | **Concluído no código** (`e6f4fe7`) | **Concluído no código** (`4b2360b`) |
| 08 | **Concluído no código** (`861a767`) | Não aplicável |
| 09 | **Concluído no código** (`50d775f`) — falta validar em produção | **Concluído no código** (`b3f7931`) — idem |
| 10 | BLOQUEADO (aguarda autorização) | Referência |

**Publicado em produção em 13/10/2026** (autorização do proprietário: "Merge + migrações + deploy"):
Prospecta PR #111 → `main` `adf2b09`, deploy `dpl_48M6sdpBKpMNqK6tEk4F57idBTGQ` READY;
Santa Fé PR #180 → `main` `3868f33`, deploy `dpl_8ZM2x3iUNduwULVbQajQXV2ABNwV` READY.
Itens 01–09 estão em produção; o 10 continua bloqueado.

## 4. Registro por implementação

### 09 — Google Drive (concluído no código)
- **Causa provável do 403** (as duas fotos): conta de serviço gravando no "Meu Drive" de conta
  pessoal (`storageQuotaExceeded`), API desligada ou pasta compartilhada como Leitor. O código
  agora mostra o motivo exato devolvido pelo Google.
- Arquivo comum `Prospecta/shared/drive-erro.ts` = `Grupo-Santa-Fe/web/src/lib/drive-erro.ts`
  (`ErroDrive`, `lerCorpoErroGoogle`, `descreverErroDrive`).
- Prospecta `server/drive-documents.ts`: erros por etapa, `diagnosticarDrive()` (teste real com
  arquivo de 1 KB apagado em seguida), `tryDriveUpload()`. Se o Drive falhar, o arquivo fica no
  banco: `lead_document_file_data`, `incorporation_registration_file_data` (novas) e as já
  existentes do checklist/jurídico. Colunas `storage` ('drive'|'banco') e `storage_note`.
- Santa Fé `lib/incorporacao/registro-drive.ts`: mesmo comportamento; bytes em `arquivos`
  (`EstudoDocumentoRegistro.arquivoId`, `armazenamento`, `notaArmazenamento`, `driveFileId` opcional).
- Botão **"Testar Google Drive"** (admin): Prospecta em Documentos do lead e no Registro da
  incorporação; Santa Fé no Registro da incorporação.
- Migrações (aditivas, **não aplicadas em produção**): Prospecta `drizzle/0048_document_db_storage.sql`;
  Santa Fé `web/prisma/migrations/20261013200000_documentos_armazenamento_banco/`.
  Testadas em Postgres local.
- Testes: `server/drive-erro.test.ts` (15) e `web/src/lib/__tests__/drive-erro.test.ts` (15).
- Pendente: aplicar migrações + publicar (autorização), clicar "Testar Google Drive" em produção
  e corrigir a configuração conforme o motivo exibido.

### 03 — Excluir ≠ Cancelar (concluído no código)
- Regra comum `Prospecta/shared/exclusao.ts` = `Grupo-Santa-Fe/web/src/lib/exclusao.ts`:
  bloqueia exclusão com movimentos financeiros, recebimentos, medições, investidores, comissões,
  pagamento registrado, comissão paga ou unidade vendida/reservada, e orienta a cancelar.
- Santa Fé `lib/crm/excluir-servico.ts` (`excluirServicoDefinitivo`, transação): obra,
  financiamento, projeto, regularização, avaliação, estudo, comissão; remove dependentes
  exclusivos (etapas, fotos+arquivos, checklist, itens, `ServicoLead`); lead preservado.
  Ações `excluirX` (definitivo) e novas `cancelarX`; componente `components/admin/acoes-excluir-cancelar.tsx`.
  Corrigido também `pg_advisory_xact_lock` via `$queryRaw` (quebrava) em `documentos-registro.ts`.
- Prospecta `server/exclusao-definitiva.ts` (`excluirDefinitivo`, `db.batch`): mesmos módulos;
  `deleteProject` virou só-admin (antes o cliente dono podia apagar) + `cancelProject`;
  `financiamentos.cancel`, `projetos.cancel`, `regularizacao.cancel`, `incorporacao.delete`;
  CRM `leadServices.remove` passa pela mesma regra. Componente `client/src/components/AcoesExcluirCancelar.tsx`
  em Projetos, Financiamentos, Regularizações, Avaliações e Incorporação.
- CRM/lead: "excluir lead" continua ocultando (`excluidoEm`), pois o lead é o cadastro
  compartilhado do cliente. Agenda/Tarefas/Imóveis já excluíam de verdade. Movimentos e
  recebimentos financeiros continuam só com cancelamento (guarda contábil, por trigger).
- Testes: Santa Fé `exclusao-regras.test.ts` (3) + `exclusao-definitiva.db.test.ts` (5, roda com
  `TEST_DATABASE_URL=postgresql://...`); Prospecta `server/exclusao-regras.test.ts` (3) +
  integração local (4) fora do repositório (driver neon-http não conecta em Postgres local).
  Suítes: Santa Fé 583 ok; Prospecta 697 ok (antes do teste novo).

### 01 — Obras: filtros e exclusão (concluído no código)
- Filtro comum `Prospecta/shared/obras-filtro.ts` = `Grupo-Santa-Fe/web/src/lib/obras-filtro.ts`
  (`filtrarObras`, `filtrosAtivos`, `FILTROS_OBRAS_VAZIOS`): nome, cliente, código, situação,
  responsável, origem CRM, período de execução (sobreposição), data de criação, ordenação A–Z/Z–A/
  recentes/antigas, limpar — todos combinados. Testes: `obras-filtro.test.ts` (8) nos dois.
- Santa Fé `app/admin/obras` (código `OB-XXXXXX`); Prospecta `client/src/pages/AdminObras.tsx`
  (código `#id`; `construction.allProjects` agora traz cliente, empreiteiro e responsável do CRM).
- Exclusão/cancelamento: componentes do item 03 nas duas listas.

### 07 — Projetos (concluído no código)
- Causa do "types → too_small": no Prospecta o formulário fazia `projectInput.parse` no navegador e
  o ZodError aparecia como JSON. Agora: validação antes de enviar + `shared/erro-validacao.ts`
  (`mensagemValidacao`) + `errorFormatter` do tRPC (nenhum erro de validação vira JSON).
  No Santa Fé a action lançava erro e a página quebrava: agora formulário cliente
  (`projetos/[id]/editar/_components/editar-projeto-form.tsx`) com erro na tela e dados preservados.
- Engenheiro = colaborador/admin ativo por ID (busca + select), nome exibido do cadastro, texto
  antigo preservado, campo CREA/CAU. Migrações aditivas: Prospecta `0049_project_engineer_user.sql`;
  Santa Fé `20261013210000_projeto_engenheiro_usuario`. Testadas localmente; **não aplicadas em produção**.
- Tipos de projeto no Prospecta viram a mesma lista do Santa Fé (`PROJECT_TYPE_LABELS`).

### 08 — E-mails da Prospecta (concluído no código)
- `shared/email-identidade.ts`: "Prospecta Construções - VFX Capital", `rodapeEmail()` com ano atual;
  remetente, assuntos e rodapés de todos os templates. Endereço/SMTP inalterados.
  Teste `server/email-identidade.test.ts` (11).

### Lote 2 — 02 login, 04 responsável do CRM, 05 cinco perfis, 06 permissões (concluído no código)
- Regra comum `Prospecta/shared/perfis-acesso.ts` = `Grupo-Santa-Fe/web/src/lib/perfis-acesso.ts`:
  `PERFIS` (admin, colaborador, corretor, cliente, empreiteiro), `areaDoPerfil`, `podeAcessarModulo`,
  `podeAcessarAlgum`, `podeAdministrarSeguranca`, `primeiroModulo`, `normalizarPermissoes`.
  Admin: tudo. Colaborador: só módulos liberados. Corretor: Imóveis, Agenda, WhatsApp e Comissões,
  só dos próprios registros (permissões gravadas para ele são ignoradas). Cliente: portal.
  Empreiteiro: área do empreiteiro. Inativo: nada. Usuários/perfis/permissões e exclusão definitiva: só admin ativo.
- **02 Login único:** um "Minha Conta · Entrar"; o sistema descobre o perfil e manda para a área
  certa (Prospecta: escolha de perfil e `?perfil=` removidos; Santa Fé: destino pelo primeiro módulo liberado,
  `/admin/sem-acesso` se não houver nenhum).
- **05 Cadastro dos 5 perfis** (Configurações → Usuários): corretor cria/vincula o cadastro de
  corretor; cliente exige vínculo com um lead sem conta; troca de perfil/desativação derruba as
  sessões (`sessionVersion`). Santa Fé: `Usuario.leadId` (migração aditiva
  `20261013220000_usuario_cliente_lead`, com preenchimento seguro por e-mail único).
- **06 Permissões no servidor:** Santa Fé lê perfil/situação/permissões do banco a cada requisição
  (`lib/auth/modulos.ts`: `exigirModuloPagina`, `exigirModuloAcao`, `exigirAdminAtivo`) em todas as
  páginas e actions do painel; menu lateral filtrado. Prospecta: `canAccessAdminProcedure` no tRPC
  (corretor só agenda/WhatsApp no painel, escopados aos próprios leads), `AdminRoute` no cliente.
- **04 (só Santa Fé):** responsável do lead só admin/colaborador ativo (`crm/responsavel.ts`);
  valor legado preservado e exibido como "Registro anterior".
- Testes: `perfis-acesso.test.ts` (7) nos dois; Santa Fé `usuarios-perfis.db.test.ts` (5) e testes de
  CRM/obras atualizados para a regra nova. Suítes: Santa Fé 600 ok (14 pulados sem banco);
  Prospecta 731 ok.

### Lote 6 — testes integrados e paridade (13/10/2026)
- **Santa Fé, navegador (Playwright) contra build de produção local** (`next start` + Postgres local),
  com um usuário de cada perfil. Resultado (login → destino; URLs proibidas → redirecionadas):
  admin → `/admin/leads` (todos os 16 módulos no menu); colaborador só com "obras" → `/admin/obras`
  (menu só Obras; leads/configurações/imóveis/comissões voltam para Obras); colaborador sem módulos →
  `/admin/sem-acesso`; corretor (com permissões indevidas gravadas) → `/admin/imoveis` (menu: Imóveis,
  Agenda, Comissões, WhatsApp; obras/leads/configurações bloqueados); cliente → `/portal` (todo `/admin`
  bloqueado); empreiteiro → `/empreiteiro`; usuário inativo não entra.
- **Falha encontrada e corrigida:** `/portal` abria (vazio) para qualquer perfil logado. Agora o
  `portal/layout.tsx` devolve quem não é cliente para a própria área. Teste repetido: ok.
- **Prospecta:** o portal já era restrito ao cliente (`PortalRoute` + `portal-router`). O teste de
  navegador não roda localmente (driver `neon-http` não conecta em Postgres local); a regra está
  coberta pelos testes de procedimentos tRPC. **Validar em produção/preview após autorização.**
- Paridade conferida: arquivos comuns idênticos nos dois repositórios (`drive-erro`, `exclusao`,
  `obras-filtro`, `perfis-acesso`); diferenças só as previstas (04 só Santa Fé; 08 só Prospecta;
  corretor usa o painel com 4 módulos no Santa Fé e o Portal do Corretor + Agenda/WhatsApp na Prospecta).

### Publicação (13/10/2026)
- **Pré-verificação em produção (somente leitura):** nenhuma coluna/tabela nova existia; 0 documentos nas
  tabelas afetadas. Usuários reais conferidos com a regra nova: os 2 colaboradores do Santa Fé mantêm
  os módulos que já tinham (Incorporação, BPO e Jurídico já eram só do admin; o **Mapa** não está nas
  permissões deles — o admin libera em Configurações → Usuários se quiser). Os 3 corretores do Santa Fé
  têm cadastro de corretor ativo. Na Prospecta, permissões gravadas para corretor/cliente/empreiteiro
  passam a ser ignoradas (regra do item 06); o colaborador com só "projetos" vê só Projetos.
- **Migrações aplicadas antes do merge:** Supabase (`apply_migration`) `documentos_armazenamento_banco`,
  `projeto_engenheiro_usuario`, `usuario_cliente_lead` (0 contas de cliente para vincular por e-mail);
  Neon (transação única) 0048 e 0049, registradas em `drizzle.__drizzle_migrations` (ids 37 `778fce1e…`
  e 38 `0cdd3d6e…`). Conferido depois: 6 colunas + 2 tabelas (Neon), 6 colunas + 4 restrições +
  `driveFileId` opcional (Supabase); contagens de leads/projetos/usuários inalteradas.
- **Merge** (squash) dos PRs #111 e #180 e **deploy de produção READY** nos dois. Verificação sem login:
  `/login` responde nos dois; `/portal` do Santa Fé sem sessão vai para o login; sem erros de execução
  na Vercel após a publicação.

### Próximo passo exato
1. **Validar com login real em produção (proprietário):** clicar "Testar Google Drive" (Prospecta:
   Documentos do lead; Santa Fé: Registro da incorporação) e corrigir a configuração do Google
   conforme o motivo exibido; conferir o menu de um colaborador e de um corretor.
2. **Item 10 (Incorporação em 5 fases, Prospecta) — BLOQUEADO:** só iniciar com nova autorização expressa.

### Pedidos A1–A8 (13–14/10/2026) — publicados
- **A1** situação da obra (seletor = opções do filtro); **A2** abas do Editar Obra (Prospecta);
  **A3** filtros de data da lista de Obras; **A4a** filtro "Origem" removido; **A4b** obra da Lucia
  (#28) vinculada ao lead 25 e duplicata #33 apagada (Prospecta); **A7** financiamentos do CRM
  materializados (Prospecta). PRs #114 (Prospecta) e #183 (Santa Fé), em produção.
- **A8** pagamento da obra: categorias "Mão de obra" e "Material" + campo **Etapa** (lista da Medição
  por serviço). Migrações Neon `0050` e Supabase `20261013230000`, aplicadas antes do merge.
- **A6 / Lote 3 — excluir é excluir, em todo o sistema:** sem botão Cancelar; lançamentos financeiros
  (movimentos da obra, recebimentos da regularização) são apagados de verdade com o histórico; excluir
  obra/financiamento/projeto/regularização leva junto lançamentos, medições, comissões e aportes.
  Lançamentos já cancelados apagados com autorização do dono (Prospecta: 6 movimentos + 16 recebimentos;
  Santa Fé: 0). Neon `0051` (gatilhos sem DELETE + histórico em cascata); Supabase
  `20261014120000` aplicada **sem DROP** (o conector não executa DROP): as funções de guarda aceitam
  DELETE e apagam o histórico antes — mesmo efeito. PRs #115 e #184, em produção.
- **A5 / Lote 4 (Google Drive):** ainda falha após a configuração do dono. Aguardando o texto exato do
  "Testar Google Drive". Hipótese: conta Google pessoal (sem Drive compartilhado) → pasta no "Meu Drive"
  continua com `storageQuotaExceeded`. Alternativa proposta: conectar o Drive pela conta do próprio dono (OAuth).
- **Item 10:** continua bloqueado até a revisão do dono.
