# HANDOFF 25/10 — AIOX correções 02–14 — Grupo Santa Fé

## Checkpoint inicial
- Data: 25/10/2026. Repositório: `Viniciusoluap/Grupo-Santa-Fe`.
- Branch: `codex/aiox-correcoes-02-14-20261025`.
- Base remota: `main` em `b51806189e51bcc4247a590433ceafba70acc0df` (conferida por fetch).
- Autorização: implementar, testar, preparar PR, merge e deploy; coordenação final com a Prospecta pelo agente principal.
- Escopo: correções 02–14, excluída a correção 01 Asaas/Pluggy.
- Estado: auditoria concluída, código ainda não modificado neste checkpoint. Clone inicial limpo.
- Paridade: Prospecta em branch independente conduzida pelo agente principal.
- PR: nenhum aberto no momento da auditoria. Merge: não. Deploy: não.
- Banco: nenhuma migração ou alteração de dados realizada.
- Testes: (a) automáticos ainda não executados neste lote; (b) manuais não realizados; (c) produção pendente.

## Diagnóstico e próxima ação
- 02, 08, 11, 12, 14: elementos exatos da reclamação já ausentes nas telas equivalentes deste repositório; verificar que não há rota redundante antes de declarar concluído.
- 03, 04, 05, 06, 07, 09, 10, 13: necessitam intervenção e validação. Há somente um empreiteiro por obra no modelo atual.
- Próximo passo: corrigir layout dos filtros e histórico de medições; revisar os elementos já ausentes e executar testes direcionados. Depois publicar novo checkpoint.
- Riscos: alterações em componentes compartilhados, dados financeiros e fotos; manter banco e credenciais do Santa Fé separados da Prospecta.
- Para Claude: começar pelo SHA remoto desta branch, ler este handoff e os commits posteriores; nunca reaplicar indiscriminadamente patches da Prospecta. Verificar `origin/main` antes de cada integração.

## Checkpoint lote 1 e lote 2 — 25/10
- Lote 1: corrigidos filtros de data em `web/src/components/obras/lista-obras.tsx` e layout de medição em `web/src/app/admin/obras/[id]/editar/_components/progresso-obra.tsx`. 02, 08, 11, 12 e 14 já estavam ausentes das interfaces equivalentes; sem exclusão de rotas ou dados. 04 e 05 em validação visual manual.
- Lote 2: campo total do Pró-Soluto, opção individual por obra para base do empreiteiro, padrão falso e migração aditiva `20261025180000_pro_soluto_base_empreiteiro`. Motor mantém fórmula do lucro da empresa e a base antiga quando desmarcado. Valor zero com dados válidos resulta zero, sem alterar a parcela Price legada. O sistema suporta um empreiteiro por obra.
- Arquivos: `web/src/lib/financeiro/obra.ts`, `obra-dados.ts`, `actions/obra-financeiro.ts`, `web/src/app/admin/obras/[id]/editar/_components/financeiro-obra.tsx`, `editar-obra-client.tsx`, `web/prisma/schema.prisma`, a migração e `web/src/lib/__tests__/financeiro-obra.test.ts`, além dos dois componentes do lote 1.
- Testes (a): Prisma generate, TypeScript, ESLint dos arquivos alterados e 22 testes financeiros passaram; 14 testes direcionados de filtros/medição passaram antes da mudança financeira. Build e suíte total pendentes. (b) inspeção visual Safari/iPad pendente. (c) produção e migração pendentes.
- Banco: migração criada, **não aplicada**. Nenhum dado de produção alterado.
- Riscos: deploy deve aplicar migração antes de expor o campo; verificar base e residual numa obra real sem atualizar pagamentos. Conferir novas mudanças paralelas do Claude antes do merge.
- Próximo passo exato: implementar responsável do lead na Agenda (07), depois inventário e sincronização obras/imóveis (09/10), relatórios (06), fotos (13). Executar build e validação cruzada após esses lotes.

## Checkpoint lotes 3 e 4 — 25/10
- 07: Agenda consulta responsável atual do lead para visitas e vencimentos; tarefa com responsável próprio tem precedência. Exibe “Não atribuído” só quando aplicável. Arquivos `web/src/app/admin/agenda/page.tsx` e `_components/agenda-client.tsx`.
- 09: tela de edição pré-preenche coordenadas da PCI **vinculada à própria obra**, somente quando não há ponto já salvo, e persiste após salvar. `web/src/components/obras/editar-obra-pagina.tsx`. Não houve atualização retroativa no banco.
- 10: edição de obra com endereço válido cria/atualiza imóvel interno privado com vínculo estável; imóvel manual vinculado conserva seus atributos comerciais. O catálogo administrativo lista também obras legadas com endereço sem imóvel como “vínculo pendente”, com link à obra; não as publica no site. Arquivos `web/src/lib/obras/localizacao.ts`, `web/src/lib/actions/obras.ts`, `web/src/app/admin/imoveis/page.tsx`.
- Banco: nenhuma migração adicional. Para backfill persistente histórico 09/10, ainda falta inventário dos bancos de produção (IDs, conflitos, contagem, plano reversível) e aprovação específica. Não presumir que a linha legada de catálogo é um imóvel já vinculado.
- Testes (a): TypeScript e ESLint dos arquivos alterados; 7 testes de Agenda passaram. Teste de localização com banco real foi pulado sem `TEST_DATABASE_URL` (4 casos), 2 testes de renderização de Agenda passaram na rodada posterior. (b) inspeção manual de UI pendente. (c) produção pendente.
- Próximo passo exato: Excel a partir do mesmo modelo do PDF (06), depois upload individual de fotos (13). Rever preservação de publicação e permissões no catálogo durante QA.

