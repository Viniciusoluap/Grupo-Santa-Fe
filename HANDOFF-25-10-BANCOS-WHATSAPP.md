# HANDOFF 25/10 — Bancos por API/importação e WhatsApp por QR code

Branch: `claude/sync-mirrored-repos-bsqnz3` (Prospecta e Santa Fé). Autorizado pelo dono em 25/10 ("autorizo tudo").
Merge, deploy e migração em produção ainda dependem de autorização separada.

## Decisões do dono (25/10)
- Pluggy no plano gratuito (Meu Pluggy). As chaves enviadas (Asaas, webhook Asaas, Pluggy) são **só da Prospecta**.
- Contas: Asaas (API), C6 (conectado no Meu Pluggy), Cora (arquivo baixado → importação). Inter fica para depois.
- Data inicial por conta: movimentações anteriores não pertencem à empresa e não podem se misturar.
- Importação por planilha, OFX ou PDF.
- WhatsApp: QR code via Evolution API hospedada no Railway.
- Sempre pedir autorização antes de executar.

## Etapa 1 — Prospecta: BPO › Bancos (concluída, não publicada)
- Migração `drizzle/0069_bancos_provedores.sql` (aditiva): `bank_accounts.provedor/credencial_encrypted/data_inicial/ultimo_erro`,
  `bank_transactions.origem`.
- `server/_core/asaas-extrato.ts`: saldo (`/finance/balance`) e extrato (`/financialTransactions`, paginado) com a chave da conta.
- `server/_core/pluggy.ts`: transações com `from` = data inicial e paginação; contas de um item; nome do banco; connect token.
- `shared/extrato-import.ts`: leitura de CSV, Excel, OFX e texto de PDF; data inicial; chave estável por linha (reimportar não duplica).
- `server/bancos.ts`: sincronização (Asaas/Pluggy), sincronização diária, prévia e confirmação da importação (PDF via `unpdf`).
- `server/bancos-router.ts`: `pluggySettings.*` (salvar, testar, conectar Meu Pluggy, buscar contas do item) e `bancario.*`
  (contas, data inicial/chave, sincronizar, importar prévia/confirmar). A chave nunca volta para a tela.
- `client/src/pages/admin/BancosPanel.tsx`: nova aba Bancos (substitui o formulário antigo do `AdminBpo.tsx`).
- Sincronização diária: dentro do cron diário já existente `/api/cron/lead-card-due` (sem novo cron na Vercel).
- `server/_core/secret-vault.ts`: valor `plain:<segredo>` gravado direto no banco é aceito e **recriptografado no primeiro uso**
  (forma de gravar as chaves sem acesso à chave do servidor).

## Etapa 2 — Prospecta: WhatsApp por QR code (concluída, não publicada)
- Migração `drizzle/0070_whatsapp_evolution.sql` (aditiva): `whatsapp_connections.instancia` e tabela
  `whatsapp_evolution_settings` (endereço + chave criptografada do servidor; linha única).
- `server/_core/evolution.ts`: testar servidor, estado, gerar QR (cria a instância se não existir), número conectado,
  enviar texto, remover.
- `server/whatsapp-router.ts`: `evolutionStatus`, `salvarEvolution` (testa antes de salvar), `conectarQr`, `statusQr`
  (consulta a cada 3 s); `enviar` e `desconectar` funcionam para QR e para a API oficial. Env `EVOLUTION_API_URL/KEY` é reserva.
