# Alternativa mais barata ao Pluggy — Lote 4 (30/10/2026)

Arquivo gêmeo nos dois repositórios (Prospecta e Santa Fé). Decisão do dono de 30/10: seguir com a frente
"alternativa mais barata ao Pluggy (Asaas, C6, Cora, Inter)".

## Limite desta pesquisa (honestidade)
- **A web estava bloqueada pelo proxy desta sessão** (`CONNECT tunnel failed, 403` para developers.inter.co,
  developers.cora.com.br, developers.c6bank.com.br, pluggy.ai/pricing, docs.asaas.com, belvo.com).
  Nada abaixo foi reconferido hoje na fonte. Os valores vêm do que já estava documentado no repositório
  (`HANDOFF-24-10-OPEN-FINANCE.md`, `HANDOFF-24-10-LIMPEZA-CONTRASTE.md`, consultas de 24–25/10) e do conhecimento
  prévio sobre as APIs. **Confirmar preço e documentação antes de contratar/ligar em produção.**

## O que já existe no código (nos dois sistemas, mesma regra)
| Recurso | Situação |
|---|---|
| Asaas por API (extrato `/financialTransactions`, saldo, cobranças, webhook) | Pronto e publicado. Chave central em Configurações › Integrações. |
| Pluggy / Meu Pluggy (Open Finance via intermediário) | Pronto; usa o "Meu Pluggy" gratuito; a API paga da Pluggy não está contratada. |
| Importação de extrato OFX, CSV/planilha e PDF (com data inicial, sem duplicar, gera lançamentos no BPO) | Pronto (BPO › Bancos › Importar extrato). Usado hoje para a Cora (379 movimentações). |
| **Banco Inter PJ por API (novo, Lote 4)** | Implementado **atrás de chave desligada** (`BANCO_INTER_API=1`), testes simulados. Ver abaixo. |

## Comparação objetiva
| Opção | Tipo de acesso | Custo conhecido | Esforço de integração | Riscos / observações |
|---|---|---|---|---|
| **Pluggy (API paga, plano Dados)** | Open Finance via intermediário | a partir de **R$ 2.500/mês** (pluggy.ai/pricing, consultado em 24/10) | Já integrado | Descartado pelo dono por custo (teto R$ 50/mês). |
| **Meu Pluggy (gratuito)** | Open Finance, conta pessoal do titular | R$ 0 | Já integrado | Feito para uso pessoal (até 5 conexões do mesmo titular); sem garantia/SLA para CNPJ; o trial da API recusa chamadas ("trial expired"). |
| **Asaas** | API oficial do próprio Asaas | R$ 0 (já é cliente) | Já integrado | Restrição de IP na chave bloqueia a Vercel (erro 401 com dica na tela). |
| **Banco Inter PJ** | **API oficial** (API Banking: extrato e saldo) com OAuth2 + certificado mTLS | **R$ 0** | **Feito neste lote** (conector + cadastro + sincronização diária), desligado por padrão | Certificado vence em 1 ano (renovar no Internet Banking e recadastrar); rotas/escopo não reconferidos hoje (web bloqueada). |
| **Cora** | API oficial "Cora Direta" | **R$ 44,90/mês** (plano CoraPro, segundo levantamento de 24/10) | Médio (OAuth + certificado, semelhante ao Inter) — **não feito** | Custo mensal; enquanto isso, importar OFX/CSV (R$ 0) já funciona. |
| **C6 Bank PJ** | Sem API pública de extrato conhecida (portal C6 Developers foca em Pix/cobrança) | R$ 0 via arquivo | Já funciona por importação OFX/CSV (até ~180 dias no Web Banking) | Confirmar com o gerente se há API de extrato para PJ. |
| Outros agregadores (Belvo etc.) | Open Finance via intermediário | não verificado (web bloqueada) | Alto (novo provedor) | Mesmo modelo de custo da Pluggy; não recomendado sem cotação. |

## Recomendação
1. **Asaas por API** (já ativo) + **Inter PJ por API** (gratuito; ligar quando o dono gerar a integração) +
   **Cora e C6 por importação de arquivo** (OFX/CSV, R$ 0). Custo total: **R$ 0/mês**.
2. Só assinar o CoraPro (R$ 44,90/mês) se a importação manual da Cora virar gargalo; aí implementar o conector
   Cora no mesmo molde do Inter (o código do Inter serve de modelo).
3. Manter o Meu Pluggy só como apoio (sem depender dele para CNPJ).

## Conector Inter (implementado neste lote, desligado por padrão)
- Código: Prospecta `server/_core/inter.ts`, `server/bancos.ts` (sincronização), `server/bancos-router.ts` (cadastro),
  `client/src/pages/admin/BancosPanel.tsx`; Santa Fé `web/src/lib/bancos/inter.ts`, `web/src/lib/bancos.ts`,
  `web/src/lib/actions/banco.ts`, `web/src/app/admin/bpo/_components/bancos-panel.tsx`.
- Regra (igual nos dois): OAuth2 `client_credentials` com escopo `extrato.read` e certificado de cliente (mTLS);
  extrato em janelas de até 90 dias, todas as páginas, chave `inter:<idTransacao>` (sem duplicar); saldo
  `disponivel`; respeita a data inicial da conta; credencial (Client ID/Secret + .crt + .key) validada no Inter e
  salva **criptografada** na conta; erros com o motivo real do Inter + o que fazer (401 credencial/certificado,
  403 escopo, 400 parâmetros, 429, 5xx); entra na sincronização diária quando ligado.
- Testes (simulados, nenhum acesso ao Inter): Prospecta `server/banco-inter.test.ts`, `server/banco-inter-sync.test.ts`;
  Santa Fé `web/src/lib/__tests__/banco-inter.test.ts`, `web/src/lib/__tests__/banco-inter-sync.db.test.ts`.
- **Para ligar (passo manual inevitável, mínimo):**
  1. Dono, no Internet Banking PJ do Inter › Integrações: criar a integração com a permissão
     "Consultar extrato e saldo"; baixar o certificado (.crt) e a chave (.key); copiar Client ID e Client Secret.
  2. Agente: conferir as rotas em developers.inter.co (não foi possível hoje), ligar `BANCO_INTER_API=1` no
     ambiente (Vercel do projeto) com autorização do dono.
  3. Dono: BPO › Bancos › Nova conta › "API do Banco Inter PJ (beta)", colar os 4 itens (nunca pelo chat), data inicial.
  4. Clicar "Sincronizar" e conferir saldo/movimentações (validação (c) em produção).
