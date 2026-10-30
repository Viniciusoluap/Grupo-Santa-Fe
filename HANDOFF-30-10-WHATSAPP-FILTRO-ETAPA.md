# HANDOFF 30/10 — WhatsApp › Enviar mensagem › filtro por etapa do lead

Branch: `claude/whatsapp-filtro-etapa-20261030` (gêmea na Prospecta, mesmo nome). Sem migração.

## Feito
- Card "Destinatários": select à direita do título com "Todas as etapas" + as 7 etapas do CRM
  (`ETAPAS_ACOMPANHAMENTO` — mesmos nomes do filtro do CRM: Lead Novo … Finalizado). No celular o select
  quebra para a linha de baixo (`flex-wrap`, `w-full sm:w-auto`).
- Etapa de cada lead calculada no servidor com `etapaDoLead` (mesma regra do CRM); lead sem etapa
  classificada aparece só em "Todas as etapas". Excluídos/arquivados continuam fora (`LEAD_ATIVO_WHATSAPP`).
- Lista sem paginação: "Selecionar todos (N)" mostra o total filtrado (etapa + busca) e marca todos.
- Seleções feitas antes de trocar o filtro são mantidas; "Selecionar todos"/"Limpar" agem só nos visíveis;
  linha "N selecionados no total (M fora deste filtro)".
- Envio: o servidor já manda uma mensagem individual por destinatário (laço em `api/whatsapp/enviar`,
  não é grupo). A tela agora envia em lotes de 200 (`lotesDeEnvio`), igual à Prospecta (teto de 200 no tRPC).
- Arquivos: `web/src/lib/whatsapp/conversas.ts` (ETAPA_TODAS, filtrarDestinatarios, limparVisiveis,
  resumoSelecao, LOTE_ENVIO_WHATSAPP, lotesDeEnvio), `web/src/app/admin/whatsapp/page.tsx`,
  `web/src/app/admin/whatsapp/_components/whatsapp-client.tsx`,
  `web/src/lib/__tests__/whatsapp-filtro-etapa.test.ts` (novo).

## Testes
- (a) Automáticos: `npx vitest run` whatsapp-*.test.ts (sem .db) + portal-corretor.test.ts → 38/38;
  `npx tsc --noEmit` ok; `npx eslint` nos arquivos alterados: 0 erros (warning `_isPending` já existia).
- (b) Manuais: nenhum (sem navegador nesta sessão).
- (c) Pendente em produção: abrir WhatsApp › Enviar mensagem no iPhone, filtrar por etapa, "Selecionar
  todos", conferir contador e envio individual.

## Próximo passo
Revisar o PR e validar (c) após o deploy. Paridade: Prospecta já implementada na branch gêmea.
