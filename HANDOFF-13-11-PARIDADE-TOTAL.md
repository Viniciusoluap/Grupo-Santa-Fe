# HANDOFF 13/11 — Paridade total Prospecta → Grupo Santa Fé

Ordem do dono (13/11): "Realize a total paridade com o grupo santa fe / leve tudo que fizemos na Prospecta para lá".
Autorização do dono para merge, deploy e migrações de produção: "Autorizo tudo, pare somente quando finalizar e testar".

## Concluído (integrado na branch `claude/intelligent-ptolemy-av0qoh`)
| Frente | Branch | Handoff detalhado |
|---|---|---|
| BPO (Conta Azul, A classificar, dividir pagamentos, centros de custo, filtros, aba Clientes) | `claude/paridade-bpo` | `HANDOFF-13-11-PARIDADE-BPO.md` |
| Central de Vendas (11 etapas; entra desligada e em modo de teste) | `claude/paridade-central-vendas` | `HANDOFF-13-11-PARIDADE-CENTRAL-VENDAS.md` |
| Incorporação bloco 4 (Mercado 2 motores + IBGE no navegador + Tavily, chaves no banco, Negociação, Viabilidade 09–12) | `claude/paridade-incorporacao` | `HANDOFF-13-11-PARIDADE-INCORPORACAO.md` |
| Pendências antigas (EPIC-017 endereço no lead, EPIC-018 corretor inativo; EPIC-019 = exceção documentada) | `claude/paridade-legado` | `HANDOFF-13-11-PARIDADE-PENDENCIAS-ANTIGAS.md` |

Ajuste na integração: RLS + REVOKE anon/authenticated em `bpo_centros_custo` (padrão das demais tabelas).

## Migrações aplicadas no Supabase de produção (giulchozonhzyopmgmkv) em 13/11, ANTES do merge
- `20261113400000_lead_endereco`
- `20261113100000_bpo_paridade_conta_azul_a_classificar` (semente gerou 1 centro de custo — só há 1 nome hoje nos lançamentos)
- `20261113200000_central_vendas`
Conferência: contagem de colunas/restrições/índices em produção = mesma execução dos arquivos em PGlite (129/27/31); RLS ligado em todas as tabelas novas.

## Testes
(a) Automáticos, na branch integrada: `tsc` 0 erros; `vitest` 183 arquivos / 1401 testes passaram (29 arquivos pulados por precisarem de `TEST_DATABASE_URL`); `next build` compila e só para na geração estática sem banco (esperado). `eslint` nos alterados: 1 erro `react-hooks/preserve-manual-memoization` em `viabilidade-tab.tsx` (do mesmo tipo dos 2 que o arquivo já tinha) e avisos antigos.
(b) Manuais: a frente BPO testou as telas com `next dev` + Playwright (390 px) em banco local sintético.
(c) Pendentes em produção: ver a seção "Validar em produção" de cada handoff. Principais: importar o ZIP do Conta Azul; A classificar com extrato real; dividir um pagamento; Central de Vendas com número de teste; Mercado (IBGE pelo navegador, Tavily com chave); abrir estudos salvos em Viabilidade/Business Plan/PDF; lead com endereço vinculado a Avaliação/Obra/Regularização.

## Diferenças que restaram (registradas nos handoffs de cada frente)
- Avaliação vinculada: no Santa Fé o endereço continua editável na avaliação (para não apagar endereços já digitados); na Prospecta é sobrescrito pelo do lead.
- BPO: transferência interna gera lançamento fora de DRE/totais (regra antiga daqui; números iguais); Asaas sem id de pagamento continua ligando só pelo id.
- Viabilidade: autosalvamento da Prospecta não portado (Santa Fé mantém "Salvar premissas").

## Mudanças de comportamento visíveis para o dono
- BPO: movimentações novas do banco sem correspondência segura vão para "A classificar" em vez de entrar direto no DRE.
- Viabilidade: estudos com proposta aceita passam a descontar o terreno; com Business Plan, consideram a captação.

## O que o dono precisa configurar
- Chave do Tavily (opcional, motor de anúncios): `TAVILY_API_KEY` ou linha `segredo.tavily_api_key` em `configuracoes`.
- Central de Vendas: operadores, números de teste, checklists, produtos, sequências; depois ligar o interruptor geral.

## Próximo passo exato
Depois do merge: verificar o deploy de produção na Vercel e `get_runtime_errors`; abrir as páginas /admin/bpo, /admin/central-vendas e um estudo de incorporação.
