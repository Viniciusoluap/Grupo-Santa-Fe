# HANDOFF 25/10 (noite) — 11 pedidos (ver PLANO-25-10-NOITE-11-ITENS.md)

Autorizado pelo dono ("Com aiox e com hand off"). Execução por agentes AIOX (@dev), Prospecta primeiro, depois porte Santa Fé.
Branch: `claude/sync-mirrored-repos-bsqnz3` nos 2 repos.

## Achados de produção (somente leitura)
- Sarah ex-funcionária = valor legado do enum `leads.responsible` ('sarah','vinicius','bianca'); 61 leads com 'sarah' (4 sem
  responsible_user_id → mostram "Sem usuário (antigo: Sarah)"). Usuária id 15 "Sarah" (corretor, ativa) = corretora — NÃO tocar.
- bpo_clients = 0 (cadastro falhando). bank_transactions sem titular (reimportar extrato após correção).

## Andamento
- [ ] Prospecta Agente A: BPO (itens 8, 9, 10, 11) + Regularização (6, 7) — migração 0075
- [ ] Prospecta Agente B: WhatsApp (1, 2, 4 + botão flutuante) + Imóveis (3) + Sarah (5) — migração 0076
- [ ] Itens 12 (opção B: admin conecta em Integrações; corretor no portal dele) → Agente B; 13 (Voltar → Painel) e 14 (cobranças emitidas do Asaas) → Agente A — autorizados 25/10 20:45
- [ ] Santa Fé porte (mesmos itens)
- [ ] Publicação (testes, migrações prod, PRs, merge, deploy) + dados (16 imóveis, Sarah)

## Próximo passo exato
Ver lista acima; cada agente reporta arquivos e testes; Claude revisa, commita, atualiza este arquivo e faz push.

## Registro
- Asaas: dono criou a conta no BPO (data inicial 01/01/2020); 566 movimentações sincronizadas (2022-06 a 2026-10), todas viraram lançamentos; saldo real 0,00.
- Pluggy: 401 "client keys are invalid" — dono recola chaves do dashboard.pluggy.ai.
- OFX cinza no iPad (accept do input) → Agente A.
