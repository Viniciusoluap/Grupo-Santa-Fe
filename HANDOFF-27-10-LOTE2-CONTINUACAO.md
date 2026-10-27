# Handoff — continuação Lote 2 — 27/10/2026

Este é o ponto de retomada do trabalho iniciado no Claude. Repositórios: Prospecta e Grupo Santa Fé, com paridade obrigatória de comportamento. Tudo deve continuar na branch `codex/continuar-lote2-20261027`, preservando a origem `claude/lote2-22-correcoes-20261027`.

## Entrega salva e revisão

- Prospecta: https://github.com/Viniciusoluap/Prospecta/pull/174 (rascunho).
- Santa Fé: https://github.com/Viniciusoluap/Grupo-Santa-Fe/pull/237 (rascunho).
- Último checkpoint remoto anterior a este documento, neste repo: `9e46fe9688d96294f376f4723366ae5de9616f2f`. O SHA do commit deste documento será o novo HEAD; conferir na branch remota.
- Main conciliada: P `880b5dd`; SF `94f7b5d`. Preservadas a prioridade das revisões e as alterações de BPO/WhatsApp de outras frentes. Nenhum reset/force push.
- Prompt original completo: `docs/handoffs/lote2/PROMPT-MESTRE-LOTE2-22.md`. Estado por correção: `MASTER_STATUS.md`; decisões, execução, testes e deploy nos arquivos vizinhos.

## Etapas do prompt original

| Etapa | Estado real |
|---|---|
| 1. Auditoria e baseline | Concluída, trabalho Claude recuperado dos commits |
| 2. Arquitetura | Decisões registradas e implementadas |
| 3. Fundações | Implementadas; migrações de produção aplicadas |
| 4. Operacionais | Código implementado; testes automáticos aprovados; falta aceite autenticado |
| 5. Design/responsividade | Código implementado; falta desktop/tablet/mobile/PWA no navegador autenticado |
| 6. Auditoria final | Regressão automática e typecheck aprovados; E2E/upload/download reais pendentes |
| 7. Entrega | Previews READY e PRs rascunho; merge/deploy de produção e smoke final pendentes |

## Últimas mudanças

- Orçamento: métodos construção/infraestrutura/Excel, mapeamento e conferência, original preservado, itens editáveis e Excel atualizado exportável sem duplicar total.
- Viabilidade: cenário principal e restrições sem dupla subtração, ajustes manuais preservados; custo do lançamento com escolha explícita entre manual/fornecedores/publicidade.
- Unidades: geração idempotente, preservação de reservas/vendas/exclusões, revisão inteira para concorrência e histórico; gravação de massa e lotes avulsos sincroniza inventário.
- CRM: novo valor negociado para venda, independente de simulação/financiamento; seleção do cliente carrega o preço cadastrado e permite editar. Confirma substituição de preço já preenchido. Sem inferir preço de legados.
- Atendimento usa cliente e unidade reais sem mudar estado comercial. Fornecedores separam orçamento de contrato. Relatórios de Viabilidade movidos abaixo do Executivo, mantendo o Terreneiro separado.
- PCI: testes de bytes/fórmulas/macros/roundtrip; SF ganhou testes de permissões, gravação/recarga do rascunho e download limitado à obra. XLSB permanece leitura com aviso, sem reescrita arbitrária.

## Testes reais

(a) Automáticos:
- Prospecta geral: **162 arquivos/1219 testes aprovados**, antes da última adição do valor comercial; depois da adição, **17/17** específicos CRM/inventário aprovados. Adicional orçamento/urbanismo/exportação: **7/7**.
- SF geral: **135 arquivos/944 testes aprovados; 21 arquivos/124 ignorados**, por ambiente específico (não contam como aprovação). Depois: CRM/migrações **4/4**, PCI acesso/persistência **3/3**, orçamento/exportação + migrações **3/3**.
- TypeScript sem erros nos dois após o valor comercial. Previews de código P `59255e7` / SF `b503d7f` READY.
- Migrações idempotentes testadas em PGlite; P0087–0091 duas vezes na branch Neon de teste existente, P0092 também validada nela.

(b) Manuais:
- Home do preview Prospecta abriu no navegador. `/admin/incorporacao` redirecionou para `/login`, como esperado sem sessão.
- Sessão atual não autenticada. A autenticação deve ocorrer pelo formulário seguro `browserAuth`, sem enviar senha no chat. A skill Browser exige login legítimo para prosseguir; não criar token de sessão nem alterar autenticação para testar.
- Faltam desktop/tablet/mobile/PWA, upload/download de originais e PCI real, edição/salvar/recarregar, cenários/estoque/CRM e relatórios, com permissões adequadas. Não marcar esses critérios aprovados por suposição.

(c) Produção:
- **Migrações já aplicadas**: P `0087–0092`; SF `20261027160000–210000`, uma entrada transacional Supabase `lote2_pci_engenheiros_massa_unidades_projetos_valor_comercial` equivalente aos seis arquivos Prisma.
- Antes/depois iguais: Prospecta 65 clientes/4 estudos/2 unidades; SF 26 clientes/1 estudo/0 unidades. Preço comercial novo NULL nos legados. Seis novas tabelas privadas de cada banco com RLS. Oito colunas de incorporação/unidades conferidas em cada sistema.
- Não aplicar a base antiga 0045 usada apenas na branch de teste; não usar db push/reset. Migrações novas são compatíveis com aplicação anterior.
- Rollback da aplicação: voltar deployment anterior mantendo estruturas aditivas e dados; não apagar tabelas/colunas.

## Próximo passo exato

1. Autenticar no preview Prospecta via formulário seguro do navegador. URL de login observada: https://site-prospecta-a8tdd819d-viniciusoluaps-projects.vercel.app/login . Não há credenciais armazenadas neste documento.
2. Verificar manualmente as correções do prompt com dados de teste claramente identificados e sem alterar vendas reais; repetir equivalência SF. Registrar o que passou e o que não passou.
3. Conferir PRs/checks/main atual, concluir critérios, tirar PRs de rascunho e fazer merge autorizado (sem pedir autorização outra vez), acompanhar deploy de produção e smoke.
4. Atualizar handoffs, commit/push e confirmar SHA remoto a cada etapa. Não declarar o lote inteiro concluído enquanto esses aceites estiverem pendentes.
