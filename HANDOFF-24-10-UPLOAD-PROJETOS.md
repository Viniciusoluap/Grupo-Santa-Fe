# HANDOFF 24/10 — Envio de arquivos em Projetos falhava em produção (Prospecta)

Branch: `claude/sync-mirrored-repos-bsqnz3` (Prospecta). Santa Fé: sem alteração de código (ver paridade).

## Sintoma (print do dono, 24/10 00:11)
Projetos › Editar › "Enviar arquivo editável"/"Enviar PDF" → toast "The string did not match the expected pattern."
e nenhum arquivo enviado.

## Causa raiz
- A rota Express `POST /api/projetos/:projectId/documentos` (server/routes/projeto-documentos.ts) só estava
  registrada no servidor local (`server/_core/index.ts`). O servidor de produção da Vercel é `api/index.ts`,
  que não a registrava → o Express respondia 404 em HTML ("Cannot POST …").
- O cliente (`client/src/lib/project-upload.ts`) fazia `res.json()` nessa página HTML; no Safari o erro de
  JSON aparece como "The string did not match the expected pattern".
- Logs da Vercel (2h) sem nenhuma chamada a `/api/projetos` em função → confirma que a rota não existia.
- Afeta também o envio da versão revisada no card "Solicitar revisão" (mesma rota, `revisionId`).

## Correção
- `api/index.ts`: importa e registra `projetoDocumentosRouter` (junto de obra-fotos, medição CAIXA, etc.).
- `client/src/lib/project-upload.ts`: resposta fora de JSON vira mensagem em português com o código HTTP.
- `server/api-rotas-producao.test.ts` (novo): falha se alguma rota de `server/routes` registrada no servidor
  local não estiver em `api/index.ts` (exceção documentada: `imovel-feeds`). Reproduz o bug sem a correção.

## Achados à parte (NÃO alterados — decisão do dono)
- Também só existem no servidor local, não em produção: `imovel-feeds` (feeds XML),
  webhook do WhatsApp (`/api/whatsapp/webhook`) e webhook do Stripe. Avaliar se devem ir para produção.

## Paridade
- Santa Fé usa rota do Next (`web/src/app/api/projetos/[id]/documentos/route.ts`), publicada automaticamente;
  não tem essa falha. Nada a portar.

## Testes
(a) Automáticos: `pnpm check` OK; vitest 133 arquivos / 973 testes OK; `pnpm build` OK.
    Teste novo falha sem a correção e passa com ela.
(b) Manuais: logs de produção (Vercel) conferidos — nenhuma requisição chegou à rota.
(c) Pendente em produção (após deploy autorizado): enviar um PDF e um arquivo editável num projeto e
    entregar uma versão no card "Solicitar revisão".

## Publicação (24/10, autorizada pelo dono: "Pode fazer o merge e deploy")
- Prospecta PR #164 → main `0209872`, deploy `dpl_4dKUWErdfVQ15Ae9D6DvMLimBjGK` **READY**.
- Santa Fé PR #227 (só handoffs) → main `98f0dd0`, deploy `dpl_5sHUAC3ESibVoA65BFMkp5ZtRa3j` **READY**.
- Sem erros de runtime nos 15 min seguintes. A chamada direta ao domínio não foi possível deste ambiente
  (proxy bloqueia prospectaconstrucoes.com), então o teste real de envio fica para o dono (c).

## Próximo passo exato
1. Dono: em Projetos › Editar, "Enviar PDF" e "Enviar arquivo editável" num item salvo; e entregar uma versão
   no card "Solicitar revisão". Se falhar, a mensagem agora mostra o código HTTP — usar isso no diagnóstico.
2. Decisão pendente do dono: publicar também `imovel-feeds`, webhook do WhatsApp e webhook do Stripe.
