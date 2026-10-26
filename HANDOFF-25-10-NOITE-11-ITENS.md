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
- [ ] Santa Fé: porte iniciado em 26/10 a partir do checkpoint remoto `b55c80a`, após confirmar que a branch continha somente plano e handoff.
- [ ] Publicação (testes, migrações prod, PRs, merge, deploy) + dados (16 imóveis, Sarah)

## Próximo passo exato
Portar primeiro banco/BPO/Regularização para o Santa Fé, testar, atualizar este handoff e fazer push. Depois portar WhatsApp/Imóveis/Sarah e repetir o checkpoint. Não aplicar migrações nem alterar dados de produção antes da validação final.

## Retomada pelo Codex — 26/10
- Branches remotas conferidas antes de editar: Prospecta `5a8f6b4`; Santa Fé `b55c80a`.
- Não havia PR aberto para o lote e não havia código do porte Santa Fé salvo no GitHub.
- Regra de continuidade: atualizar este arquivo e fazer commit/push ao término de cada bloco, conferindo o SHA remoto.

## Registro
- Asaas: dono criou a conta no BPO (data inicial 01/01/2020); 566 movimentações sincronizadas (2022-06 a 2026-10), todas viraram lançamentos; saldo real 0,00.
- Pluggy: 401 "client keys are invalid" — dono recola chaves do dashboard.pluggy.ai.
- OFX cinza no iPad (accept do input) → Agente A.
