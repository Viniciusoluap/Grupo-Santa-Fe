# Handoff — PCI legada e desvinculação (22/10/2026)

## Validação da PCI antiga real (22/10/2026)

- A mesma PCI `.xls` antiga foi lida pelo parser deste projeto. O parser encontrou os 20 serviços nas linhas 113–132, extraiu as incidências da coluna X e totalizou 100,0000%, em paridade com Prospecta. Nenhum arquivo de cliente foi incluído no repositório.
- Testes automáticos locais: 32/32 nos testes de PCI, medição e progresso. O teste de migração que depende de `@electric-sql/pglite` não rodou neste checkout por ausência local da dependência; a prévia e o deploy de produção anteriormente passaram. O deploy dos PRs #213 e #214 permanece READY. Nenhum dado de cliente no Santa Fé foi alterado nesta validação.

## Situação final desta entrega (mais recente)

- PR [#213](https://github.com/Viniciusoluap/Grupo-Santa-Fe/pull/213) mesclado em `main` no commit `556a4e62597348941a4d06b10c2cd850f06690b9`. Prévia do commit `c775b0bb8fe3a7e1a037d4fcffe3dab9aad030f6` e deploy de produção do merge confirmados **READY** na Vercel em 22/10/2026.
- Parser de PCI antiga, reprocessamento dos bytes no vínculo, botão de desvincular e restauração de incidências padrão com execução e histórico preservados estão publicados. A data principal do histórico usa a data do levantamento preenchida; o instante de registro permanece separado para auditoria. Registros antigos sem levantamento salvo exibem a data de criação.
- Testes locais: 32/32. O primeiro build de prévia falhou na tipagem de itens do desvínculo; a correção entrou no commit final, e a segunda prévia e produção passaram. Nenhum XLS original ou operação de cliente real foi testado nesta sessão. Validar com a planilha original quando disponível; o usuário aciona **Vincular PCI** para reprocessar uma PCI já armazenada.
- As seções abaixo descrevem checkpoints anteriores e podem conter pendências já concluídas. Esta seção prevalece para o estado da entrega.

## Contexto e estado confirmado

- A agenda unificada foi mesclada no Grupo Santa Fé em `7370f1e` (PR #211) e publicada no Vercel READY. A herança das datas de alvará nas medições PLS foi aprovada em QA (26 testes, lint e prévia Vercel READY), mesclada em `30c6cf508caf0e6667b54afa7438ebf40e03ca99` (PR #212). O deploy de produção desse último commit foi confirmado READY pelo Vercel nesta sessão.
- Branch isolada desta frente: `codex/pci-legado-desvincular-20261022`, criada do `main` em `30c6cf5` no worktree `Grupo-Santa-Fe-pci-legacy`. Não tocar worktrees antigos com mudanças preexistentes.
- Pedido nasceu de prints da Prospecta em `upload/image(20261022-143410).png`, `image(20261022-143427).png` e `image(20261022-143441).png`. A planilha antiga mostra 20 incidências nas linhas **113–132**, mas o parser anterior `web/src/lib/caixa/pci.ts` fixava `LINHA_PRIMEIRO_SERVICO_PCI = 120`; a aplicação Prospecta apresentou **77,90%** e primeiro item 9,00%, enquanto a planilha mostra 3,10% e total 100,00%. Arquivo `.xls` real não foi anexado, somente capturas.
- Usuário pediu **Desvincular PCI** no topo da obra, restaurando incidências padrão, sem perder execução ou histórico de medições. Preservar arquivo original e versões históricas para auditoria e geração. Paridade da regra com Prospecta é obrigatória.
- Agentes AIOX `pci_prospecta`, `pci_santafe` e `pci_qa` foram interrompidos por limite de uso antes de entregar código. Prosseguir diretamente ou pelo Claude.

## Próximos passos exatos

1. Ajustar parser em `web/src/lib/caixa/pci.ts` para localizar de modo seguro as tabelas antiga (113–132) e atual (120–139), conferir sequência 1–20 e total 100% com tolerância de arredondamento. Não aceitar janela deslocada com soma parcial. Validar com planilha real quando disponível.
2. Revisar `web/src/lib/actions/obra-progresso.ts`, `web/src/lib/obras/pci.ts`, `web/src/app/admin/obras/[id]/editar/_components/medicao-caixa.tsx`, esquema Prisma e as rotas de upload/geração. Criar ação de desvincular transacional e autorizada: remover somente vínculo atual, restaurar incidências padrão e manter a execução do serviço e o histórico/versões. Atualizar a interface após a ação. Ler o guia relevante em `web/node_modules/next/dist/docs/` antes de editar componentes.
3. Rejeitar leitura/vínculo de soma incompleta. Analisar necessidade de reprocessar bytes da PCI já salva para corrigir `parsed` errado; preservar vínculo antigo no histórico. Não alterar dados reais de clientes sem validar o arquivo original.
4. Testes: formatos 113–132 e 120–139, soma rejeitada se parcial, desvincular e revincular, permissões, execução e histórico preservados. Paridade Prospecta.
5. Atualizar este handoff (concluído, pendências, testes automáticos/manuais/produção, próximo passo), fazer commit/push confirmado, QA, PR, preview Vercel READY, merge e deploy autorizados.

## Verificação até este checkpoint

- Automática: o parser agora localiza os 20 itens pela numeração da coluna G, lê as incidências da coluna X na linha correta (113 ou 120), acompanha a linha nas faixas mínima/máxima e recusa soma diferente de 100%. `web/src/lib/__tests__/pci-legada.test.ts` cobre as duas versões e os erros. `vitest run src/lib/__tests__/pci-legada.test.ts src/lib/__tests__/caixa-medicao.test.ts`: **21/21 passaram**. Arquivos alterados: `web/src/lib/caixa/pci.ts` e teste.
- Manual: imagens examinadas; diagnóstico inicial por comparação com a constante do parser.
- Produção pendente: validação autenticada da PCI após correção.
- **Ainda não concluído:** botão e ação de desvincular; reparo do `parsed` da PCI previamente enviada; testes DB/permissão. Não mesclar/publicar esse lote em produção sem completar os itens e QA.

## Checkpoint adicional para retomada pelo Claude

- O parser e seus testes estão publicados nesta branch remota: commit `aee3a983b004d9c0463aaacc0892eecbe11e2790`, árvore `5813e730b51df28fc5741a597c1f19eceacc2d9e`. O Prospecta tem o marco equivalente em `320a22768b534eebf040a40bd268d5dc321226e9`, árvore `d0abc0e6a5c1277a77e36eb42852499315d2a547`. Os commits locais diferem dos remotos; as árvores foram verificadas após `git fetch`.
- Ainda **não houve código de desvínculo no Santa Fé**. O Prospecta tem uma mutação e handler parcial não testados; sua branch será publicada como WIP no checkpoint. Manter a paridade: ação transacional que retira somente o vínculo atual, restaura incidências padrão, preserva execução/versões/medições, botão na interface e atualização imediata da tela.
- Pontos de partida: `web/src/lib/actions/obra-progresso.ts` (`vincularPciObra`, `salvarProgressoObra` e bloqueios de PCI), `web/src/lib/obras/pci.ts`, `web/src/app/admin/obras/[id]/editar/_components/medicao-caixa.tsx`, `web/src/app/admin/obras/[id]/editar/_components/progresso-obra.tsx`. A ação de salvar deve permitir incidências padrão quando a PCI está desvinculada e atribuir `pciVersaoId: null` aos **novos** dados; históricos continuam com a versão original. Ler `web/AGENTS.md` e o guia de Next relevante antes de editar.
- A PCI anteriormente salva mantém `parsed` incorreto. Reprocessar bytes reais no fluxo de novo vínculo, preservar versões ligadas a históricos sem sobrescrevê-las silenciosamente e validar o `.xls` real do exemplo quando possível. Parser novo sozinho não repara registros já persistidos.
- (a) Automático: 21/21 testes do parser; nenhuma ação de desvínculo testada. (b) Manual: confronto dos prints com linha 113 versus linha 120, sem teste de UI autenticada. (c) Produção: PCI/desvínculo pendentes; agenda/alvará READY.
- Não há PR, merge ou deploy da branch PCI. Publicar este handoff e conferir sua árvore remota. Handoffs anteriores, como `HANDOFF-22-10-AGENDA-UNIFICADA.md` e `HANDOFF-22-10-ALVARA-PLS.md`, permanecem no repositório.

## Estado mais recente — implementação local após o checkpoint de parser

### Continuação da publicação e ajuste solicitado em 22/10

- O código da PCI e do desvínculo foi publicado na branch remota, árvore `633df5eca1d451dfc9f8c355a402b7678524c3a4`, commit GitHub `f41862350469c057980e467655d6ec3d08ac5460`. PR #213 aberto. A autorização explícita do usuário para publicar nos repositórios públicos foi recebida.
- A primeira prévia falhou no TypeScript de `desvincularPciObra`: `restaurarIncidenciasPadrao` permite `null` no tipo dos itens, enquanto `createMany` exige valores não nulos. As duas gravações de itens passaram a serializar `incidencia` e `execucao` com `String`, após a validação de `calcularProgresso`. Revalidar na nova prévia.
- A data principal de cada medição no histórico passa a mostrar `dadosCaixa.pls.dataLevantamento` (dia/mês/ano). O cadastro permanece como `Registrada em`; registros antigos sem levantamento preservam a data de cadastro. A edição não altera o instante de criação.
- Nova prévia, merge e produção ainda aguardam validação final. O XLS original do exemplo continua não anexado.

Esta seção substitui as pendências de código descritas acima. O parser já estava publicado; as mudanças abaixo estão no worktree e precisam de commit/push/preview antes de merge.

- `web/src/lib/actions/obra-progresso.ts`: `vincularPciObra` relê os bytes da versão corrente; se o JSON antigo divergir, cria versão lógica corrigida com hash dos bytes + identificador do parser e aponta o vínculo atual para ela, mantendo versões de históricos intactas. `desvincularPciObra` restaura incidências padrão com execução preservada, mantém arquivo e histórico, recalcula progresso e revalida páginas. Novas medições quando desvinculada usam `pciVersaoId: null`; editar/excluir histórico vinculado depois do desvínculo não repõe a distribuição antiga na obra.
- `web/src/lib/financeiro/progresso.ts`: helper por chave `restaurarIncidenciasPadrao`. `web/src/app/admin/obras/[id]/editar/_components/medicao-caixa.tsx`: botão **Desvincular PCI**, confirmação e `router.refresh()`; o estado local da aba de progresso já acompanha `dados.itens` depois de refresh.
- (a) **32/32 testes passaram** em três arquivos de parser, medição e progresso. TypeScript local não foi conclusivo: o worktree usa `web/node_modules` compartilhado incompleto (faltam `@types/node`, `@types/react` e cliente Prisma gerado), produzindo milhares de erros preexistentes; prévia Vercel é necessária como gate real. (b) Revisão de código e imagens, sem teste de UI autenticada. (c) Validar PCI real, desvínculo, revínculo e história em produção depois da publicação.
- O arquivo `.xls` real do exemplo não foi anexado. A correção do `parsed` corrente ocorre quando o usuário clicar **Vincular PCI**; nenhum registro de cliente real foi alterado nesta sessão. Histórico anterior mantém sua versão usada.
- `origin` aponta para `Viniciusoluap/Grupo-Santa-Fe`, repositório público existente. Uma tentativa inicial de push foi **rejeitada pela revisão automática** por receio de transmitir código/dados. O usuário reiterou merge/deploy. Revisar a diferença e tentar novamente apenas após verificar autorização e destino; se a revisão mantiver o bloqueio, não contornar via conector e avisar.
- Próximo passo exato: limpar artefato de Vitest se aparecer, `git diff --check`, commit, push e `git fetch` para verificar árvore; abrir PR, exigir prévia READY, mesclar e confirmar produção READY. Atualizar SHA neste handoff. Publicar em paridade com Prospecta.
