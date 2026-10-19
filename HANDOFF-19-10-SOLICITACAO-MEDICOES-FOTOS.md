# Handoff — solicitação de medições e galeria — 19/10/2026

## Etapa 1 — implementação nos dois repositórios
Branch: `codex/medicoes-email-galeria-20261019`.

Concluído:
- Solicitar medição gera PDF e XLS do tipo salvo (PLS, repactuação ou alteração) e envia ambos para `atendimento@prospectaconstrucoes.com` nos dois sistemas.
- Sem qualquer anexo válido, não registra a solicitação. Reserva transacional impede envios concorrentes; administradores ativos recebem notificação interna sem duplicação por reenvio.
- Estado persistido do e-mail: sending/sent/failed, aviso de falha e botão Reenviar. Tentativas interrompidas podem ser retomadas após dois minutos. Não há garantia de entrega na caixa de entrada: sent indica aceitação SMTP.
- Fotos passa a consulta, agrupada por medição (numeração considera inclusive medições sem foto), avanço e percentual acumulado. Fotos antigas sem vínculo preservadas em seção própria. Novos uploads exigem medição no backend.
- Mantidos os controles de fotos na aba Progresso e os acessos do empreiteiro à própria obra.
- Migrações aditivas: Prospecta 0060_medicao_email; Santa Fé 20261019180000_medicao_email. Ainda não aplicadas em produção nesta etapa.

## Testes
(a) Automáticos: TypeScript passou nos dois. Prospecta: suíte completa 865 testes antes de adicionar 3 casos de galeria/DB e 1 SMTP; teste adicional com PostgreSQL embarcado (PGlite), galeria e transporte passou (10 casos). Build Prospecta passou. Santa Fé: 698 testes passaram / 50 dependentes de TEST_DATABASE_URL pulados, antes do novo caso de transporte. Build compilou e passou TypeScript; geração da página inicial interrompida por ECONNREFUSED do banco local. Compilação de produção será conferida na Vercel.
(b) Manual: código, permissões, paridade e componentes revisados; sem envio de solicitação fictícia à empresa.
(c) Pendente: migrações de produção, builds Vercel, inspeção dos domínios e fluxo autenticado. SMTP_HOST/USER/PASSWORD/PORT existem nos dois projetos (somente metadados consultados).

## Próximo passo
Concluir verificações automatizadas, aplicar migrações aditivas com registro consistente no histórico do ORM, abrir PRs, conferir checks, merge dos SHAs revisados, acompanhar deploys e confirmar os domínios de produção. Atualizar este documento com evidências finais e salvar novamente no GitHub.

## Continuidade
Os scripts de QA de modelos CAIXA não rastreados já pertencem ao trabalho anterior na branch `claude/sync-mirrored-repos-bsqnz3`; não incluídos nesta alteração. Não sobrescrever dados PCI/medições reais.

## Etapa 2 — validação e preparação da publicação
- Etapa 1 salva e conferida no GitHub: Prospecta `1b18b37`; Santa Fé `3e03018`.
- PRs: Prospecta #139; Santa Fé #204. Autorizações de merge/deploy dadas pelo usuário neste pedido.
- Suítes finais: Prospecta 869/869 em 108 arquivos; Santa Fé 699 aprovados / 50 testes de banco pulados (86 arquivos aprovados / 10 pulados). TypeScript passou nos dois; ESLint dos três componentes alterados do Santa Fé passou.
- Teste real com PGlite executa a migração 0060 e a mutação da Prospecta: registro + notificação transacionais, somente admin ativo, preservação da data original, reenvio após falha SMTP e bloqueio após sucesso. Inclui verificação do link correto da notificação (`/admin/obras/editar/:id`, formato da Prospecta).
- Migrações aplicadas e colunas verificadas nos bancos de produção: Neon produção `br-steep-leaf-anxdjv1p` (transação aditiva) e Supabase `giulchozonhzyopmgmkv` (apply_migration `medicao_email_solicitacao_20261019`). Não foram alterados dados de medições ou fotos.
- Histórico operacional existente: Neon registra Drizzle apenas até 0040, com migrações posteriores aplicadas manualmente antes deste trabalho; não avançamos artificialmente o journal para 0060, pois isso pularia lacunas antigas. Santa Fé não tem `_prisma_migrations`; a aplicação foi registrada pelo mecanismo existente do Supabase. Não executar `drizzle migrate`/`prisma migrate deploy` genéricos para resolver essas lacunas sem plano próprio.
- Previews Vercel construídos em READY: Prospecta `dpl_3kEe5hivN19QQzYkppVdb2sGjcz8`, Santa Fé `dpl_8RPVBEJoHyoc2EeKYah2yy4yoURZ`.
- Preview da Prospecta não tem DATABASE_URL; health retorna 500 com essa causa. Não há branch Neon para a nova preview; o limite de branches da integração já foi identificado no trabalho anterior. Não foi copiada conexão de produção para preview nem removida branch de outro trabalho. Isso não invalida o build, mas impede teste integrado nessa preview; confirmar health no deploy de produção.
- Preview Santa Fé responde login HTTP 200. Sem sessão autenticada disponível no navegador de verificação; não houve envio de solicitação fictícia à empresa nem confirmação de recebimento bancário.
- Próximo passo: concluir revisão automática dos PRs; fazer merge dos SHAs revisados; acompanhar produção e promover explicitamente a Prospecta se a atribuição de domínio continuar desativada pelo rollback anterior; verificar os domínios, health e logs. Salvar evidências finais neste HANDOFF na branch de trabalho.

## Etapa 3 — correções da revisão
- Review dos PRs apontou regressões de edição/reenvio e auditoria. Corrigidas nos dois sistemas: legendas e seleção para relatório de fotos salvas ficam em Progresso (incluindo fotos antigas sem vínculo); Fotos permanece estritamente consulta.
- Alterações de medição e adição/edição/exclusão de fotos marcam anexos de uma solicitação anterior como `pending`. O botão Enviar versão atualizada regenera os dois documentos, preserva a data inicial da solicitação e torna o aviso do administrador não lido novamente. Falhas de SMTP mantêm reenvio explícito.
- Reserva confere a data da última edição, para não enviar documentos gerados antes de uma alteração concorrente. Finalização só muda o estado da tentativa ainda ativa; não apaga uma alteração ocorrida durante o transporte.
- Prospecta: aceitação pelo SMTP não vira falha de envio caso apenas a atualização posterior de email_logs falhe (teste de regressão). Santa Fé já não possui essa etapa de auditoria após o SMTP.
- Um finding sugeriu enviar só PDF para PCI XLSB. Essa sugestão conflita com o requisito explícito do usuário de PDF + XLS. Mantida validação de ambos; mensagem explica que é necessária PCI original em XLS. Não foi inventada conversão nem renomeado XLSB como XLS, nem enviada solicitação incompleta. Essa limitação já existia no gerador de XLS.
- Testes: Prospecta 870/870 (108 arquivos), incluindo transação PGlite com reenvio de versão corrigida, admin não lido e auditoria SMTP; foco adicional com import ESM/SMTP/transação passou (10 casos). Santa Fé 699 aprovados / 50 testes de banco pulados; fixture da janela de histórico atualizada para a relação de fotos legadas. TypeScript e revisão de componentes executados novamente. Não houve nova migração além das duas colunas já aplicadas.
- Próximo: conferir builds dos novos SHAs, merge de #139/#204 e produção; guardar IDs finais e estado dos domínios neste HANDOFF.
