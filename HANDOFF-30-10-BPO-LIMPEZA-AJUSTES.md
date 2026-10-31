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
