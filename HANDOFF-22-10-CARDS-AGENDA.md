# Cards e agenda — 22/10/2026

## Concluído no código
- Data independente por card, edição individual no kanban, ordenação por vencimento e sem data no final.
- Tarefas e Agenda como serviço CRM cria TarefaCrm; prazo da tarefa é independente do card.
- Agenda exibe tarefas, visitas e vencimentos de cards; tarefas permitem editar status/prazo.
- Cron 11 UTC (08h Imperatriz), resumo único por destinatário/dia, email e notificação; admin vê todos, colaborador seus cards. Registros evitam repetição por card/data/canal na operação normal.
- Paridade Prospecta na branch homônima.

## Testes
(a) prisma validate e generate passaram; vitest datas 2/2; git diff --check passou. tsc completo bloqueado no ambiente por declarações ausentes de React/Node já declaradas no package.json; não considerar build aprovado.
(b) Interface não validada manualmente nesta sessão.
(c) Migração, SMTP, CRON_SECRET, cron e entrega real pendem de homologação; nenhum email disparado.

## Próximo passo e limitações
- Restaurar dependências de desenvolvimento do ambiente, rodar tsc/build e homologar antes de merge/deploy.
- Aplicar migration 20261022080000_vencimento_cards antes de publicar; build atual gera Prisma mas não executa migration automaticamente.
- Novos cards após resumo diário entram no próximo dia; reprogramar vencimento gera evento novo. Falha abrupta entre SMTP e registro tem janela de duplicidade.
- Alterações preexistentes de projetos/documentos/PCI e migrations de 20/10 foram preservadas e não fazem parte deste commit.
- Logyca permanece em análise, sem implementação: validar retorno de pendências documentais e aprovação/follow-up.
