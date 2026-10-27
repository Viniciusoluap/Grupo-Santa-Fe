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
