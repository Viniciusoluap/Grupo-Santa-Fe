# EXECUTION LOG — Lote 02

## 27/10/2026 — Fase 1 (Auditoria)
- Branches `claude/lote2-22-correcoes-20261027` criadas a partir de origin/main nos dois repos.
- Prompt registrado em `PROMPT-MESTRE-LOTE2-22.md`.
- Auditoria SF concluída (resumo em MASTER_STATUS). Auditoria Prospecta em andamento.

### Arquivos do Codex (evitar)
- Prospecta: `client/src/pages/admin/AdminBpo.tsx`, `AdminWhatsApp.tsx`, `BancosPanel.tsx`; `drizzle/0077–0081`; `server/_core/pluggy.ts`, `bancos*.ts`, `bpo-*.ts`, `drive-documents.ts`, `server/whatsapp-*.ts`; `shared/extrato-import.ts`, `shared/financeiro/bpo-operacional.ts`, `shared/projeto-documentos.ts`, `shared/whatsapp/*`. `drizzle/schema.ts` é compartilhado: só adicionar no fim, migrações a partir de 0082.
- SF: `web/prisma/schema.prisma` (só adicionar), migrações após `20261026180000`; `web/src/lib/bancos*`, `extrato-import.ts`, `incorporacao/registro-drive.ts`, `projeto-documentos.ts`, `web/src/app/admin/integracoes/_components/integracoes-client.tsx` (mexer mínimo, isolar em componente novo).

## Continuação Codex — checkpoint orçamento/lançamento
- Download Excel editado com original independente; fonte explícita de custo de lançamento; sincronização ao salvar lotes avulsos; testes e próximos passos atualizados no MASTER_STATUS. Código em paridade nos dois repositórios.

## Checkpoint preço comercial
- Correção 15 completada com campo próprio do CRM, novos testes e migração aditiva equivalente; preservação de legados documentada. Suíte geral P concluída e testes PCI SF adicionais aprovados.

### Produção — migrações aplicadas em 27/10/2026
- Prospecta: 0087–0092 aplicadas em uma transação no Neon `plain-cake-26372935`, branch de produção `br-steep-leaf-anxdjv1p`. Somente arquivos novos do lote; não executada base antiga 0045 usada no teste.
- Santa Fé: seis arquivos 20261027160000–210000 aplicados em uma transação via Supabase, histórico `lote2_pci_engenheiros_massa_unidades_projetos_valor_comercial` no projeto `giulchozonhzyopmgmkv`. Corresponde aos seis diretórios Prisma versionados; não executar db push/reset.
- Verificação antes/depois: Prospecta 65 leads/4 estudos/2 unidades; SF 26 leads/1 estudo/0 unidades, sem alteração dessas contagens. Novo preço comercial continua NULL para todos os legados, como previsto. Seis tabelas privadas novas de cada sistema com RLS habilitada.
- Código ainda na branch de continuação; merge final/deploy de produção e aceite funcional autenticado pendentes. A mudança de esquema é compatível com o código antigo.
- Reversão de aplicação: manter as colunas/tabelas aditivas e voltar o deployment anterior, preservando quaisquer dados novos. Não remover tabelas/colunas nem redefinir branches para rollback.

### Bloqueio vigente — ambiente de preview (27/10)
- O formulário seguro de login foi submetido, mas a aplicação permaneceu em `/login` com "CRM temporariamente indisponível". NÃO é evidência de senha incorreta ou login bem-sucedido.
- Diagnóstico confirmado nos logs Vercel do deployment `dpl_3EqisPsuCDRFd2r3KkXxGpdrLK8o`: `DATABASE_URL is not set`, em `ensureLeadCardDeadlineSchema`, antes da validação de credenciais. O build READY não garantia runtime configurado. Produção não apresentou esse erro nesta verificação, que foi exclusiva do preview.
- Metadata de envs: `DATABASE_URL` só está definida para produção/dev e algumas outras branches; falta na branch atual. JWT tem valor global, mas recomenda-se isolamento próprio do preview ao configurar o ambiente.
- Preparada configuração estrita de teste: Neon projeto `plain-cake-26372935`, branch existente `br-cold-feather-an7ecnay`, banco `neondb`; destino Vercel projeto `prj_hVT5OCL8S5GbJ5L0GArH9aDxbFHR`, variável `DATABASE_URL` tipo sensitive, target preview e gitBranch `codex/continuar-lote2-20261027`. NÃO usar banco de produção no preview. Nenhuma credencial consta neste handoff.
- **A revisão automática rejeitou o cadastro da variável**: transferir credencial de banco à Vercel exige autorização explícita dessa credencial/destino; a autorização geral da tarefa não foi considerada suficiente. A variável NÃO foi criada, JWT NÃO foi alterado e NÃO houve redeploy dessa configuração. Não contornar por CLI, proxy ou cópia de segredos de produção.
- Pergunta enviada ao dono: autoriza cadastrar a conexão da branch Neon de testes como segredo na Vercel, apenas no preview desta branch? Aguardar essa autorização específica antes da transferência; então configurar, redeploy e conferir runtime, antes de pedir autenticação novamente.
- Banco de teste contém 1 usuário/67 leads/1 estudo e recebeu as migrações do lote. É uma base de teste anterior; conferir compatibilidade dos demais campos necessários antes dos E2E. Não criar sessão artificial nem substituir credenciais para conseguir acesso.
- PRs permanecem rascunho (#174 P, #237 SF). Merge/deploy final e aceite autenticado continuam pendentes. Trabalho de código e migrações de produção já preservados. Próximo passo vigente é resolver este bloqueio de configuração, e só depois o login/aceite visual.
