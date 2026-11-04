# Limpeza temporária do BPO — 30/10/2026

## Etapa 1 — auditoria e plano
- Branch `codex/bpo-limpeza-ajustes-20261030`, a partir da main publicada; histórico anterior preservado.
- Pedido: permitir limpeza de cobranças e despesas durante ajustes, inclusive registros pagos e importados, sem alterar serviços externos.
- Causa confirmada: o classificador atual protege todos os lançamentos com baixa, origem de extrato ou referência do provedor.
- A exclusão normal continua protegida. A solução usará um modo explícito de ajustes, restrito ao administrador, com prévia, confirmação, backup e restauração.
- Auditoria de integridade em andamento: vínculos de recebimentos, movimentos de obra, regularizações, combinações e sincronização precisam ser preservados; não basta retirar validações do DELETE.
- Nenhuma limpeza de dados de produção foi executada nesta solicitação.

## Verificação
(a) Automáticos: levantamento de código e relações; implementação pendente.
(b) Manuais: leitura dos fluxos e prints, sem alterar dados.
(c) Produção: pendente de implementação, revisão e publicação.

## Próximo passo
Fechar desenho transacional com orquestração, implementar com paridade, testar exclusão/restauração em banco isolado e publicar com os gates existentes.

## Etapa 2 — implementação Santa Fé
- Modo explícito `limpezaAjustes` no modal/API: cria backup e histórico e marca os lançamentos localmente, sem apagar recebimentos, vínculos, combinações ou referências externas. A exclusão normal mantém as proteções anteriores.
- Prévia de ajustes com impressão SHA-256 do alcance; a execução bloqueia as linhas e revalida o conjunto antes de gravar. Trocar o modo limpa confirmação e prévia anteriores.
- Listas, totais, cliente, notificações e seletores de novos vínculos deixam de oferecer registros arquivados; mutações antigas validam também o marcador no UPDATE.
- Restauração do novo formato remove somente o marcador daquele backup, sem recriar IDs nem passar pelo restaurador legado que limpava vínculos externos. Sincronização preserva a exclusão local.
- Migração aditiva `20261031010000_bpo_limpeza_ajustes`: coluna nullable e gatilhos para impedir novos vínculos, reativação ou aumento de alocação em lançamentos arquivados, mantendo os vínculos operacionais existentes.
(a) Automáticos: Prisma generate e TypeScript aprovados; diff-check aprovado. Testes isolados de banco, regressão e lint ainda em execução.
(b) Manuais: revisão de código em andamento; nenhuma operação de limpeza executada.
(c) Produção: schema, publicação e verificação de interface pendentes, sob a orquestração do root.
- Próximo passo: concluir testes significativos em ambiente isolado, revisão independente e publicar após os gates.

## Checkpoint de retomada — implementação parcial
- Código em andamento preservado na branch de trabalho, sem PR nem merge de produção nesta etapa.
- Verificações finais de integridade, regressão e escala ainda pendentes; não tratar este checkpoint como entrega concluída.
- Próximo passo: concluir testes e revisão independente, aplicar a migração aditiva sob a orquestração e publicar somente após os gates. Nenhuma limpeza de dados de produção executada.

## Validação local do Santa Fé — 04/11/2026

- Concluída a restauração em lote com bloqueio de linhas e histórico gravado na mesma transação. A exclusão para ajustes compara a prévia com o conjunto recalculado e exige que cada lançamento tenha sido efetivamente bloqueado.
- A sincronização ignora origens bancárias e cobranças Asaas arquivadas, inclusive quando os lançamentos perderam o vínculo com o extrato. O teste exercita mais de 500 origens ignoradas e a importação de uma transação nova.
- A limpeza da conta bancária usa a mesma trava de exclusão em lote antes de decidir quais lançamentos preservar. Lançamentos arquivados mantêm o backup e a chave estável de origem.
- Arquivos principais `web/src/lib/actions/banco.ts`, `web/src/lib/actions/bpo-lote.ts`, `web/src/lib/bancos/lancamentos-bpo.ts` e `web/src/lib/__tests__/bpo-limpeza-ajustes.db.test.ts`.

(a) Automáticos — 58 testes aprovados em seis arquivos, incluindo Prisma sobre PostgreSQL isolado para 823 lançamentos com recebimentos, histórico e vínculos preservados, prévia obsoleta, escopo, sincronização, limpeza de conta e gatilhos. A migração foi aplicada duas vezes nesse banco, com verificação da criação efetiva da coluna. TypeScript e diff-check aprovados. ESLint sem erros, com um aviso anterior de variável não usada na página de detalhes de BPO.
(b) Manuais — revisão dos trechos de transação, trava, auditoria e sincronização.
(c) Produção — publicação, migração e conferência de interface seguem com a orquestração.

Próximo passo — publicar esta revisão na branch de trabalho, conferir o PR e verificar a migração e a publicação antes da conferência da interface.
