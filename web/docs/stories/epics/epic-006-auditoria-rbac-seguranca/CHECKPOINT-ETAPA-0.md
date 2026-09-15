# Checkpoint — Etapa 0: recuperação e checkpoint WIP

**Data:** 15/09/2026
**Branch:** `codex/auditoria-correcao-20260914` (criada a partir de `origin/main` — sem merge)
**Escopo:** handoff de auditoria integral Prospecta ↔ Grupo Santa Fé (RBAC, sessões, identidade
de corretor, WhatsApp, arquivos privados), recebido de outra sessão (GPT/Codex).

## Resultado da recuperação de workspace

O handoff referenciava um workspace local em `/workspace/scratch/52ab5092b27f/Grupo-Santa-Fe`
com ~63 arquivos alterados não commitados (incluindo novos `web/src/lib/auth/pages.ts`,
`web/src/lib/auth/principal.ts`, `web/src/lib/auth/resources.ts`, migration
`20260915000001_usuario_session_revocation`) e uma branch `codex/auditoria-correcao-20260914`
com base em `497c088`.

**Verificado nesta sessão:**

- `/workspace/scratch/52ab5092b27f/` **não existe** neste ambiente — não há nada para recuperar.
- Nenhuma branch `codex/auditoria-correcao-20260914` existe em `origin`.
- O `main` atual já está **adiante** da base citada no handoff (`497c088`) — já inclui C2
  (navegação e correção de autorização em bpo/avaliações/jurídico, PR #119/#120), concluído em
  rodada anterior desta mesma sessão.

**Conclusão:** não há WIP a recuperar. Toda a implementação descrita nas Etapas 1–5 do handoff
será construída do zero, a partir do `main` atual, seguindo a contingência prevista no próprio
handoff.

## Próximo passo

Etapa 1 (Prospecta é tratado primeiro — pagamentos/sorteios, maior risco financeiro). Para o
Santa Fé, este checkpoint registra apenas que não existe módulo de sorteios equivalente (ver
`Prospecta/CLAUDE.md` — exceção documentada de paridade). As correções de RBAC/sessão do Santa
Fé (Etapa 2) começam depois de fechada a Etapa 1 da Prospecta.
