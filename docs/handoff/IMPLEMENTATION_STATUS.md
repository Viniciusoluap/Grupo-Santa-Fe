# Matriz das 16 correções — 27/10/2026

Estado da implementação após os checkpoints finais. Implementação não equivale a aceite integral em produção; as limitações estão explícitas por linha.

| Correção | Escopo | Prospecta | Grupo Santa Fé |
|---|---|---|---|
| 01 | Conexões em Serviços → WhatsApp | Implementada; sessão existente preservada | Implementada; sessão existente preservada |
| 02 | Identidade CRM / contato / número | Implementada e testes automáticos | Implementada e testes automáticos |
| 03 | Documentos e retorno à conversa | Implementada; teste físico móvel pendente | Implementada; teste físico móvel pendente |
| 04 | Textos profissionais dos seis templates | Implementada e validada automaticamente | Implementada e validada automaticamente |
| 05 | Seleção explícita de serviços | Implementada e validada no servidor | Implementada e validada no servidor |
| 06 | Visita com dia e horário | Implementada; campos persistentes | Implementada; campos persistentes |
| 07 | Gerenciador persistente de templates | Implementada; permissão administrativa | Implementada; permissão administrativa |
| 08 | Retirada visual do Histórico | Implementada; dados e métricas preservados | Implementada; dados e métricas preservados |
| 09 | Limpeza com prévia, backup e origem | Implementada; legados ambíguos protegidos | Implementada; legados ambíguos protegidos |
| 10 | Pluggy HTTP 410 | Causa real confirmada; v2 HTTP200 sem transações retornadas | Causa real confirmada; v2 HTTP200 sem transações retornadas |
| 11 | Importação Cora e identificação | Implementada; fixtures automáticas, próximo extrato real pendente | Implementada; fixtures automáticas, próximo extrato real pendente |
| 12 | Edição auditável de receitas/despesas | Implementada; versão, motivo e histórico | Implementada; versão, motivo e histórico |
| 13 | Receitas vinculadas e parciais | Implementada; chave idempotente, saldo e baixas | Implementada; chave idempotente, saldo e baixas |
| 14 | Sincronização CRM / cadastro livre | Implementada; documento complementar e proteção financeiro | Implementada; documento complementar e proteção financeiro |
| 15 | Despesas operacionais e etapas reais | Implementada; classificação contábil separada | Implementada; classificação contábil separada |
| 16 | Revisões, versões e checklist | Implementada; acesso real ao Drive/dispositivos pendente | Implementada; acesso real ao Drive/dispositivos pendente |

## Evidências e limites

- Prospecta: suíte final da Vercel aprovou 148 arquivos/1.101 testes no commit 3fa7e762. TypeScript local aprovado; transação e rollback reais aprovados.
- Santa Fé: 829 testes da suíte anterior em lotes; testes adicionais focados de BPO/WhatsApp e 5 testes de parciais aprovados. Prisma generate e TypeScript local aprovados.
- Bancos: migrações aplicadas após backups privados em aiox_backup_20261027. Mantidos 1.011 lançamentos Prospecta e 5 Santa Fé; nenhuma limpeza de conta real foi executada.
- Pluggy: resposta autenticada do endpoint antigo 410 ENDPOINT_DEPRECATED; v2 200 com lista vazia. Não houve sincronização financeira real nem criação de transações de teste em produção.
- PRs: Prospecta #172 e Santa Fé #235; merge e deploy devem ser conferidos no Handoff ativo antes de retomar.
- Não executados: uso em iPhone/Android físicos/PWA instalado; envio real de WhatsApp; upload real com usuário autenticado; importação de novo extrato Cora real. Estes aceites permanecem pendentes, independentemente do deploy.
