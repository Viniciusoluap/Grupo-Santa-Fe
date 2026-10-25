# HANDOFF 25/10 — AIOX correções 02–14 — Grupo Santa Fé

## Checkpoint inicial
- Data: 25/10/2026. Repositório: `Viniciusoluap/Grupo-Santa-Fe`.
- Branch: `codex/aiox-correcoes-02-14-20261025`.
- Base remota: `main` em `b51806189e51bcc4247a590433ceafba70acc0df` (conferida por fetch).
- Autorização: implementar, testar, preparar PR, merge e deploy; coordenação final com a Prospecta pelo agente principal.
- Escopo: correções 02–14, excluída a correção 01 Asaas/Pluggy.
- Estado: auditoria concluída, código ainda não modificado neste checkpoint. Clone inicial limpo.
- Paridade: Prospecta em branch independente conduzida pelo agente principal.
- PR: nenhum aberto no momento da auditoria. Merge: não. Deploy: não.
- Banco: nenhuma migração ou alteração de dados realizada.
- Testes: (a) automáticos ainda não executados neste lote; (b) manuais não realizados; (c) produção pendente.

## Diagnóstico e próxima ação
- 02, 08, 11, 12, 14: elementos exatos da reclamação já ausentes nas telas equivalentes deste repositório; verificar que não há rota redundante antes de declarar concluído.
- 03, 04, 05, 06, 07, 09, 10, 13: necessitam intervenção e validação. Há somente um empreiteiro por obra no modelo atual.
- Próximo passo: corrigir layout dos filtros e histórico de medições; revisar os elementos já ausentes e executar testes direcionados. Depois publicar novo checkpoint.
- Riscos: alterações em componentes compartilhados, dados financeiros e fotos; manter banco e credenciais do Santa Fé separados da Prospecta.
- Para Claude: começar pelo SHA remoto desta branch, ler este handoff e os commits posteriores; nunca reaplicar indiscriminadamente patches da Prospecta. Verificar `origin/main` antes de cada integração.
