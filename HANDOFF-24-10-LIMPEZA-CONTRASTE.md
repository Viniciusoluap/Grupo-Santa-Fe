# HANDOFF 24/10 — Contraste, retirada de pagamento legado e feeds XML, WhatsApp e integração bancária

Branch: `claude/sync-mirrored-repos-bsqnz3` nos dois repositórios. Decisões do dono em 24/10.

## Decisões do dono (24/10)
1. Contraste: corrigir (autorizado), incluindo os 2 itens do Santa Fé (preço do card de imóvel e ✓ da etapa).
2. O provedor de pagamento internacional legado deve ser **totalmente retirado** e **não deve ser mencionado de
   novo** nas conversas. Pagamentos: só Asaas.
3. Feeds XML: retirar dos dois repositórios (redundantes).
4. WhatsApp: exibir QR code para conectar o número e usar o que já existe, até concluir a negociação com a Lógyca
   (o dono avisará; aí implementar a integração deles).
5. Integração bancária: orçamento máximo **R$ 50/mês** (ideal R$ 0). Contas: **Asaas, C6, Cora, Inter**. Uso: BPO.

## Feito neste lote (não publicado — aguarda autorização de merge/deploy)
- Contraste (@ux AIOX):
  - Prospecta: `ProjetosOrcamentos.tsx` e `Portal.tsx`.
  - Santa Fé: 49 telas / 173 trocas (cinza-claro em fundo branco → cinza legível).
  - Santa Fé, 2 itens aprovados: preço do `property-card` em `--brand-dark`; ✓ da etapa em `bg-green-700`.
- Prospecta, pagamento legado retirado:
  - removidos o webhook, o cliente, o teste e a dependência do pacote;
  - removidas as chaves de ambiente e a opção desabilitada em Configurações › Pagamento;
  - FAQ e Política de Privacidade passam a citar o Asaas.
  - As colunas antigas da tabela `tickets` foram mantidas no banco (sem migração). No código viraram
    `paymentProviderId` (guarda o ID do Asaas) e `legacyCheckoutSessionId` (sem uso).
- Feeds XML retirados:
  - Prospecta: rota e gerador, os 4 checkboxes do formulário de imóvel e os rótulos "feeds" no hub e no agregador.
  - Santa Fé: só restavam campos no `obras/localizacao.ts`, também retirados.
  - Colunas `publicado_zap/olx/viva/(chaves)` mantidas no banco, sem uso (sem migração destrutiva).
- Prospecta: `api/index.ts` publica o webhook do WhatsApp (antes de `express.json`, corpo bruto). O teste
  `server/api-rotas-producao.test.ts` garante a paridade de rotas entre o servidor local e a Vercel.

## WhatsApp por QR code — situação e o que falta
- Santa Fé: `src/lib/evolution.ts` já tem criar instância, obter QR, status, desconectar e enviar texto
  (Evolution API, Baileys). Não está ligado a nenhuma tela.
- Prospecta: usa a API oficial do WhatsApp Business (sem QR).
- **Dependência inevitável:** a Evolution API é um servidor que precisa ficar ligado 24h (não roda na Vercel).
  Opções: VPS própria (~R$ 25–40/mês) ou serviço de Evolution hospedado. Precisa de `EVOLUTION_API_URL` e
  `EVOLUTION_API_KEY`.
- Risco: conexão por QR (não oficial) pode levar a bloqueio do número pelo WhatsApp em uso intenso; usar com
  moderação até a integração da Lógyca.
- Próximo passo: o dono escolhe onde hospedar a Evolution. Depois, implementar a tela "Conectar WhatsApp" (QR) nos
  dois sistemas, com credenciais salvas pela tela e criptografadas (automação primeiro).

## Integração bancária ≤ R$ 50/mês — pesquisa (24/10)
- Pluggy (usada também no Exclusive): plano Dados a partir de R$ 2.500/mês. Fora do orçamento.
  O "Meu Pluggy" gratuito é para uso pessoal (5 conexões do mesmo titular), sem garantia para CNPJ.
- Caminho proposto, integração direta por banco:
  | Banco | Como | Custo |
  |---|---|---|
  | Asaas | API própria (`/financialTransactions` e saldo); já temos a chave nos dois sistemas | R$ 0 |
  | Inter PJ | API Banking (extrato e saldo), certificado + Client ID/Secret gerados no Internet Banking; renova a cada 1 ano | R$ 0 |
  | Cora | API Direta exige o plano CoraPro (R$ 44,90/mês); alternativa: importar OFX/CSV | R$ 44,90 ou R$ 0 |
  | C6 PJ | Sem API pública para extrato; exportar OFX/CSV pelo Web Banking (até 180 dias) e importar no sistema | R$ 0 |
- Total: **R$ 0 a R$ 44,90/mês**.
- Próximo passo: o dono aprova o caminho. O agente implementa, nos dois sistemas:
  - BPO › Bancos com conectores Asaas e Inter;
  - importador OFX/CSV para C6 e Cora;
  - opcionalmente, o conector Cora via CoraPro.

## Testes
(a) Automáticos:
- Prospecta: `pnpm check` OK; vitest 132 arquivos / 962 testes OK (os testes do pagamento legado saíram junto);
  `pnpm build` OK.
- Santa Fé: tsc OK; eslint 0 erros (8 avisos pré-existentes); vitest 811 passando + as mesmas 10 falhas
  pré-existentes do ambiente local; build OK.
(b) Manuais: cálculo de contraste por cor (agente UX); teste local das rotas do servidor de produção.
(c) Pendente em produção: olhar as telas ajustadas; conferir o formulário de imóvel (sem checkboxes de feed) e
    Configurações › Pagamento (só Asaas).

## Próximo passo exato
1. Dono autoriza merge/deploy deste lote (PRs abertos em rascunho).
2. Dono decide a hospedagem da Evolution API (WhatsApp por QR) e o caminho bancário proposto.
