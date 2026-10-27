# DEPLOY_STATUS — Lote 02

(pendente — preenchido nas fases seguintes)

## Previews de integração confirmados READY (27/10)
- Prospecta `68004660d95c14f5c2ea745dd73c8c95999aee09`: https://site-prospecta-njzis37l5-viniciusoluaps-projects.vercel.app
- Santa Fé `a30abaa2186550869decad98c93132b0e4bd535f`: https://grupo-santa-exngh22zr-viniciusoluaps-projects.vercel.app
- Produção não alterada pelo lote 2. Migrações P 0087–0091 / SF 20261027160000–200000 ainda pendentes; build READY não constitui aceite funcional autenticado.

### Produção — migrações aplicadas em 27/10/2026
- Prospecta: 0087–0092 aplicadas em uma transação no Neon `plain-cake-26372935`, branch de produção `br-steep-leaf-anxdjv1p`. Somente arquivos novos do lote; não executada base antiga 0045 usada no teste.
- Santa Fé: seis arquivos 20261027160000–210000 aplicados em uma transação via Supabase, histórico `lote2_pci_engenheiros_massa_unidades_projetos_valor_comercial` no projeto `giulchozonhzyopmgmkv`. Corresponde aos seis diretórios Prisma versionados; não executar db push/reset.
- Verificação antes/depois: Prospecta 65 leads/4 estudos/2 unidades; SF 26 leads/1 estudo/0 unidades, sem alteração dessas contagens. Novo preço comercial continua NULL para todos os legados, como previsto. Seis tabelas privadas novas de cada sistema com RLS habilitada.
- Código ainda na branch de continuação; merge final/deploy de produção e aceite funcional autenticado pendentes. A mudança de esquema é compatível com o código antigo.
- Reversão de aplicação: manter as colunas/tabelas aditivas e voltar o deployment anterior, preservando quaisquer dados novos. Não remover tabelas/colunas nem redefinir branches para rollback.

### Verificação de preview e bloqueio de aceite visual
- Builds do código com preço comercial: Prospecta `59255e7` e SF `b503d7f`, ambos READY na Vercel.
- Browser abriu a home do preview Prospecta com sucesso; acesso a `/admin/incorporacao` redirecionou corretamente para `/login`. A sessão deste navegador ainda não está autenticada. Não alterar autenticação nem gerar sessão artificial para testes.
- Tentativa de navegador local não pôde instalar o binário (download retornou arquivo inválido); não foi realizada validação local por screenshot. Browser remoto funciona, mas os testes de incorporação exigem autenticação legítima.
- Próximo passo: autenticar pelo formulário seguro do navegador no preview e validar desktop/tablet/mobile/PWA, upload/download, persistência e relatórios. PRs ficam em rascunho até concluir esse aceite. Não marcar as 22 correções integralmente aprovadas apenas pelos testes automáticos.

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
