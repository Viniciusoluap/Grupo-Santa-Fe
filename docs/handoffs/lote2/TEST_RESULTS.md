# TEST_RESULTS — Lote 02

(pendente — preenchido nas fases seguintes)

## 27/10 — retomada integrada
- SF: `node node_modules/vitest/vitest.mjs run --root web --maxWorkers=1`: 135 arquivos/944 testes aprovados; 21 arquivos/124 testes ignorados por ambiente específico.
- P: `vitest run server/incorporacao-lancamento-viabilidade.test.ts server/incorporacao-urbanismo-cenario.test.ts server/incorporacao-orcamento-importacao.test.ts --maxWorkers=1 --minWorkers=1`: 7/7.
- SF: `vitest run src/lib/__tests__/lancamento-viabilidade.test.ts src/lib/__tests__/lote2-migrations.test.ts --maxWorkers=1`: 3/3. Migrações reais renumeradas aplicadas duas vezes; dados legados e RLS preservados.
- TypeScript SF sem erros. Prospecta em execução; não contar log geral incompleto como sucesso.
- Manuais/autenticados/produção: pendentes.

## Checkpoint CRM e PCI
- Prospecta geral: `vitest run --maxWorkers=2 --minWorkers=1` — 162 arquivos/1219 testes aprovados, duração 212,71 s. Execução anterior à adição do campo de preço comercial.
- Após campo comercial: P `incorporacao-unidades-cenario.test.ts` + `lead-vgv-cadastro.test.ts` — 17/17; SF `unidades-crm.test.ts` + `lote2-migrations.test.ts` — 4/4. Ambos TypeScript sem erros.
- SF `pci-gerador-acesso-persistencia.test.ts` — 3/3, dependências de banco mockadas: regra de perfis, gravação/recarga de rascunho e isolamento do download pelo par obra/PCI.

### Verificação de preview e bloqueio de aceite visual
- Builds do código com preço comercial: Prospecta `59255e7` e SF `b503d7f`, ambos READY na Vercel.
- Browser abriu a home do preview Prospecta com sucesso; acesso a `/admin/incorporacao` redirecionou corretamente para `/login`. A sessão deste navegador ainda não está autenticada. Não alterar autenticação nem gerar sessão artificial para testes.
- Tentativa de navegador local não pôde instalar o binário (download retornou arquivo inválido); não foi realizada validação local por screenshot. Browser remoto funciona, mas os testes de incorporação exigem autenticação legítima.
- Próximo passo: autenticar pelo formulário seguro do navegador no preview e validar desktop/tablet/mobile/PWA, upload/download, persistência e relatórios. PRs ficam em rascunho até concluir esse aceite. Não marcar as 22 correções integralmente aprovadas apenas pelos testes automáticos.


## Estado final da publicação — 27/10/2026

**Merge e deploy de produção concluídos nos dois repositórios, conforme autorização do dono.** As branches do Claude e da continuação foram preservadas, sem reset/force push. Os registros posteriores abaixo são históricos; este bloco descreve o estado vigente.

| Sistema | PR mergeado | Commit do merge | Deploy de produção confirmado READY | Domínio oficial |
|---|---|---|---|---|
| Prospecta | [#174](https://github.com/Viniciusoluap/Prospecta/pull/174) | e1711560b76bc7ef51d44ac145deeb1018963fe7 | dpl_CF9QkSyeMZZhZAwxD936sC2arfxY | https://www.prospectaconstrucoes.com |
| Grupo Santa Fé | [#237](https://github.com/Viniciusoluap/Grupo-Santa-Fe/pull/237) | b560071bcab22c2ff11279f21d29908ccbf062ac | dpl_g5Lxy3DYQYgWcXTQ6HBWeHvUzR4h | https://www.gruposantafee.com.br |

### O que foi verificado nesta entrega

(a) Automático/HTTP/build:
- Builds de produção dos dois merges concluídos na Vercel e associados aos domínios oficiais acima.
- Prospecta /api/health: HTTP200, `{ok:true,db:connected}`.
- Download de modelo PCI sem sessão: HTTP401 com mensagem de sessão expirada, nos dois domínios de produção. Conteúdo privado não foi entregue.
- Santa Fé /login: HTTP200, HTML identificado com o deployment novo dpl_g5Lxy3DYQYgWcXTQ6HBWeHvUzR4h.
- Consulta aos logs de runtime de cada novo deployment, níveis error/fatal, janela de 15 minutos da verificação: nenhum registro encontrado. Isso não substitui observação de todos os fluxos autenticados.
- Reaproveitados os testes anteriores: P1219/1219 geral +17/17 específicos posteriores ao preço comercial, SF944 aprovados/124 ignorados geral + testes focados documentados. TypeScript passou nos dois e os builds de produção repetiram as verificações configuradas. Nenhum código funcional foi alterado nesta retomada, apenas configuração/documentação.

(b) Manual/autenticado:
- Ainda pendentes: aceite visual integral desktop/tablet/mobile/PWA e E2E de upload/download/edição/salvar/recarregar com sessão legítima. NÃO foram marcados como aprovados. O dono autorizou prosseguir com merge/deploy, ciente do estado registrado.
- XLSB no gerador PCI continua somente leitura com aviso; XLS/XLSM possuem geração conforme testes registrados. Cadastro do modelo oficial real continua sendo uma operação administrativa da aplicação.

(c) Produção e configuração:
- Migrações P0087–0092 / SF20261027160000–210000 já estavam aplicadas, com contagens legadas preservadas e RLS conferida. Não foram repetidas nesta retomada.
- Bloqueio anterior de configuração RESOLVIDO após autorização específica: segredo DATABASE_URL somente no preview da branch codex/continuar-lote2-20261027, ligado à branch Neon de testes br-cold-feather-an7ecnay. Sem copiar a conexão de produção e sem credenciais no Git.
- Rollback: P deployment dpl_5iTonbh7ZCPEesCiCrfvcrxvpwRX (SHA880b5dd); SF dpl_HN3NqGBwxpXxpTT62HzouSxwHi1B (SHA94f7b5d). Manter as tabelas/colunas aditivas e quaisquer dados novos; rollback da aplicação não deve apagar estruturas.
- Este checkpoint final altera apenas documentação na main, preservando o código funcional dos merges acima. O novo deployment gerado por esse commit deve ser acompanhado até READY.

### Próximo passo de validação do produto

Usar os sistemas publicados e realizar o aceite autenticado dos critérios manuais do prompt original, registrando qualquer defeito concreto por correção e mantendo a paridade. Não declarar o conjunto das 22 correções 100% validado enquanto esses aceites estiverem pendentes. Não há mais merge/deploy funcional aguardando autorização.

