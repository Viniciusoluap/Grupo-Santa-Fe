# Handoff — retomada de medições CAIXA (18/10/2026)

## Começar por aqui
Este checkpoint complementa os handoffs de 10, 15 e 32 implementações. Não refazer lotes publicados.
Retomada solicitada pelo proprietário após esgotar o saldo no Claude.

## Estado remoto confirmado
- Prospecta main: `5f68dcf`, PR #135 (medições: solicitar, receber, editar, excluir e filtro).
- Santa Fé main: `5eb2acc`, PR #201 (mesma regra).
- Branch do Claude: `claude/sync-mirrored-repos-bsqnz3`.
- Prospecta tem o commit ainda não publicado `1fa371f2b012faac8a867f839861b45e4537988d`: PCI XLS/XLSB por obra, incidências exatas, formulários PLS/Repactuação/Alteração, fotos por medição e geração XLS/PDF. 25 arquivos diferentes da main; sem PR aberto para este conjunto no momento da retomada.
- Santa Fé: branch `9922064`, sem diferença de arquivos para a main; PCI/PLS ainda precisa ser portada.
- As centenas de commits "ahead" decorrem do histórico de merges/squash da branch do Claude; usar a diferença de arquivos para medir trabalho pendente.
- Os drafts antigos Prospecta #105 / Santa Fé #174 são do Lote 5 já superado. Não integrar.
- Branch nova desta retomada nos dois: `codex/continuacao-medicoes-20261018`, criada a partir dos heads acima, sem modificar a branch do Claude.

## Próximas ações
1. Conferir e corrigir achados dos PRs #135/#201: buffer de edição trocado após solicitar/receber (Prospecta), exclusão/restauração da vigente não atômica (ambos), estimativa da 100ª medição sem predecessor (ambos).
2. Rodar testes/check/build do commit PCI da Prospecta; revisar concorrência, autorização, limite Vercel e geração dos arquivos.
3. Portar PCI/PLS para Santa Fé respeitando Prisma/Next e a mesma regra.
4. Verificar schema e migrations 0057/0058 (Prospecta) e equivalentes Santa Fé antes de qualquer publicação. A consulta somente-leitura confirmou a ausência da 0058 em Neon produção (ver checkpoint abaixo); equivalentes Santa Fé ainda não verificados.
5. Salvar commits e PRs; nenhuma nova autorização de merge/deploy foi dada para este novo conjunto em 18/10. Não inferir autorização de mensagens antigas referentes ao Lote 7.

## Evidências e limites
- O código e o modelo de teste anonimizados do Claude foram recuperados do GitHub.
- Alterações que existam apenas na máquina/sessão do Claude e nunca tenham sido commitadas não são visíveis aqui.
- Nenhum dado de produção foi alterado nesta retomada.


## Checkpoint desta retomada
- Neon produção verificado somente por SELECT: `construction_pci` não existe; `measurement_type` e `construction_photos.progress_history_id` também ausentes. 0058 ainda não aplicada; não publicar o código novo antes dela.
- Correções preparadas: buffer da medição preservado ao solicitar/receber/excluir foto (Prospecta); bloqueio de excluir enquanto edita; valores numéricos do formulário remontados ao trocar de medição; estimativas com 101º predecessor e 100 registros exibidos (ambos); editar/excluir vigente e atualizar progresso na mesma transação (ambos).
- Santa Fé: criação/edição/exclusão usam a mesma trava da linha da obra durante a transação. Prospecta: edição/exclusão agrupadas em `db.batch`; a concorrência entre operações ainda precisa de revisão/teste específico.
- Novo ID da medição Prospecta vem diretamente de INSERT RETURNING, sem buscar por timestamp (evita associar fotos ao registro de outro envio simultâneo).
- PCI limitada a 3 MiB no cliente e servidor, compatível com JSON/base64 e limite de entrada da Vercel. O limite anterior de 6 MiB não funcionava na hospedagem.
- Testes novos cobrem rollback de editar/excluir e estimativa na janela. Santa Fé: esses 3 testes, 14 testes financeiros/filtros, TypeScript e lint passaram. São testes com contrato transacional simulado; **não equivalem a teste em Postgres real**. Instalação local de Postgres não disponível neste ambiente.
- Risco confirmado a resolver antes do aceite PCI: o exportador usa a PCI atual da obra para toda medição histórica; trocar a PCI pode mudar arquivos históricos. Falta vincular versão imutável da PCI à medição e conferir que incidências exportadas correspondem às salvas. Não portar/publicar esse comportamento sem corrigir.
- Sem merge, deploy ou alteração de dados de produção nesta retomada.

