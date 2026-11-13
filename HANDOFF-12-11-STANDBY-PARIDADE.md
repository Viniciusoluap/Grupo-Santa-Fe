# Handoff — Grupo Santa Fé em stand-by (paridade suspensa em 12/11/2026)

Decisão do dono em 12/11/2026: trabalhar exclusivamente na Prospecta. O Santa Fé fica parado até a ordem de
"paridade total". Este arquivo é a lista do que precisará ser portado quando a ordem vier. Regra registrada no
`CLAUDE.md` dos dois repositórios (seção "PARIDADE SUSPENSA").

## Estado do Santa Fé no momento da suspensão
- `main` em 487e004 (PR #257), em produção em gruposantafee.com.br.
- Já em paridade (11–12/11): Vias públicas e rua por lados (#252); Due Diligence e anexos de qualquer tipo
  (#252, migração `anexos_em_partes` aplicada no Supabase); filtros de tarefas atrasadas na Agenda (#253);
  seleção múltipla no CRM (#254); Estudo de Massa com motor v2, desenho técnico, área viária e unidades
  Q01/L01 (#256); correção da área mínima com formato "divisa" (#257).
- Pendente de validação em produção pelo dono: itens (c) do `HANDOFF-11-11-PARIDADE-PROSPECTA.md`.
- Outra sessão tinha a branch `claude/sync-mirrored-repos-bsqnz3` (mapa MapLibre) com commits fora da main;
  não foi tocada por esta sessão.

## A portar quando a paridade for retomada (origem: Prospecta)
### Incorporação (bloco 4, conferido no código em 12/11 — não existe no Santa Fé)
- Inteligência de Mercado com dois motores (IBGE + anúncios), IBGE pelo navegador, Tavily sem IA.
- Chaves de integração do Mercado no banco (criptografadas).
- Negociação: excluir proposta com auditoria; permuta = % do VGV com origem do VGV resolvida.
- Correções 09–12 da Viabilidade integrada (o motor da Prospecta divergiu do `lib/finance/loteamento.ts`).

### BPO Financeiro (12/11)
- Importar backup ZIP do Conta Azul (Prospecta #213): `shared/financeiro/conta-azul.ts`,
  `server/bpo-conta-azul.ts`, `ImportarContaAzul.tsx`. O layout do Novo Lançamento do Santa Fé não tinha o defeito.
- Conciliação com o extrato/Asaas sem duplicar, aba "A classificar", divisão de pagamentos (split), cadastro
  de centros de custo e filtros do BPO — publicados na Prospecta em 12/11 (PR #214, migrações 0103/0104) (ver `HANDOFF-12-11-BPO-CONTA-AZUL.md` de lá).

### Central de Vendas (12/11)
- Módulo novo na Prospecta, publicado em 12/11 (PR #215, migração 0110; entra desligado). Especificação em
  `docs/prompts/central-de-vendas.md` e detalhes em `HANDOFF-12-11-CENTRAL-DE-VENDAS.md` de lá.
- 13/11: **portado** neste repositório (ver `HANDOFF-13-11-PARIDADE-CENTRAL-VENDAS.md`).

### Pendências antigas do ROADMAP da Prospecta (não conferidas item a item no Santa Fé)
- EPIC-017 (vínculo lead ↔ serviços), EPIC-018 (corretores e comissões), EPIC-019 (layout da Central
  Administrativa), documentos do cliente no Atendimento → Drive. Atenção ao lote
  `codex/santa-fe-limpeza-crm-20261011`, que é exceção de escopo do Santa Fé.

## Próximo passo exato
Nenhum neste repositório até a ordem do dono. Quando vier: conferir cada item acima contra o código atual do
Santa Fé (não confiar só nesta lista), portar por blocos com PR e handoff, e remover a seção "PARIDADE
SUSPENSA" dos dois `CLAUDE.md`.
