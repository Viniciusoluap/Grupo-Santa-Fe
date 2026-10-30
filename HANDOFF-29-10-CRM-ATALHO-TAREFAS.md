# Handoff — CRM: atalho para tarefas e agendamentos

## Entrega concluída
Substituídos os quatro indicadores de resumo do CRM da Prospecta por um único atalho “Tarefas e Agendamentos”, usando /admin/tarefas-agenda. Consulta exclusiva das estatísticas retirada da página; dados, filtros e pipeline preservados.
No Santa Fé, adicionado atalho equivalente para /admin/agenda, preservando os filtros funcionais por etapa existentes.

## Validações
(a) Automáticas: TypeScript aprovado nos dois sistemas, lint focalizado Santa Fé aprovado, git diff --check aprovado. Cliente Prisma local regenerado após atualização da main, sem consulta ou alteração de banco. Revisão automática dos PRs concluída sem achados; previews e builds de produção READY. Não foram criados testes para esta alteração reversível de interface.
(b) Manuais: Prospecta validada em produção com sessão legítima: resumos removidos, único atalho visível e clique levando à área existente com tarefas e calendário. Nenhum cadastro alterado. Santa Fé sem sessão autenticada disponível; aceite manual equivalente não executado.
(c) Produção: merge e deploy confirmados nos dois domínios oficiais. Prospecta health HTTP200/banco conectado; Santa Fé login HTTP200. Scan inicial de logs error/fatal dos novos deployments sem registros; isso não substitui uso integral da aplicação.

## Publicação
- Prospecta: PR #181, merge d3550a9ef5e27eb302b9cef8b6fcbb11c888c8f0.
- Santa Fé: PR #243, merge c88fb340eba21a1890735a9830002ab98709dfb0.
- Branch preservada: codex/crm-atalho-tarefas-20261030. Este checkpoint documental final fica na branch, sem gerar nova publicação de produção apenas por documentação.

## Continuidade
Definições AIOX versionadas consultadas; recursos centrais referenciados não estavam presentes. Histórico e alterações anteriores preservados, sem reset ou force push.
Próximo passo opcional de aceite: conferir navegação autenticada Santa Fé e apresentação nos dispositivos habituais. Não há código, merge ou deploy deste pedido aguardando execução.
