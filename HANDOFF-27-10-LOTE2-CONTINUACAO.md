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

**Atualização prioritária:** o login falhou antes de validar credenciais porque o preview está sem DATABASE_URL. A revisão automática recusou transferir a conexão do banco Neon de testes à Vercel sem autorização específica. Nenhuma variável criada. Aguardar a resposta à pergunta de autorização; depois configurar apenas o preview desta branch e redeployar, conferir runtime e então seguir os passos abaixo. Não contornar a recusa.

1. Autenticar no preview Prospecta via formulário seguro do navegador. URL de login observada: https://site-prospecta-a8tdd819d-viniciusoluaps-projects.vercel.app/login . Não há credenciais armazenadas neste documento.
2. Verificar manualmente as correções do prompt com dados de teste claramente identificados e sem alterar vendas reais; repetir equivalência SF. Registrar o que passou e o que não passou.
3. Conferir PRs/checks/main atual, concluir critérios, tirar PRs de rascunho e fazer merge autorizado (sem pedir autorização outra vez), acompanhar deploy de produção e smoke.
4. Atualizar handoffs, commit/push e confirmar SHA remoto a cada etapa. Não declarar o lote inteiro concluído enquanto esses aceites estiverem pendentes.

### Bloqueio vigente — ambiente de preview (27/10)
- O formulário seguro de login foi submetido, mas a aplicação permaneceu em `/login` com "CRM temporariamente indisponível". NÃO é evidência de senha incorreta ou login bem-sucedido.
- Diagnóstico confirmado nos logs Vercel do deployment `dpl_3EqisPsuCDRFd2r3KkXxGpdrLK8o`: `DATABASE_URL is not set`, em `ensureLeadCardDeadlineSchema`, antes da validação de credenciais. O build READY não garantia runtime configurado. Produção não apresentou esse erro nesta verificação, que foi exclusiva do preview.
- Metadata de envs: `DATABASE_URL` só está definida para produção/dev e algumas outras branches; falta na branch atual. JWT tem valor global, mas recomenda-se isolamento próprio do preview ao configurar o ambiente.
- Preparada configuração estrita de teste: Neon projeto `plain-cake-26372935`, branch existente `br-cold-feather-an7ecnay`, banco `neondb`; destino Vercel projeto `prj_hVT5OCL8S5GbJ5L0GArH9aDxbFHR`, variável `DATABASE_URL` tipo sensitive, target preview e gitBranch `codex/continuar-lote2-20261027`. NÃO usar banco de produção no preview. Nenhuma credencial consta neste handoff.
- **A revisão automática rejeitou o cadastro da variável**: transferir credencial de banco à Vercel exige autorização explícita dessa credencial/destino; a autorização geral da tarefa não foi considerada suficiente. A variável NÃO foi criada, JWT NÃO foi alterado e NÃO houve redeploy dessa configuração. Não contornar por CLI, proxy ou cópia de segredos de produção.
- Pergunta enviada ao dono: autoriza cadastrar a conexão da branch Neon de testes como segredo na Vercel, apenas no preview desta branch? Aguardar essa autorização específica antes da transferência; então configurar, redeploy e conferir runtime, antes de pedir autenticação novamente.
- Banco de teste contém 1 usuário/67 leads/1 estudo e recebeu as migrações do lote. É uma base de teste anterior; conferir compatibilidade dos demais campos necessários antes dos E2E. Não criar sessão artificial nem substituir credenciais para conseguir acesso.
- PRs permanecem rascunho (#174 P, #237 SF). Merge/deploy final e aceite autenticado continuam pendentes. Trabalho de código e migrações de produção já preservados. Próximo passo vigente é resolver este bloqueio de configuração, e só depois o login/aceite visual.

## Retomada autorizada — 27/10/2026
- Dono autorizou explicitamente o cadastro da conexão da branch Neon de testes na Vercel e pediu, na sequência, merge e deploy dos dois sistemas.
- DATABASE_URL criada como segredo (sensitive), apenas target preview e gitBranch codex/continuar-lote2-20261027, no projeto Vercel Prospecta. Destino do banco: branch de testes br-cold-feather-an7ecnay; não é produção. Nenhuma credencial no Git/handoff.
- Redeploy de verificação em andamento: dpl_DRVTiYxkZRXPm4BHbwBVwa2HXBXy, SHA Prospecta 8a53fa1. O bloqueio de autorização anterior está resolvido. Conferir /api/health e guardas de acesso após READY.
- PRs #174 / #237 continuam com histórico preservado. Testes automáticos e migrações documentados anteriormente são reaproveitados; nenhum código funcional foi alterado nesta retomada.
- Próximos: verificação de runtime do preview, conferir checks dos PRs, merge autorizado, acompanhar deploys de produção e registrar smoke/limitações. Não afirmar aceite visual/PWA/upload real sem evidência.

## Checkpoint de publicação — 27/10
- Prospecta: preview respondeu HTTP200 em /api/health, `{ok:true,db:connected}`; /api/trpc/auth.me respondeu normalmente com sessão nula (sem autenticação). O erro DATABASE_URL ausente foi resolvido.
- Builds dos heads de revisão confirmados READY na Vercel. O status agregado GitHub Prospecta ainda mostrava pending para um deployment já READY; o build foi conferido diretamente na Vercel, sem alterar ou simular checks.
- PR Santa Fé #237 mergeado, commit b560071bcab22c2ff11279f21d29908ccbf062ac; deployment de produção dpl_g5Lxy3DYQYgWcXTQ6HBWeHvUzR4h iniciado. Rollback anterior SF: dpl_HN3NqGBwxpXxpTT62HzouSxwHi1B, SHA94f7b5d.
- Próximo: confirmar merge Prospecta e deploys finais READY, smoke de produção e atualização definitiva do handoff. Testes visuais/autenticados completos ainda não são dados como aprovados.

## Merge autorizado concluído nos dois sistemas
- Prospecta PR174: merge e1711560b76bc7ef51d44ac145deeb1018963fe7; deployment de produção iniciado dpl_CF9QkSyeMZZhZAwxD936sC2arfxY.
- Santa Fé PR237: merge b560071bcab22c2ff11279f21d29908ccbf062ac; deployment de produção iniciado dpl_g5Lxy3DYQYgWcXTQ6HBWeHvUzR4h.
- Branches e histórico preservados. Nenhum reset, force push ou remoção de dados. As migrações aditivas já aplicadas foram reaproveitadas.
- Aceite desta retomada: saúde do preview Prospecta HTTP200/banco conectado; build READY. Sem nova alteração funcional. Builds de produção em acompanhamento; ainda não afirmar publicação concluída neste checkpoint.
- Guardas de download no preview não puderam ser confirmadas pelo fetch da Vercel: ferramenta tratou o 401 como proteção de deployment; o fallback HTTP chegou à tela SSO. Não contar isso como teste funcional autenticado.
- Próximo: confirmar READY e domínios dos deploys de produção, conferir saúde/acesso público e guardar evidência/limitações no handoff final.