## Checkpoint lote 5 — 25/10
- 06: exportação Excel deriva do mesmo objeto `RelatorioObra` que alimenta o PDF, com aba de resumo, uma aba por seção e referências fotográficas. Campos, tabelas e gráficos são transcritos sem números inventados. O PDF anterior permanece disponível. Campos financeiros de Pró-Soluto/base do empreiteiro incluídos no modelo comum.
- Arquivos: `web/src/lib/obras/relatorio.ts`, `web/src/lib/obras/relatorio-excel.ts`, `web/src/app/admin/obras/[id]/editar/_components/relatorio-obra-botao.tsx`, `web/src/lib/__tests__/relatorio-excel.test.ts`.
- Testes: TypeScript, ESLint dos arquivos alterados, 8 testes de relatório existentes e um teste de equivalência de campos/tabela/foto passaram. Comparação de uma obra real PDF/Excel e inspeção visual continuam pendentes por falta de dados de ambiente.
- Banco/infra: nenhuma alteração neste lote. Sem merge, deploy ou migração. Próximo passo: fotos por envio individual, seguido de build, QA integral e revisão remota.

## Checkpoint lote 6 — 25/10
- 13: formulários administrativo e do corretor separam cadastro de fotografias, enviam uma foto compactada por requisição com progresso individual e uma tentativa automática de repetição. Preservam fotos existentes, capa e ordem final. O seletor aceita até 40 fotos por padrão (`NEXT_PUBLIC_MAX_FOTOS_IMOVEL` permite 16–100); JPG é gerado no navegador, incluindo HEIC quando o navegador o decodifica. Imagens incompatíveis recebem erro visível.
- Rota autenticada `/api/imoveis/[id]/fotos` aplica restrição de propriedade do corretor, limite, armazenamento inicial em banco e posterior Drive. Hash SHA-256 com índice único por imóvel torna reenvios idempotentes. Falha do Drive mantém bytes para a rotina de reenvio pendente já existente. Migração aditiva `20261025190000_fotos_imovel_idempotentes` **não aplicada**; deve entrar antes da rota em produção.
- Arquivos: `web/src/lib/imovel-fotos.ts`, `imovel-fotos-limites.ts`, `envio-fotos-imovel.ts`, `imoveis/salvar.ts`, `web/src/app/api/imoveis/[id]/fotos/route.ts`, `web/src/app/api/imoveis/salvar/route.ts`, `web/src/components/ui/form-com-envio.tsx`, `web/src/app/corretor/imoveis/imoveis-do-corretor.tsx`, `web/src/app/admin/imoveis/_components/foto-upload.tsx`, schema/migração, e teste `envio-fotos-imovel.test.ts`.
- Testes: Prisma generate, TypeScript e ESLint dos arquivos alterados passaram; 26 testes dirigidos passaram. `next build` compilou e passou TypeScript, mas falhou no prerender da página inicial com `ECONNREFUSED` do PostgreSQL indisponível no ambiente. Teste de integração com Drive/banco, Safari/iPad e vários arquivos reais pendente. Sem merge, deploy ou atualização de dados.
- Risco residual: verificar provedores e custos de armazenamento, extensão HEIC no Safari real, limites de duração do servidor e retenção de bytes caso o Drive permaneça indisponível. Para Claude: continuar sobre o SHA remoto desta branch, aplicar ambas as migrações somente em ambiente autorizado; conferir remotos e não refazer o envio sequencial.

## Checkpoint lote 7 e entrega para revisão — 25/10
- Corrigidos dois mocks de testes legados para refletir a consulta transacional nova de catálogo e a consulta preexistente de histórico PLS. Os 10 testes envolvidos passaram isoladamente; 26 testes dirigidos de financeiro, Excel e fotos passaram.
- Suíte geral: 109 arquivos passaram, 15 pulados por dependência de banco; 775 testes passaram e 89 pulados. Um worker terminou por limite de heap JavaScript de 2 GB, então a execução geral **não está aprovada** como verde. A primeira rodada antes do ajuste tinha três falhas de mocks, corrigidas e novamente verificadas. A execução com dois workers não teve falhas de asserção, mas ainda terminou com OOM.
- Build: compilação e checagem TypeScript passaram; prerender `/` falhou por `ECONNREFUSED` do PostgreSQL. Não há prova de build final com banco configurado. Migrações aditivas de Pró-Soluto e hash de fotos criadas, não aplicadas. Sem atualização de produção, merge ou deploy.
- Pendente para homologação: banco de testes disponível para integração e build; comparação real PDF/Excel; fotos com Drive/Safari iPad; captura responsiva desktop/tablet/mobile; inventário idempotente de backfill PCI/catálogo, conflitos e aprovação específica para dados em massa. C09/C10 contemplam futuros cadastros e visibilidade administrativa de legados, mas não backfill histórico. Revisar custo e retenção do armazenamento de fotos.
- Paridade: comparar com branch da Prospecta e suas migrações antes de integrar. Branch de trabalho é `codex/aiox-correcoes-02-14-20261025`. Para Claude: ler os checkpoints e commits da branch; não presumir que testes pulados foram validados; prosseguir primeiro com QA e inventário de dados, preservar o trabalho paralelo.

## Revisão final da correção 02
- A varredura transversal detectou o emoji 🤝 ainda no rótulo compartilhado `leadTemperaturaRotulo` e no cabeçalho do lead. Removido somente para `fechado`, mantendo o valor persistido `fechado`, os demais rótulos e filtros intactos. Agora o seletor da listagem e todos os componentes reutilizados mostram `Negócio fechado`. O teste legado de rótulo foi ajustado; não há atualização de registros.
