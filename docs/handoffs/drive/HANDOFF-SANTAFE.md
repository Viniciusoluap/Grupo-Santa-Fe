# HANDOFF — Organização completa do Google Drive (Grupo Santa Fé) — 29/10/2026

Branch: `claude/drive-organizacao-20261029` · Spec: `docs/handoffs/drive/SPEC-DRIVE-ORGANIZACAO.md`
Paridade: a Prospecta implementa a mesma spec em paralelo (mesmos nomes de pastas/etiquetas).
Status: implementação concluída na branch; **migração NÃO aplicada em produção** (o orquestrador aplica).

## Concluído (commits na branch)
1. `21f819e` — `web/src/lib/drive-estrutura.ts`: caminhos/nomes novos (Equipe, Modelos/PCI CAIXA,
   Obras/Fotos/Medição NN — data | Sem medição, Gerador de PCI, Clientes/…/Atendimento/WhatsApp,
   WhatsApp sem cliente/+número, Incorporação/…/Orçamento), etiquetas da spec e `entidadeDaChave`.
2. `56b1e0b` (+ ajuste em `2b506e9`) — migração `web/prisma/migrations/20261029100000_drive_organizacao/migration.sql`
   (aditiva): `driveFileId` em `documentos_usuario`, `pci_modelos`, `obra_pci_versoes`, `whatsapp_midias`;
   `planilhaDriveFileId`/`pdfDriveFileId` em `pci_geradas`; tabela nova `estudo_orcamento_planilhas`
   (estudoId, arquivoId único, sha256, único por estudo+sha256) com RLS ligado.
3. `0ab0098` — `registro-drive.ts`: primitivas `enviarArquivoNoCaminho`, `moverArquivoParaCaminho`,
   `buscarArquivoNoCaminho`, `pastaPorChave`, `enviarPastaParaLixeira`, `listarSubpastasDoSistema` (só dentro da raiz atual).
   `web/src/lib/drive-organizacao.ts`: descritores por tipo (documentoUsuario, pciModelo, pciGerada, pciVersao,
   arquivo [fotos de obra, documentos de cliente/checklist, documentos de registro em banco, planilha do orçamento],
   whatsapp, documentoRegistro), `copiarParaDrive`, `lixeiraDaPasta`, `lixeiraDeArquivosSemUso`,
   `reorganizarItens`, `sincronizarDrive` (fases enviar → mover → órfãs; lotes; prazo; estado/relatório/trava em
   `configuracoes` chaves `drive.organizacao.*`). Rota `/api/arquivo/[id]` passa a servir do banco quando há bytes.
4. `35ffd64`/`2b506e9` — gravação no Drive: documento do usuário/engenheiro (rota `api/usuarios/[id]/documentos`,
   substituição manda a versão anterior à lixeira), modelo de PCI, PCI gerada (xls/xlsm + pdf), PCI original
   (guarda o `driveFileId` da versão), foto de obra, mídia do WhatsApp (`guardarMidia`), planilha importada do
   orçamento (ao salvar o orçamento; original continua no JSON).
5. `3574c51` — exclusões → lixeira: lead definitivo (`cliente:<id>`; antes realoca documentos usados por lead
   duplicado e mídias de WhatsApp), obra (`obra:<id>`), estudo (`incorporacao:<id>`), projeto (`projeto-<id>`),
   imóvel (`imovel:<id>`), usuário/corretor (`equipe:<id>`), checklist de financiamento (arquivos), documento do
   usuário, foto de obra, conversa do WhatsApp. Banco primeiro; falha no Drive nunca bloqueia.
   Lead: documento **com cópia no Drive** (ou usado por outro lead) não bloqueia mais a exclusão definitiva;
   documento só no banco continua bloqueando (`vinculosDoLead` em `web/src/lib/actions/leads.ts`).
6. `cbfd17c` — cron: `Organizar Drive` no fim do cron diário existente `/api/cron/lead-card-due` (sem cron novo,
   mesmo padrão dos bancos; `maxDuration = 60`, prazo ≤ 45 s). Botão "Organizar Drive agora" + último relatório no
   cartão Google Drive em Configurações (só admin; `organizarDriveAgora`/`relatorioOrganizacaoDrive`).
7. Testes: `web/src/lib/__tests__/drive-estrutura-organizacao.test.ts`, `web/src/lib/__tests__/drive-organizacao.db.test.ts`.

