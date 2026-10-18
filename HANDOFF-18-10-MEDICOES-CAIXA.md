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
