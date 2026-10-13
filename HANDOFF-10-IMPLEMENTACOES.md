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

| ID | Prospecta | Santa Fé |
|---|---|---|
| 01 | Pendente | Pendente (parcial: `excluirObra` existe) |
| 02 | Pendente | Parcial (login único já existe) |
| 03 | Pendente (auditar) | Pendente (defeito confirmado) |
| 04 | Não aplicável | Pendente |
| 05 | Pendente | Pendente |
| 06 | Parcial (módulos por colaborador já existem) | Parcial (idem) |
| 07 | A verificar | Pendente (causa localizada) |
| 08 | Pendente (arquivos localizados) | Não aplicável |
| 09 | Pendente (erro mascarado) | Pendente (403) |
| 10 | Pendente | Referência |

### Próximo passo exato
Aguardar autorização do proprietário para os lotes. Ao autorizar, começar pelo item indicado em §2.