## Validação local concluída nesta retomada
- Prospecta: TypeScript sem erros; 854/854 testes em 103 arquivos; os 16 testes CAIXA e 2 novos de atomicidade incluídos. Build Vite + esbuild aprovado (aviso de tamanho de chunks).
- Santa Fé: TypeScript e ESLint dos arquivos alterados aprovados; 670 testes aprovados, 46 testes de integração ignorados sem TEST_DATABASE_URL. Mock do portal do empreiteiro adaptado à trava transacional.
- Não houve teste visual autenticado, teste Postgres real nem publicação. Não confundir testes simulados com evidência de produção.
- Git push por HTTPS indisponível sem credencial no shell; usar conector GitHub para salvar somente a branch nova e abrir PRs em rascunho.

## Checkpoint remoto salvo
- Prospecta: PR #136 — https://github.com/Viniciusoluap/Prospecta/pull/136 (rascunho).
- Santa Fé: PR #202 — https://github.com/Viniciusoluap/Grupo-Santa-Fe/pull/202 (rascunho).
- Ambas em `codex/continuacao-medicoes-20261018`. Branches do Claude intactas.
- As árvores de arquivos recuperadas foram conferidas por SHA. A branch de entrega foi ancorada na main atual, preservando os mesmos arquivos, para evitar integrar centenas de commits antigos de squash.
- Este handoff está commitado no GitHub; retomar por estes PRs, não pelo scratch local nem pelos drafts antigos.


## Atualização posterior aos prints — portabilidade CAIXA preparada (18/10)
### Recuperação exata e limite
- Os prints mostram o Claude com Santa Fé já portado e 729 testes relatados. Foram verificadas 63 branches remotas: nenhuma contém os arquivos PCI/CAIXA dessa etapa. A branch do Claude permanece em 9922064. Não afirmar que esse código local foi recuperado.
- A continuação Santa Fé foi implementada a partir do motor CAIXA da Prospecta 1fa371f, respeitando Prisma/Next e o visual claro. Código anterior preservado; branch do Claude intacta.

### Alterações novas nesta continuação
- Santa Fé: leitura de PCI XLS/XLSB; vínculo das incidências exatas; PLS/Repactuação/Alteração; fotos por medição; XLS/PDF autenticados; campos integrados ao progresso e histórico. Bibliotecas puras portadas da Prospecta e fixture anônima mantida.
- Ambos: versão imutável da PCI vinculada à medição. Trocar PCI mantém documentos históricos. Medição legada sem versão não usa silenciosamente a PCI atual: exportação responde 409 e exige revisão explícita. Incidências incompatíveis são recusadas.
- Prospecta: criar/editar/excluir usam trava da obra no batch e sincronizam a vigente lendo o histórico depois da trava, removendo o predecessor calculado fora da transação. INSERT usa clock_timestamp após trava.
- Santa Fé: operações e upload da PCI compartilham trava da obra; horário da nova medição definido após a trava.
- Ambos: falha parcial de fotos mantém somente as pendentes para reenvio na mesma medição, sem repetir as confirmadas. Campos numéricos do formulário reinicializam ao finalizar/cancelar edição.
- PDF: título longo ajustado à largura do cabeçalho; revisão visual com dados anônimos da PLS (5 páginas) e primeiras páginas de Repactuação/Alteração. Sem avaliação/aceite pelo SIOPI real.

### Migrations preparadas, não aplicadas em produção
- Prospecta: 0058 original do Claude + nova 0059_medicao_pci_versoes.sql; journal atualizado. 0058 estava ausente na consulta somente-leitura anterior.
- Santa Fé: 20261018220000_medicao_caixa_pci. Somente estruturas aditivas e ampliação da precisão de incidência.
- Versão referenciada não pode ser removida isoladamente. Exclusão definitiva de obra já autorizada pela lógica existente continua consistente e sem versões órfãs (testada em banco de teste).
- Rollback operacional: reverter código e manter estruturas/arquivos históricos. Não reduzir precisão nem apagar tabelas de versões.

### Evidências atuais
- Prospecta: suíte completa 856/856 (104 arquivos); validação posterior focada 20/20; TypeScript aprovado; build Vite/esbuild aprovado antes do pequeno ajuste visual do título e reset do formulário.
- Santa Fé: suíte completa 690 aprovados e 46 ignorados por falta de TEST_DATABASE_URL; validação posterior focada 22/22; TypeScript aprovado; ESLint das novas rotas/componentes/actions sem erros (2 avisos de img em prévias locais/privadas).
- Migrations dos dois bancos executadas em PostgreSQL embarcado PGlite: troca da PCI mantém versão histórica; FK recusa remoção da versão referenciada; exclusão autorizada da obra não deixa versões órfãs. Testes versionados caixa-pci-migration.test.ts.
- Build completo Santa Fé compila e passa TypeScript, mas falha no prerender da home por ECONNREFUSED no banco local. Modo next build --experimental-build-mode compile aprovado; não declarar build completo aprovado.
- Testes PGlite não substituem testes com os drivers Neon/Prisma em ambiente integrado nem autenticação real no navegador.

