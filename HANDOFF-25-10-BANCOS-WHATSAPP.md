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
