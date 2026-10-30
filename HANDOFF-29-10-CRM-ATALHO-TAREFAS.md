# Handoff — CRM: atalho para tarefas e agendamentos

## Auditoria e plano
Pedido autorizado: substituir os quatro indicadores de resumo do CRM por um único atalho para o serviço existente de tarefas e agendamentos. Preservar dados, filtros e pipeline. Manter equivalência funcional entre os dois sistemas.
- Prospecta: adaptar a página AdminCRM, retirar os quatro resumos e consulta exclusiva de estatísticas, usar a rota existente /admin/tarefas-agenda.
- Santa Fé: os resumos de quatro indicadores não existem; manter os filtros funcionais por etapa e adicionar atalho equivalente para /admin/agenda.
- Trabalhar a partir da main atualizada, preservando alterações anteriores e histórico. Alteração somente de interface, sem migração ou escrita de dados.

## Estado inicial
Implementação em andamento na branch codex/crm-atalho-tarefas-20261030.
(a) Automáticos: pendentes (TypeScript, lint focalizado quando disponível, diff check).
(b) Manuais: pendente conferir navegação do atalho.
(c) Produção: publicação pendente.
Próximo passo: implementar, conferir diff/rota, concluir checks, PRs, merge e deploy autorizados e atualizar este registro.