### Próximo ponto de retomada
1. Abrir PRs Prospecta #136 e Santa Fé #202, branches codex/continuacao-medicoes-20261018 (rascunhos); usar os heads atuais. Não usar os drafts antigos #105/#174.
2. Configurar banco de teste isolado para executar testes integrados dos adaptadores e concluir build/prerender Santa Fé; testar os fluxos autenticados admin/colaborador/empreiteiro e recusa de outra obra.
3. Validar os três modelos XLS/PDF com uma PCI autorizada e o fluxo no SIOPI, incluindo fotos e substituição da PCI.
4. Revisar/aplicar migrations só no ambiente correto, com verificações antes/depois; solicitar autorização atual de produção conforme handoff de 15/10. Sem merge/deploy nesta retomada.


## Retomada do Claude após o Codex (19/10) — LER PRIMEIRO
### Onde está o trabalho
- Branch única de entrega nos dois: `claude/sync-mirrored-repos-bsqnz3` (a branch `codex/continuacao-medicoes-20261018` foi incorporada por merge, sem reescrever histórico; branches `codex/*` intactas).
- Prospecta: merge `56cd309` (árvore idêntica à do Codex) + `f7b78d5` (Drive).
- Santa Fé: merge `7f6811c` (port do Codex) + `da27330` (Drive + validação) + `bb5efca` (teste).
- O port local antigo do Claude para o Santa Fé foi preservado só como referência (stash/patch local); o port do Codex foi adotado porque já tem versões imutáveis da PCI. O .xls gerado pelo port do Codex é byte a byte igual ao validado antes pelo Claude.

### O que foi feito nesta retomada
- Google Drive (pedido do dono): `Obras/<Obra (nº)>/Medições CAIXA/` recebe
  - "PCI original — dd-mm-aaaa.xls" a cada versão nova da PCI (reenviar o mesmo arquivo não duplica);
  - "PLS (levantamento dd-mm-aaaa) — dd-mm-aaaa.xls/.pdf" (ou Repactuação/Alteração) a cada medição salva.
  - Sem Drive conectado ou com recusa do Google: a medição é salva normalmente e os arquivos seguem no download (nunca bloqueia).
  - SF: `src/lib/obras/medicao-gerar.ts` (gerador único: download + Drive), action `copiarMedicaoNoDrive`, `uploadArquivoMedicaoObra` em `registro-drive.ts`.
  - Prospecta: `gerarArquivoMedicao` + `POST /api/obras/medicoes/:id/drive` em `server/routes/obra-medicao-caixa.ts`, `uploadArquivoMedicaoObra` em `server/drive-documents.ts`.
  - `caminhoMedicoesObra` igual em `shared/drive-estrutura.ts` e `web/src/lib/drive-estrutura.ts`.
- SF: nome do arquivo igual à Prospecta (`PLS_Obra_2026-08-25.xls`) e histórico mostrando "PLS · N foto(s)".
- A PCI original NUNCA é alterada: fica guardada (banco + Drive); cada medição gera uma cópia preenchida a partir da versão da PCI gravada nela.

### Evidências (19/10)
- (a) Automático: SF 739/739 testes COM Postgres real (inclui os 46 de banco que o Codex não rodou e o novo `medicao-drive.db.test.ts` com Drive simulado); build completo `next build` aprovado (o prerender que falhou para o Codex passou com banco local). Prospecta 857/857 testes (inclui PGlite), `pnpm check` e `pnpm build` aprovados.
- (b) Manual (navegador, SF local com Postgres): E2E 21/21 — envio/vínculo da PCI com incidência exata 6,999996223999880 e soma 100; progresso 29,35% igual à PLS da CAIXA; fotos em lote; salvar PLS; baixar .xls/.pdf; foto na aba Fotos; repactuação; alteração sem justificativa barrada; outro empreiteiro e sem login recebem 403.
- (c) Pendente em produção: .xls aberto no Excel e aceito no SIOPI; Drive real (só testado com Drive simulado); tela da Prospecta no navegador (sem banco local compatível com neon-http); leitor .xlsb sem amostra real.

### Próximos passos
1. Revisão AIOX (@qa) — ver seção seguinte quando concluída.
2. Produção (autorizado pelo dono em 18/10: "Ao finalizar faça merge e deploy de cada etapa"): aplicar Prospecta 0058+0059 no Neon `br-steep-leaf-anxdjv1p` e SF `20261018220000_medicao_caixa_pci` no Supabase `giulchozonhzyopmgmkv` ANTES do merge; conferir antes/depois; squash merge; conferir deploy READY e erros de execução.