- `client/src/components/whatsapp/ConexaoQrCode.tsx` na aba Conexão do `AdminWhatsApp.tsx` (API oficial fica em "Usar a API
  oficial do WhatsApp Business").
- Teste: `server/whatsapp-evolution.test.ts` (4, servidor simulado).

## Etapa 3 — Santa Fé: WhatsApp por QR code (concluída, não publicada)
- `web/src/lib/evolution.ts` reescrito como gêmeo do da Prospecta (antes era código sem uso).
- `web/src/lib/whatsapp/evolution-config.ts`: servidor salvo na tabela `configuracoes` (chave criptografada via
  `web/src/lib/segredo.ts`); sem migração. Env `EVOLUTION_API_URL/KEY` é reserva.
- `web/src/lib/actions/whatsapp.ts`: `statusServidorEvolution`, `salvarServidorEvolution`, `conectarWhatsappQr`,
  `statusWhatsappQr` (devolvem `{ erro }` legível, pois o Next esconde mensagens de erro em produção).
- `/api/whatsapp/enviar` e `/api/whatsapp/desconectar` funcionam para QR e API oficial.
- Tela: `web/src/app/admin/whatsapp/_components/conexao-qr-code.tsx` dentro da aba Conexão.
- Teste: `web/src/lib/__tests__/whatsapp-evolution.test.ts` (4, servidor simulado). tsc OK; eslint 0 erros.

## Etapa 4 — Santa Fé: BPO › Bancos (concluída pelo @dev AIOX, não commitada/publicada)
- Migração aditiva `web/prisma/migrations/20261025120000_bancos_provedores/migration.sql` (`IF NOT EXISTS`):
  `contas_bancarias.provedor/credencialEncrypted/dataInicial(DATE)/ultimoErro`, `transacoes_bancarias.origem`, tabela
  `pluggy_settings` (linha única id=1, Client ID/Secret criptografados). Aplicada só no banco local (`db execute`, 2x, sem drift).
  `prisma migrate deploy` falha por problema antigo (`migration_lock.toml` = sqlite) — não é desta etapa.
- `web/src/lib/extrato-import.ts` (gêmeo de `shared/extrato-import.ts`), `web/src/lib/bancos/asaas-extrato.ts`,
  `web/src/lib/bancos/pluggy.ts`, `web/src/lib/bancos.ts` (Prisma; sync, cron, prévia/confirmação, PDF via unpdf, Excel via xlsx).
- `web/src/lib/segredo.ts`: `plain:` + `segredoEmTextoPuro` (o commit de WhatsApp `e22573c` já importa essa função — **commitar
  junto**, senão `evolution-config.ts` não compila).
- `web/src/lib/actions/banco.ts`: server actions (`exigirModuloAcao("bpo")`, credenciais com `somenteEquipe`), erros via
  `capturarErroAcao`. Remover conta agora só desativa (igual à Prospecta). `/api/banco/sincronizar` usa a mesma lógica.
- Cron: sincronização diária dentro de `/api/cron/lead-card-due` (sem cron novo). Env `PLUGGY_CLIENT_ID/SECRET` vira reserva.
- Tela: `web/src/app/admin/bpo/_components/bancos-panel.tsx` na aba Contas Bancárias (`bpo-client.tsx`, `page.tsx`).
- Deps: `unpdf@1.9.1`, `pluggy-connect-sdk@2.14.2`, `xlsx@0.18.5` (o SF não tinha leitor de planilha).
- Testes: `web/src/lib/__tests__/extrato-import.test.ts` (11) e `bancos-sync.db.test.ts` (9, banco local real + PDF real com jspdf).

## Etapa 5 — Santa Fé: avisos em tempo real dos bancos (concluída pelo @dev AIOX, não commitada/publicada)
- `web/src/lib/bancos/pluggy.ts`: `garantirWebhookPluggy` (GET/POST `/webhooks`, evento "all", cabeçalho `x-webhook-token`).
- `web/src/lib/bancos.ts`: `segredoWebhookPluggy` (HMAC do AUTH_SECRET), `registrarWebhookPluggy`, `segredoConfere`
  (timingSafeEqual), aviso aos admins (`Notificacao` tipo "sistema", link `/admin/bpo?aba=bancos`) quando a sincronização grava
  movimentações novas, `sincronizarPorEvento` (trava de 30 s), token do webhook do Asaas em `configuracoes`
  ("asaas.webhookToken", criptografado; `plain:` recriptografado; env `ASAAS_WEBHOOK_TOKEN` de reserva). URL pública:
  `PUBLIC_SITE_URL` → `SITE_URL` → `https://www.gruposantafee.com.br`.
- Rotas: `web/src/app/api/pluggy/webhook/route.ts` e `web/src/app/api/asaas/webhook/route.ts` (sem token configurado: 401).
  O `src/proxy.ts` não exige login em `/api/*` — nada a liberar.
- Actions: `testarPluggy`/`importarItemPluggy` registram o webhook (erro vira aviso); `salvarTokenWebhookAsaasAcao` (só equipe).
- Tela: no "Ajustar conta" de conta Asaas, campo "Token do webhook do Asaas" e a URL a cadastrar no Asaas; `/admin/bpo?aba=bancos`
  abre direto a aba de bancos.
- Teste: `web/src/lib/__tests__/avisos-tempo-real.db.test.ts` (8, banco local real, APIs simuladas).
- Automáticos: vitest completo 843 ok / só as 10 falhas pré-existentes conhecidas; tsc 0 erros; eslint 0; build OK.
- Pendente em produção: cadastrar no painel do Asaas a URL `https://www.gruposantafee.com.br/api/asaas/webhook` com o token
  salvo na tela (manual por enquanto, igual à Prospecta; a API do Asaas tem `/v3/webhooks`, então dá para automatizar depois —
  nos dois sistemas, por paridade); o webhook da Pluggy é registrado sozinho ao clicar "Testar conexão".

## Testes
(a) Automáticos (Prospecta): `pnpm check` OK; vitest 135 arquivos / 984 testes OK; `vite build` OK.
- Novos: `server/extrato-import.test.ts` (11) e `server/bancos-sync.test.ts` (7, inclui PDF real gerado no teste).
  APIs do Asaas e da Pluggy simuladas: nenhum teste toca contas reais.
(a) Automáticos (Santa Fé, Bancos): vitest completo 828 ok / 10 falhas pré-existentes conhecidas + 1 arquivo
    (`api-acesso-modulos.test.ts`) que não carrega por `server-only` em `whatsapp/evolution-config.ts` (frente WhatsApp);
    novos 20/20 ok; tsc 1 erro só em `whatsapp-evolution.test.ts` (frente WhatsApp); eslint 0; `npm run build` OK.
(b) Manuais: nenhum ainda.
(c) Pendente em produção: este ambiente não acessa api.asaas.com nem api.pluggy.ai (bloqueio de rede), então o teste real
    das chaves só acontece após o deploy (botões "Sincronizar"/"Testar conexão").

## Próximo passo exato
1. Santa Fé: commitar Bancos (Etapa 4) junto com `segredo.ts`; WhatsApp por QR (ligar o `src/lib/evolution.ts` existente à tela).
2. Passo a passo do Railway para o dono publicar a Evolution.
3. Após autorização de deploy: aplicar 0069 em produção e gravar as chaves da Prospecta (`plain:` → recriptografadas no 1º uso).

## Fechamento do lote (25/10)
- Santa Fé: suíte completa 835 passando + as mesmas 10 falhas pré-existentes do ambiente local; tsc OK; build OK.
  Corrigidos: tipo no teste do WhatsApp e `vi.mock("server-only")` em `api-acesso-modulos.test.ts`.
- Prospecta: limite do arquivo de extrato alinhado à Vercel (3 MB na tela; base64 ≤ 4,3 MB no servidor). 984 testes OK.
- PRs em rascunho abertos nos dois repositórios. Merge/deploy/migrações em produção aguardam autorização.
- Próximo passo exato: com autorização → aplicar `0069`/`0070` (Neon) e `20261025120000_bancos_provedores` (Supabase),
  merge + deploy, gravar chaves da Prospecta como `plain:` (Asaas na conta "Asaas"; Pluggy em `pluggy_settings`),
  clicar "Sincronizar"/"Testar conexão" e conferir; dono publica a Evolution no Railway e conecta o QR.

## PUBLICADO EM PRODUÇÃO (25/10, autorizado: "Eu autorizo tudo")
- Merge: Prospecta PR #166 → main `61c7f27` (deploy `dpl_EaLk3NYi2TXazXQDk1uNKcjeXwRx`);
  Santa Fé PR #229 → main `b518061` (deploy `dpl_9PGXUEEieZqcTFHibEejHtm3XMTH`). Os deploys estavam BUILDING —
  **conferir na Vercel se ficaram READY e sem erros de runtime** (projetos prj_hVT5OCL8S5GbJ5L0GArH9aDxbFHR /
  prj_W8c9sow2dxFO5GDfqABwlKWodI1v, team team_0ACtTLoM4VLMrijmyLUPafHy).
- Migrações aplicadas em produção (aditivas): Prospecta Neon `plain-cake-26372935` → 0069 + 0070;
  Santa Fé Supabase `giulchozonhzyopmgmkv` → `bancos_provedores_20261025`.
- Avisos em tempo real (no deploy):
  - Prospecta: `server/pluggy-webhook.ts` (`/api/pluggy/webhook`, header `x-webhook-token` = HMAC do JWT_SECRET);
    `server/asaas-webhook.ts` sincroniza as contas Asaas do BPO a cada evento autenticado; notificação no sistema para
    admins quando entram movimentações novas; o webhook da Pluggy é registrado sozinho em "Testar conexão"/importar contas.
  - Santa Fé: mesmas regras (`/api/pluggy/webhook`, novo `/api/asaas/webhook` com token salvo na tela do BPO ou env
    `ASAAS_WEBHOOK_TOKEN`).
- Chaves da Prospecta gravadas no Neon como `plain:` (recriptografadas no 1º uso):
  - `pluggy_settings` (Client ID/Secret transcritos do print; se "Testar conexão" falhar, dono recola em BPO › Bancos › Pluggy).
  - `payment_settings` (asaas, production): chave de API (estrutura conferida, íntegra) + token do webhook `whsec_…`
    (transcrito do print; l/I podem ter saído trocados — se o Asaas acusar falha, recolar em Configurações › Pagamento).
    Recriptografia de `payment_settings` ocorre no cron diário (11h UTC).
- **NÃO criada** a conta Asaas no BPO: falta a **data inicial** (sem ela puxaria 12 meses e misturaria períodos).

## PENDÊNCIAS — próximo passo exato (Claude ou Codex)
1. Conferir os 2 deploys READY + erros de runtime. Se falhar: build log e corrigir na branch `claude/sync-mirrored-repos-bsqnz3`.
2. Dono informar a **data inicial** de Asaas, C6 e Cora. Então: criar conta Asaas em BPO › Bancos (Nova conta › API do
   Asaas) ou SQL em `bank_accounts` (provedor 'asaas', credencial_encrypted 'plain:<chave>', data_inicial).
   C6: dono clica "Conectar banco (Meu Pluggy)". Cora: dono importa OFX/CSV em "Importar extrato".
3. Dono clica "Testar conexão" (Pluggy) e "Sincronizar" (Asaas); registrar resultado (c) aqui.
4. Asaas › Integrações › Webhooks: URL `https://www.prospectaconstrucoes.com/api/asaas/webhook`, token `whsec_…`, ativo.
5. WhatsApp: dono publica a Evolution no Railway (railway.com/deploy/evolution-api-whatsapp; definir
   `AUTHENTICATION_API_KEY`; Settings › Networking › Generate Domain), cola endereço + chave em Admin › WhatsApp ›
   Conexão (Prospecta e Santa Fé), "Gerar QR code" e escaneia.
6. Lógyca (WhatsApp oficial) só quando o dono avisar.

## Testes — situação final
(a) Automáticos: Prospecta 136 arquivos / 988 testes OK, check e build OK; Santa Fé 843 ok + 10 falhas pré-existentes
    (drive-estrutura, exclusao-definitiva, medicao-drive, pci-upload, progresso-historico-janela, projeto-engenheiro),
    tsc/eslint/build OK. APIs externas sempre simuladas.
(b) Manuais: estrutura da chave Asaas conferida; migrações confirmadas por consulta.
(c) Pendente em produção: sincronização real Asaas/Pluggy, webhooks reais, QR do WhatsApp (depende do Railway).

## Conferência dos deploys (25/10 02:54 UTC)
- Prospecta `dpl_EaLk3NYi2TXazXQDk1uNKcjeXwRx` e Santa Fé `dpl_9PGXUEEieZqcTFHibEejHtm3XMTH`: **READY**, sem erros de runtime nos 15 min seguintes. Item 1 das pendências concluído.

## Lotes A–E (plano PLANO-25-10-BPO-WHATSAPP.md, autorizados pelo dono em 25/10)
Branch: `claude/sync-mirrored-repos-bsqnz3` (nos 2 repos).
- **Lote A — WhatsApp** (SF `80e0bec`; Prospecta `aa63c78`, `a928377`): variáveis preenchidas por destinatário
  (`web/src/lib/whatsapp/variaveis.ts`), prévia e bloqueio; aba Conversas; webhook `/api/whatsapp/evolution-webhook`;
  botão no lead. Migração `20261025190000_whatsapp_conversas`.
- **Lote B+D — Integrações** (SF: commit deste passo): `/admin/integracoes` (só admin) com Asaas (chave central em
  `configuracoes` `asaas.apiKey`/`asaas.webhookToken`, criptografadas), Pluggy e Evolution; status, erro real, `…XXXX`,
  Testar/Trocar. Campos de chave saíram de BPO › Bancos e do QR do WhatsApp. Conta Asaas sem chave própria usa a central.
  Env `ASAAS_API_KEY`/`ASAAS_WEBHOOK_TOKEN` passam a ter precedência sobre o banco (igual Prospecta; a tela avisa).
  Configurações deixou de enviar segredos de `configuracoes` ao navegador.
- **Lote C — Extrato → BPO**: lançamento 1:1 por movimentação (categorias aprovadas), transferência interna filtrada na
  leitura, DRE calculado no servidor. Migração `20261025180000_bpo_extrato`.
- **Lote E — publicar**: em andamento (PR, merge, migrações Supabase, deploy).

### Próximo passo exato
1. PR da branch → main, merge, conferir deploy READY.
2. Aplicar no Supabase `giulchozonhzyopmgmkv`: `20261025180000_bpo_extrato` e `20261025190000_whatsapp_conversas` (aditivas).
3. Dono: colar chaves em Admin › Integrações; Reprocessar movimentações em BPO › Bancos se houver extrato importado.

### Testes
(a) SF 899 ok + 10 falhas pré-existentes (drive-estrutura, exclusao-definitiva, medicao-drive, pci-upload,
    progresso-historico-janela, projeto-engenheiro); tsc/eslint/build OK com `/admin/integracoes`. Serviços externos simulados.
(b) Manuais: tela ainda não aberta no navegador. (c) Produção: chaves reais, webhook Asaas, QR.

## Lote E — publicado (25/10 ~17:35 UTC)
- PR #230 mesclado (main `a7f2668`); deploy de produção READY; sem erros de runtime.
- Migrações aplicadas no Supabase `giulchozonhzyopmgmkv`: `bpo_extrato_20261025` e `whatsapp_conversas_20261025` — colunas conferidas.
- Prospecta: PR #167 (main `00f397b`), deploy READY, migrações 0071/0072 no Neon.
### Falta (dono)
1. Admin › Integrações: colar as chaves próprias do Santa Fé (Asaas, Pluggy, Evolution) e Testar.
   Não consegui listar as envs da Vercel (403): se existir `ASAAS_API_KEY`/`ASAAS_WEBHOOK_TOKEN` lá, elas vencem — a tela avisa.
2. BPO › Bancos › "Reprocessar movimentações" se houver extrato importado.
3. WhatsApp › Conversas: abrir uma vez para registrar o webhook.
### Testes
(a) 899 ok + 10 falhas pré-existentes; tsc/eslint/build OK. (b) Colunas conferidas em produção. (c) Itens 1–3 acima.
