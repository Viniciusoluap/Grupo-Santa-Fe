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
- [ ] Santa Fé — bloco 2: WhatsApp/Imóveis/Sarah e acabamento das Integrações.
- [ ] Publicação (testes, migrações prod, PRs, merge, deploy) + dados (16 imóveis, Sarah)

## Próximo passo exato
Portar WhatsApp/Imóveis/Sarah e acabamento das Integrações. Depois executar a validação final dos dois repositórios, abrir PRs e somente então preparar migrações/deploy. Não alterar dados de produção antes da validação final.

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

## Registro
- Asaas: dono criou a conta no BPO (data inicial 01/01/2020); 566 movimentações sincronizadas (2022-06 a 2026-10), todas viraram lançamentos; saldo real 0,00.
- Pluggy: 401 "client keys are invalid" — dono recola chaves do dashboard.pluggy.ai.
- OFX cinza no iPad (accept do input) → Agente A.
