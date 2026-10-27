# HANDOFF 26/10 — AIOX, 16 correções

## Identificação

- Repositório: `Viniciusoluap/Grupo-Santa-Fe`
- Branch: `codex/aiox-16-correcoes-20261026`
- Base auditada: `main` em `a6963894010702b71d062e8180a19056b8004160`
- Aplicação: diretório `web/` (Next.js/Prisma)
- Sessão iniciada: 26/10/2026
- Autorização do proprietário: execução, merge e deploy.

## Objetivo

Auditar, implementar, testar e publicar as correções 01–16 do prompt mestre de 26/10/2026, mantendo paridade funcional com a Prospecta e preservando dados e integrações.

## Estado inicial confirmado

- Clone limpo e alinhado a `origin/main`; nenhum arquivo local pendente.
- Nenhum PR aberto no repositório no início da sessão.
- Handoffs de 25/10 e commits recentes lidos; o porte anterior de BPO, WhatsApp, mídias e integrações já está em `main`.
- As migrações anteriores `20261025220000` e `20261025230000` constam como aplicadas em produção no Handoff precedente.
- Não há código desta nova execução antes deste checkpoint.
- A auditoria requisito a requisito está em andamento para evitar duplicar funcionalidades já entregues.

## Matriz inicial

| Correções | Situação | Próxima ação |
|---|---|---|
| 01–08 WhatsApp | Em auditoria | Comparar UI, serviços, persistência e testes com os aceites |
| 09–15 BPO/integrações | Em auditoria | Mapear origem financeira, vínculos, Pluggy/Cora e migrações |
| 16 Projetos | Em auditoria | Mapear revisão, arquivos, versões e checklist |

## Proteções e decisões

- Nenhuma migração destrutiva será executada sem backup, prévia de impacto e caminho de recuperação.
- Credenciais e dados pessoais não serão registrados neste arquivo.
- Alterações serão feitas nesta branch, com checkpoints publicados por etapa.
- A ordem interna poderá mudar por dependência técnica, com justificativa registrada.
- Testes serão separados em: (a) automáticos, (b) manuais e (c) produção.

## Testes

- (a) Automáticos: ainda não executados neste checkpoint documental.
- (b) Manuais: estado Git, branch principal, HEAD, branches remotas, instruções e Handoffs conferidos.
- (c) Produção: nenhuma alteração realizada.

## Arquivos modificados

- `HANDOFF-26-10-AIOX-16-CORRECOES.md`

## Bloqueios

- Nenhum bloqueio confirmado. O GitHub CLI não está instalado; operações de PR/merge serão realizadas pelo conector GitHub.

## Próximo passo exato

Concluir a auditoria das 16 correções nos dois repositórios, publicar a matriz de lacunas neste Handoff e iniciar o primeiro lote técnico com testes focados.

## Checkpoint de retomada — 26/10/2026, noite

- Recuperados e inventariados todos os checkpoints locais da execução AIOX interrompida, sem descarte.
- Correções 10/11 integradas: Pluggy `/v2/transactions` por cursor, erro detalhado, identificador bancário e paridade do importador Cora.
- Correção 16 integrada parcialmente: estrutura aditiva de revisão/documentos e helper de nome canônico; UI, transações de status/prioridade e checklist derivado ainda pendentes.
- Correções 01–09 e 12–15 ainda aguardam o porte/implementação específico da stack Next.js/Prisma.

### Testes deste checkpoint

- (a) Automáticos: Prisma generate e TypeScript aprovados; 3 arquivos focados/10 testes de Pluggy, Cora/BPO e documentos de projeto aprovados.
- (b) Manuais: commits parciais inventariados e cherry-picks sem conflito.
- (c) Produção: nenhuma migração ou dado alterado; merge/deploy ainda não executados.

### Próximo passo exato

Concluir a paridade de WhatsApp e BPO, finalizar a Correção 16, adicionar testes das regras críticas e executar lint/suíte/build antes de qualquer migração de produção.
