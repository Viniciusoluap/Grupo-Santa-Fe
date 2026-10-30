# Handoff — CRM: atalho para tarefas e agendamentos

## Escopo e implementação
Substituídos os quatro indicadores de resumo do CRM da Prospecta por um único atalho “Tarefas e Agendamentos”, usando a rota existente /admin/tarefas-agenda. Consulta exclusiva das estatísticas retirada da página; dados, filtros e pipeline preservados.
No Santa Fé, adicionado atalho equivalente para /admin/agenda, preservando os filtros funcionais por etapa já existentes.

## Validações
(a) Automáticas: TypeScript aprovado nos dois sistemas; lint do arquivo Santa Fé aprovado; git diff --check aprovado. Cliente Prisma local regenerado após atualização da main, sem consulta ou alteração de banco. Nenhum teste novo para esta alteração reversível de interface.
(b) Manuais: navegação autenticada do atalho ainda pendente.
(c) Publicação: código pronto para PR, merge e deploy autorizados.

## Continuidade
Branch codex/crm-atalho-tarefas-20261030. Definições AIOX versionadas consultadas; recursos centrais referenciados não estavam presentes. Preservados histórico e alterações anteriores, sem reset ou force push.
Próximo passo: conferir builds dos PRs, fazer merge autorizado e acompanhar produção; registrar aceite de navegação e limitações reais.
