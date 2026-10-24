# HANDOFF 24/10 — Conexão das contas bancárias (Open Finance via Pluggy)

Vale para Prospecta e Santa Fé. Estado em 24/10: **nenhuma conta conectada** (produção, consulta só leitura:
Prospecta `pluggy_settings`=0, `bank_accounts`=0, `bank_transactions`=0; Santa Fé `contas_bancarias`=0,
`transacoes_bancarias`=0).

## Como funciona (resumo para o dono)
- A Pluggy é a empresa intermediária, autorizada no Open Finance, que lê extrato e saldo das contas com o
  consentimento do titular. O sistema conversa só com a Pluggy (credenciais `clientId`/`clientSecret`).
- O titular da conta (a empresa) autoriza no app/internet banking do próprio banco, pela tela da Pluggy
  ("Pluggy Connect"). O consentimento tem prazo e pode ser revogado no banco a qualquer momento.
- Custo: o titular da conta não paga nada ao banco; quem paga é quem contrata a Pluggy. Preço público
  (pluggy.ai/pricing, consultado em 24/10): plano Dados a partir de **R$ 2.500/mês**; sandbox gratuito sem
  prazo e teste de 15 dias em produção sem cartão. Confirmar plano/valor direto com a Pluggy antes de assinar.

## O que já existe no código
- Prospecta: tabelas `pluggy_settings` (credencial criptografada no banco), `bank_accounts`, `bank_transactions`;
  cliente `server/_core/pluggy.ts` (auth, transações, saldo); aba "Bancos" em `AdminBpo.tsx`; botão Sincronizar.
- Santa Fé: `ContaBancaria`/`TransacaoBancaria`, `lib/actions/banco.ts`, `api/banco/sincronizar`; credencial via
  variáveis `PLUGGY_CLIENT_ID`/`PLUGGY_CLIENT_SECRET` (diferente da Prospecta).

## O que FALTA (lacuna real)
1. **Pluggy Connect não está implementado em nenhum dos dois.** Hoje o sistema pede o `pluggyAccountId` digitado à
   mão — e esse ID só existe depois que o titular conecta o banco pela tela da Pluggy. Falta: endpoint que gera o
   *connect token*, o widget Pluggy Connect na aba Bancos, e ao concluir buscar as contas do *item* e cadastrá-las
   sozinho (sem digitar ID).
2. Paridade: Santa Fé passar a guardar a credencial criptografada no banco com tela própria (como a Prospecta),
   para o dono não precisar mexer em variáveis da Vercel (regra "automação primeiro").
3. Sincronização automática diária (cron) + webhook da Pluggy para atualizar quando o banco libera dados novos.
4. Testes com o sandbox da Pluggy (conector de teste) antes de usar contas reais.

## Passo a passo — o que o dono faz (manual, inevitável)
1. Criar conta em pluggy.ai (dashboard) com o e-mail da empresa.
2. No dashboard, criar uma "aplicação" e copiar `Client ID` e `Client Secret` (começa no sandbox, grátis).
3. Colar as duas credenciais na tela Configurações › Bancos (Prospecta já tem; Santa Fé ganha a mesma tela).
   Nunca mandar o segredo pelo chat.
4. Quando o teste no sandbox estiver ok: contratar o plano de produção com a Pluggy (comercial).
5. Na aba Bancos, clicar "Conectar banco", escolher o banco, autorizar no app do banco (com o usuário
   que tem poder de consentimento na conta PJ). Repetir para cada banco/conta.
6. Renovar o consentimento quando o banco pedir (o prazo é definido no consentimento).

## O que o agente faz (automático)
- Implementar itens 1–4 de "O que FALTA" nos dois sistemas, com testes e handoff; aplicar migrações por código.
- Validar com o sandbox assim que existirem credenciais de sandbox salvas na tela.

## Próximo passo exato
Aguardando o dono: (a) autorizar a implementação do Pluggy Connect (itens 1–4) e (b) criar a conta Pluggy
(sandbox) e salvar as credenciais na tela.
