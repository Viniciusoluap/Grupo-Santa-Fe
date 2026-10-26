# HANDOFF 25/10 (noite) — 11 pedidos (ver PLANO-25-10-NOITE-11-ITENS.md)

Autorizado pelo dono ("Com aiox e com hand off"). Execução por agentes AIOX (@dev), Prospecta primeiro, depois porte Santa Fé.
Branch: `claude/sync-mirrored-repos-bsqnz3` nos 2 repos.

## Achados de produção (somente leitura)
- Sarah ex-funcionária = valor legado do enum `leads.responsible` ('sarah','vinicius','bianca'); 61 leads com 'sarah' (4 sem
  responsible_user_id → mostram "Sem usuário (antigo: Sarah)"). Usuária id 15 "Sarah" (corretor, ativa) = corretora — NÃO tocar.
- bpo_clients = 0 (cadastro falhando). bank_transactions sem titular (reimportar extrato após correção).

## Andamento
- [x] Prospecta: implementação concluída e salva até `5a8f6b4`; `check` e `build` aprovados; 147 arquivos/1.087 testes aprovados na revalidação de 26/10.
- [x] Prospecta: BPO/Regularização (itens 6–11, 13 e 14) e WhatsApp/Imóveis/Sarah (itens 1–5 e 12) concluídos nas migrações 0075/0076.
- [x] Santa Fé — bloco 1: BPO/Bancos/Regularização portados (migração `20261025220000_bpo_titular_clientes`): titular e descrição original, regra por titular, vínculo cliente BPO–lead, cadastro com campos opcionais, lançamento só Cobrança/Despesa com categoria, cobrança Asaas e Total geral da regularização.
- [x] Santa Fé — bloco 2: WhatsApp/Imóveis/Sarah e acabamento das Integrações (migração `20261025230000_whatsapp_midia`).
- [ ] Publicação (testes, migrações prod, PRs, merge, deploy) + dados (16 imóveis, Sarah)

## Próximo passo exato
Ver o checkpoint de publicação abaixo; os dois blocos já foram publicados e os PRs estão abertos.

## Retomada pelo Codex — 26/10
- Branches remotas conferidas antes de editar: Prospecta `5a8f6b4`; Santa Fé `b55c80a`.
- Não havia PR aberto para o lote e não havia código do porte Santa Fé salvo no GitHub.
- Regra de continuidade: atualizar este arquivo e fazer commit/push ao término de cada bloco, conferindo o SHA remoto.

### Checkpoint Santa Fé — bloco 1
- Principais arquivos: `web/prisma/schema.prisma`, migração `20261025220000_bpo_titular_clientes`, `web/src/lib/bancos*`, `web/src/lib/actions/bpo.ts`, telas de BPO e Regularização.
- (a) Automáticos: TypeScript aprovado; lint sem erros (30 avisos preexistentes); suíte completa 114 arquivos/820 testes aprovados e 18 arquivos/108 testes de banco ignorados sem `TEST_DATABASE_URL`.
- (b) Manual: não executado neste checkpoint.
- (c) Produção: migração e fluxo com Asaas/Pluggy reais ainda pendentes; nenhum dado de produção alterado.
- Build: compilação e TypeScript aprovados; prerender da página pública parou em `ECONNREFUSED` porque esta sessão não possui banco disponível.

### Checkpoint Santa Fé — bloco 2
- WhatsApp: exclusão local de conversa com confirmação e regra de acesso; imagem/áudio/vídeo/documento até 10 MB no banco, rota autenticada, miniatura/player/download e nova tentativa; imóvel por lista ou texto livre; checklist de documentos por lead marcado inicialmente com os pendentes.
- Integrações: conexão administrativa da empresa, remoção e lista de conexões dos corretores ficam em Integrações; a Central mantém a conexão própria apenas para o corretor; Voltar leva ao Painel. BPO › Bancos ficou sem itemId/data manual da Pluggy, mantendo apenas “Conectar conta Pluggy”.
- Imóveis: lista mostra endereço completo; imóvel automático acompanha endereço, cidade/UF deduzidos e VGV da obra; `previaReconciliacaoImoveisObras`/`reconciliarImoveisGeradosDeObras` preparam a atualização idempotente dos antigos sem tocar anúncios manuais.
- Sarah: o schema/telas do Santa Fé já usam `responsavelId` de usuário real e exibem apenas “Sem responsável”; não havia enum/nome legado a limpar. A limpeza de 61 valores `sarah` permanece exclusiva da Prospecta e só será aplicada após prévia no deploy.
- (a) Automáticos: Prisma format/generate e TypeScript aprovados; lint sem erros (32 avisos, 30 anteriores + 2 miniaturas `<img>` de mídia); testes focados 20/20; suíte completa 115 arquivos/824 testes aprovados e 18 arquivos/109 testes de banco ignorados sem `TEST_DATABASE_URL`.
- (b) Manual: pendente no ambiente publicado (QR real, recebimento de mídia e Pluggy).
- (c) Produção: nenhuma migração ou reconciliação aplicada e nenhum dado alterado neste checkpoint.
- Build: compilação e TypeScript aprovados; prerender da página pública voltou a parar em `ECONNREFUSED` por ausência de banco nesta sessão.

## Registro
- Asaas: dono criou a conta no BPO (data inicial 01/01/2020); 566 movimentações sincronizadas (2022-06 a 2026-10), todas viraram lançamentos; saldo real 0,00.
- Pluggy: 401 "client keys are invalid" — dono recola chaves do dashboard.pluggy.ai.
- OFX cinza no iPad (accept do input) → Agente A.

## Checkpoint Codex — 26/10, revisão de publicação
- Blocos publicados no GitHub: BPO/Bancos/Regularização `5895ebbc6ae747c4f7cb11c1bb0def6b885bdb22`, WhatsApp/Imóveis/Integrações `33bcdd6970fd501931261ffa41dd15ad456f954e`. PR [#234](https://github.com/Viniciusoluap/Grupo-Santa-Fe/pull/234) aberto e sem conflito; prévia Vercel com status de sucesso.
- (a) Automáticos: TypeScript aprovado, lint sem erro (32 avisos), 115 arquivos/824 testes aprovados; 18 arquivos/109 testes de banco ignorados sem `TEST_DATABASE_URL`. As migrações `20261025220000` (15 comandos) e `20261025230000` (5 comandos) passaram em transações no banco Neon de prévia; conferidos 10 campos e 2 tabelas criados.
- (b) Manual: verificados os vínculos Vercel e o esquema Supabase de produção. O banco de produção ainda não recebeu essas duas migrações. O projeto não tem tabela `_prisma_migrations`; seu histórico remoto é de migrações Supabase. A tentativa de criar uma branch Supabase para testar retornou erro de requestState, por isso a validação de esquema usou o banco de prévia separado.
- (c) Produção: SQLs, merge/deploy e fluxos reais (WhatsApp, Asaas, Pluggy) pendentes. Nenhum dado de produção foi alterado neste checkpoint.
- Próximo passo exato: aplicar os dois SQLs versionados no Supabase de produção, verificar campos, índices e tabelas, mesclar o PR #234 e validar o deploy. Não executar `prisma migrate deploy` cegamente contra a produção sem reconciliar o histórico de migrações ausente.
