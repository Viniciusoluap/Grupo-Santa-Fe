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
