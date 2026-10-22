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
(c) Migração aplicada no Supabase de produção e estrutura/RLS conferidos; CRON_SECRET de produção configurado na Vercel. Execução do cron e entrega real ainda pendem de homologação; nenhum email disparado nesta sessão.

Prévia Vercel do primeiro commit `ea919c0` falhou na tipagem de `src/lib/data/projetos.ts` (`projeto_completo` fora de `ProjetoTipo`). A correção pontual preexistente no diretório local troca para `projeto_estrutural` e segue em commit adicional desta branch; verificar o novo status Vercel.

A nova prévia Vercel `GursMEAT4RJ2mReQu8os9MFcDJJd` ficou READY após o commit remoto `045e4ce`. A integração com o `main` preservou a sincronização do financiamento no tipo `ClienteLead`; a prévia final `dpl_2nCXoHwMBqqr15fqLitkbhnFEoQp` ficou READY. As três tabelas novas receberam RLS na migração. PR #210 integrado pelo squash `c935c03e6bdbe1efee65e05d8fc87ae0b9b2b09c`; deploy de produção `dpl_A67JFRSkYXMrnd7g3fn57m8CsMDA` READY. O domínio www.gruposantafee.com.br respondeu 200 e não apareceram erros nos logs consultados.

## Próximo passo e limitações
- Homologar o fluxo autenticado de edição individual, tarefas e calendário, e o primeiro resumo agendado às 08h de Imperatriz. O build Vercel da árvore integrada passou; o tsc local continua limitado pelas dependências ausentes naquele ambiente.
- Migration 20261022080000_vencimento_cards aplicada em produção via Supabase (`vencimento_cards_20261022`); o banco confirmou coluna e três tabelas com RLS.
- Novos cards após resumo diário entram no próximo dia; reprogramar vencimento gera evento novo. Falha abrupta entre SMTP e registro tem janela de duplicidade.
- Alterações preexistentes de projetos/documentos/PCI e migrations de 20/10 foram preservadas e não fazem parte deste commit.
- Logyca permanece em análise, sem implementação: validar retorno de pendências documentais e aprovação/follow-up.
