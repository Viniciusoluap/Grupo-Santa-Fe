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

## Etapa 4 — publicação concluída em 19/10/2026

| Sistema | PR mesclado | Commit de código na main | Deploy de produção |
| --- | --- | --- | --- |
| Prospecta | https://github.com/Viniciusoluap/Prospecta/pull/139 | da819637ca08ace317706ae2ebe864f06f4e5aca | dpl_8PW7gPEpsW2xvh57WYqK82yJjPVQ |
| Grupo Santa Fé | https://github.com/Viniciusoluap/Grupo-Santa-Fe/pull/204 | 9dcd7e42201ba2b089e014d486945b2b4f6b1f1e | dpl_7E8j6gEynU4Vz5JCgtnKgEK6V9uM |

(a) Verificações automáticas finais:
- Ambos os deploys em READY, target production, SHA correspondente ao merge. Árvores de código dos merges idênticas às das branches testadas (`f7cf57e` / `05007d6`).
- Domínios com e sem www conferidos pela API Vercel: `prospectaconstrucoes.com` e `gruposantafee.com.br` apontam aos respectivos deploys acima.
- Prospecta: home HTTP 200; `/api/health` no deploy e no domínio oficial HTTP 200, `{"ok":true,"db":"connected"}`.
- Santa Fé: home do domínio oficial HTTP 200 e marcador HTML do deploy novo confirmado.
- Logs de runtime dos deploys novos: nenhuma entrada error/fatal na consulta de 15 minutos, feita depois das verificações HTTP. Isso cobre a janela observada, não garante inexistência de falhas futuras.
- Prospecta: build final local passou, TypeScript passou, suíte 870/870. Santa Fé: TypeScript passou, suíte 699 aprovados / 50 testes de banco pulados. ESLint dos componentes revisados: zero erros; um aviso de `<img>` em imagem de prévia já existente.
- As duas migrações aditivas já aplicadas e verificadas antes da publicação (detalhes na etapa 2).

(b) Verificação manual: implementação, permissões, paridade e findings revisados. Não havia sessão autenticada no navegador disponível; não foi criada solicitação fictícia, disparado e-mail real nem confirmado recebimento financeiro de uma medição.

(c) Limites de validação: o recebimento de anexos na caixa da empresa ainda não foi observado em uma solicitação real. SMTP está configurado no ambiente production dos dois projetos; geração, anexação, tratamento de falhas e notificações foram verificados em testes. Solicitar exige PCI original XLS, pois o gerador existente não reescreve XLSB; não envia apenas PDF contrariando o requisito do usuário.

Operação Vercel: Santa Fé publicado pela integração Git. Prospecta criada explicitamente a partir do SHA do merge em target production; tentativa de promover retornou 409 porque esse deploy já era o atual de produção. A confirmação posterior dos dois domínios comprovou a publicação correta; não foi repetida a promoção.

Estado para continuidade: código publicado e nenhuma implementação pendente deste pedido. Este HANDOFF final fica salvo na branch `codex/medicoes-email-galeria-20261019`, com o merge da main incluído em sua ancestralidade; não é necessário refazer merge/deploy do código. Não mesclar a branch Claude antiga apenas para recuperar os scripts de QA já preservados lá. Próximo acompanhamento opcional: conferir estado `sent`/anexos/aviso ao admin após a próxima solicitação real do usuário, sem reenviar uma medição já aceita.
