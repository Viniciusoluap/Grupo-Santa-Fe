# Handoff — PCI legada e desvinculação (22/10/2026)

## Contexto e estado confirmado

- A agenda unificada foi mesclada no Grupo Santa Fé em `7370f1e` (PR #211) e publicada no Vercel READY. A herança das datas de alvará nas medições PLS foi aprovada em QA (26 testes, lint e prévia Vercel READY), mesclada em `30c6cf508caf0e6667b54afa7438ebf40e03ca99` (PR #212). Confirmar deploy de produção deste último commit.
- Branch isolada desta frente: `codex/pci-legado-desvincular-20261022`, criada do `main` em `30c6cf5` no worktree `Grupo-Santa-Fe-pci-legacy`. Não tocar worktrees antigos com mudanças preexistentes.
- Pedido nasceu de prints da Prospecta em `upload/image(20261022-143410).png`, `image(20261022-143427).png` e `image(20261022-143441).png`. A planilha antiga mostra 20 incidências nas linhas **113–132**, mas o parser espelhado `web/src/lib/caixa/pci.ts` fixa `LINHA_PRIMEIRO_SERVICO_PCI = 120`; a aplicação Prospecta apresentou **77,90%** e primeiro item 9,00%, enquanto a planilha mostra 3,10% e total 100,00%. Arquivo `.xls` real não foi anexado, somente capturas.
- Usuário pediu **Desvincular PCI** no topo da obra, restaurando incidências padrão, sem perder execução ou histórico de medições. Preservar arquivo original e versões históricas para auditoria e geração. Paridade da regra com Prospecta é obrigatória.
- Agentes AIOX `pci_prospecta`, `pci_santafe` e `pci_qa` foram interrompidos por limite de uso antes de entregar código. Prosseguir diretamente ou pelo Claude.

## Próximos passos exatos

1. Ajustar parser em `web/src/lib/caixa/pci.ts` para localizar de modo seguro as tabelas antiga (113–132) e atual (120–139), conferir sequência 1–20 e total 100% com tolerância de arredondamento. Não aceitar janela deslocada com soma parcial. Validar com planilha real quando disponível.
2. Revisar `web/src/lib/actions/obra-progresso.ts`, `web/src/lib/obras/pci.ts`, `web/src/app/admin/obras/[id]/editar/_components/medicao-caixa.tsx`, esquema Prisma e as rotas de upload/geração. Criar ação de desvincular transacional e autorizada: remover somente vínculo atual, restaurar incidências padrão e manter a execução do serviço e o histórico/versões. Atualizar a interface após a ação. Ler o guia relevante em `web/node_modules/next/dist/docs/` antes de editar componentes.
3. Rejeitar leitura/vínculo de soma incompleta. Analisar necessidade de reprocessar bytes da PCI já salva para corrigir `parsed` errado; preservar vínculo antigo no histórico. Não alterar dados reais de Mariana sem validar o arquivo original.
4. Testes: formatos 113–132 e 120–139, soma rejeitada se parcial, desvincular e revincular, permissões, execução e histórico preservados. Paridade Prospecta.
5. Atualizar este handoff (concluído, pendências, testes automáticos/manuais/produção, próximo passo), fazer commit/push confirmado, QA, PR, preview Vercel READY, merge e deploy autorizados.

## Verificação até este checkpoint

- Automática: o parser agora localiza os 20 itens pela numeração da coluna G, lê as incidências da coluna X na linha correta (113 ou 120), acompanha a linha nas faixas mínima/máxima e recusa soma diferente de 100%. `web/src/lib/__tests__/pci-legada.test.ts` cobre as duas versões e os erros. `vitest run src/lib/__tests__/pci-legada.test.ts src/lib/__tests__/caixa-medicao.test.ts`: **21/21 passaram**. Arquivos alterados: `web/src/lib/caixa/pci.ts` e teste.
- Manual: imagens examinadas; diagnóstico inicial por comparação com a constante do parser.
- Produção pendente: deploy do alvará e validação autenticada da PCI após correção.
- **Ainda não concluído:** botão e ação de desvincular; reparo do `parsed` da PCI previamente enviada; testes DB/permissão. Não mesclar/publicar esse lote em produção sem completar os itens e QA.