## Decisões
- Banco continua servindo o app; Drive é cópia organizada (exceto onde já era só Drive — inalterado).
- Proteção do sincronizador: só pastas com etiqueta `<prefixo>:<id>` dentro da raiz atual; mais de 25 órfãs numa
  página e mais da metade da página → nada é apagado e o relatório avisa (banco errado/vazio).
- Pastas `cliente:projeto-<id>` (portfólio de projeto sem lead) são verificadas contra `projetos`.
- PCI original: mantida em Medições CAIXA (spec); envio pendente adota cópia antiga com o mesmo nome no destino.
- Fotos de imóveis pendentes usam o fluxo próprio existente (`enviarFotosPendentesAoDrive`).

## Limitações / pendências
- Arquivos sem dono identificável na tabela `arquivos` (KML/levantamento do estudo, contrato sem lead) não são
  copiados (sem pasta definida na spec).
- Se houver pastas de topo duplicadas com a mesma etiqueta, a varredura de órfãs olha só a mais antiga.
- PDFs de medição gerados sob demanda continuam como antes (cópia na geração).
- Paridade: confirmar com a sessão da Prospecta a mesma regra de bloqueio de documentos na exclusão de lead.

## Testes
(a) automáticos: `npx tsc --noEmit` limpo; `npx eslint` dos 23 arquivos tocados limpo; vitest (banco local)
   26 arquivos de drive/exclusões/engenheiro/PCI/WhatsApp — 157 passando; 4 falhas pré-existentes também na main
   (`exclusao-definitiva.db` regularização "null constraint" do banco local; `medicao-drive.db` PCI não vinculada).
(b) manuais: nenhum (sem Google real nesta sessão).
(c) produção: aplicar a migração; clicar "Organizar Drive agora" e conferir relatório/pastas; excluir um lead de
   teste arquivado e ver a pasta na lixeira do Drive.

## Revisão do PR #239 (3 achados do revisor automático) — 29/10
- P1: nenhuma pasta vai para a lixeira com arquivo em uso. `lixeiraPastaSegura` (em `drive-organizacao.ts`) lista
  os arquivos da pasta (recursivo e paginado — `arquivosNaPasta` em `registro-drive.ts`), confere todas as tabelas
  (`driveFilesEmUso`), tenta levar os em uso para a pasta do registro dono (`realocarArquivosEmUso`; fotos de
  imóvel via `organizarFotosDoImovel`) e só apaga a pasta se não sobrar nenhum em uso. Vale para órfãs do
  sincronizador, exclusões (`lixeiraDaPasta`) e fila. Relatório: `pastasMantidasEmUso` (aparece no cartão).
  Exclusão de lead: a pasta sempre passa por essa regra (se não esvaziar, fica e entra na fila).
- P2: fila durável `drive_lixeira_pendente` (migração NOVA `web/prisma/migrations/20261029100100_drive_lixeira_fila`,
  aditiva, RLS ligado; modelo `DriveLixeiraPendente`), gêmea de `drive_trash_queue` da Prospecta. Grava quando a
  lixeira de arquivo/pasta falha (ou sem Drive conectado, arquivo) e o sincronizador reprocessa no início, dentro do
  prazo (até 50 por execução): sucesso ou 404 → remove; arquivo voltou a ser usado → remove sem apagar; falha → `tentativas`+1.
- P3: `enviarFotosPendentesAoDrive({ lote, prazo })` em lotes e com o mesmo prazo do sincronizador, retomável (só
  `driveFileId` nulo); roda em toda execução com pendentes. "Testar Google Drive" usa prazo de 30 s.
- Prospecta: P2 já existia (`drive_trash_queue`); P3 não se aplica (sem varredura de fotos fora do laço com prazo);
  P1 alinhado lá também (arquivo em uso é movido para o dono antes de decidir; se não sair, a pasta fica).
- Testes (a) automáticos: 5 casos novos em `drive-organizacao.db.test.ts` (Drive simulado com falhas injetadas) —
  11/11 + `imovel-fotos.db.test.ts` 5/5 em banco local separado `santafe_drive`; `npx prisma generate`, `npx tsc --noEmit`
  e eslint dos arquivos tocados limpos. (b) manuais: nenhum. (c) produção: aplicar `20261029100100_drive_lixeira_fila`
  (junto com a anterior) antes do deploy — sem a tabela, a fila só loga erro (não bloqueia exclusões).

## Próximo passo exato
Orquestrador: revisar, aplicar `20261029100000_drive_organizacao` e `20261029100100_drive_lixeira_fila` em produção, merge e deploy; depois rodar o
botão "Organizar Drive agora" até o relatório indicar ciclo concluído.
