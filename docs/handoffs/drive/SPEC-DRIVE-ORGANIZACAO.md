# SPEC — Organização completa do Google Drive (29/10/2026) — Prospecta + Grupo Santa Fé

Pedido do dono (29/10): "se eu deleto um cliente com seus arquivos ele também deve ser deletado do Drive — tem clientes que eu já deletei e estão lá; todos os arquivos salvos no sistema devem ser salvos no Drive de forma organizada com pastas e subpastas, sempre com padrão de identificação e nomenclatura para tudo ser fácil de achar. Ex.: a documentação do engenheiro foi adicionada no cadastro dele e não foi salva em nenhum local do Drive."

Regra igual nos dois sistemas (paridade). Implementação conforme a stack.

## Situação atual (diagnóstico)
- Estrutura existente: `shared/drive-estrutura.ts` (P) / `web/src/lib/drive-estrutura.ts` (SF): Clientes, Incorporação, Imóveis, Obras/Medições CAIXA; pastas achadas por etiqueta `appProperties.pastaSistema` (nunca pelo nome).
- Exclusão definitiva de lead (P `excluirLeadArquivadoDefinitivamente` em server/db.ts; SF equivalente) NÃO mexe no Drive (comentário: "não há remoção no Drive"). Excluir obra/estudo/serviço (P `server/exclusao-definitiva.ts`; SF `web/src/lib/crm/excluir-servico.ts`) também não.
- Arquivos guardados só no banco (sem cópia no Drive): documentos do usuário/engenheiro (P `server/usuario-documentos.ts`), modelos de PCI (`pci_models`), PCIs geradas (`pci_generated`), fotos de obra (bytea), mídia do WhatsApp, planilha importada do orçamento, e documentos que caíram no fallback "banco" quando o Drive falhou. No SF, o equivalente é a tabela `arquivos` sem `driveFileId` e as tabelas com `Bytes` (PciModelo, PciGerada, documentos do usuário, WhatsApp etc.).

## Estrutura alvo (nomes exatos, iguais nos dois)
```
<raiz>/
  Clientes/<Nome (nº id)>/<Atendimento|Financiamento|Jurídico|Regularização|Obras|Projetos|Avaliação|Outros serviços>/...   (já existe)
      .../Atendimento/WhatsApp/<Mídia — dd-mm-aaaa.ext>          (mídia de conversa ligada a lead)
  WhatsApp sem cliente/<+55 número>/<Mídia — dd-mm-aaaa.ext>    (conversa sem lead)
  Obras/<Obra (nº id)>/
      Medições CAIXA/                                           (já existe)
      Fotos/<Medição 01 — dd-mm-aaaa>/<Foto 01 — dd-mm-aaaa.jpg>   (fotos sem medição: "Fotos/Sem medição")
      Gerador de PCI/<PCI gerada — dd-mm-aaaa.xls|.xlsm|.pdf>
      PCI/<PCI original — dd-mm-aaaa.ext>                       (se ainda não estiver em Medições CAIXA, manter onde já está)
  Incorporação/<Estudo (nº id)>/... (já existe) + Orçamento/<Planilha importada — dd-mm-aaaa.xlsx>
  Imóveis/... (já existe)
  Equipe/<Nome do usuário (nº id)>/<Documento pessoal|Anuidade CREA|Carteirinha CREA|Outros>/<Rótulo — dd-mm-aaaa.ext>
  Modelos/PCI CAIXA/<PCI modelo v01 — dd-mm-aaaa.ext>
```
Chaves de etiqueta novas: `equipe`, `equipe:<id>`, `equipe:<id>:<categoria>`, `modelos`, `modelos:pci`, `obra:<id>:fotos`, `obra:<id>:fotos:medicao:<medId|sem>`, `obra:<id>:gerador-pci`, `cliente:<id>:atendimento:whatsapp`, `whatsapp-sem-cliente`, `whatsapp-sem-cliente:<numero>`, `incorporacao:<id>:orcamento`. Nome de arquivo sempre via `nomeArquivo(rotulo, data, nomeOriginal, mime)` (padrão "Rótulo — dd-mm-aaaa.ext"); numeração com 2 dígitos onde houver ordem.

## Regras
1. **Toda gravação de arquivo no sistema também grava no Drive** na pasta certa (cópia organizada; o banco continua servindo o app quando já é assim). Nova coluna `drive_file_id`/`driveFileId` (+ para PCI gerada: um para XLS e um para PDF) nas tabelas que não têm. Falha no Drive não impede salvar no sistema (fica pendente e o sincronizador tenta depois) — exceto onde hoje o Drive já é obrigatório (não mudar).
2. **Excluir no sistema → lixeira do Drive** (recuperável por 30 dias pelo dono; nunca exclusão permanente pela API):
   - lead excluído definitivamente → pasta `cliente:<id>` inteira para a lixeira (e remover o comentário "não há remoção no Drive"; os registros de documentos excluídos com arquivo no Drive podem então ser apagados junto);
   - obra / estudo de incorporação / imóvel / usuário excluídos → pasta `obra:<id>` / `incorporacao:<id>` / `imovel:<id>` / `equipe:<id>`;
   - documento/foto/arquivo individual excluído → arquivo para a lixeira (se nenhum outro registro usa o mesmo driveFileId — regra já usada em lead-documents);
   - a exclusão no banco acontece primeiro; a ida para a lixeira roda depois e, se falhar, o sincronizador resolve (nunca bloquear a exclusão por causa do Drive).
3. **Sincronizador "Organizar Drive"** (reconciliação idempotente, retomável, com limite de tempo por execução ~45 s e lotes):
   a) envia ao Drive todo arquivo que está só no banco (preenche drive_file_id);
   b) move/renomeia arquivos para o caminho certo (reaproveitar `reorganizar`, incluindo os novos tipos);
   c) **órfãos**: lista as pastas do sistema (por etiqueta) em Clientes/Obras/Incorporação/Imóveis/Equipe e manda para a lixeira as cujo registro NÃO existe mais no banco (lead apagado, obra apagada etc.). Lead apenas arquivado (soft delete) NÃO é órfão. Pastas sem etiqueta (criadas à mão) nunca são tocadas;
   d) devolve um relatório (enviados, movidos, pastas órfãs na lixeira, falhas) — sem dados pessoais nos logs.
   Execução: cron diário (P: adicionar em vercel.json crons + rota protegida por CRON_SECRET, mesmo padrão de /api/cron/lead-card-due; SF: mesmo padrão de cron do SF) **e** botão "Organizar Drive agora" no card do Google Drive em Integrações/Configurações (só admin), mostrando o último relatório.
4. Sem segredos/dados pessoais em logs. Testes não chamam o Google (mock do fetch/driveFetch). Respeitar Codex/outros arquivos não relacionados.
5. Nada de exclusão permanente; nada de mexer em pastas sem etiqueta do sistema.

## Testes mínimos
- Funções puras de caminho/nome para cada tipo novo (mesmos nomes nos dois repos).
- Exclusão de lead/obra/estudo/imóvel/usuário chama a lixeira da pasta certa (mock).
- Sincronizador: envia pendentes, ignora já enviados, identifica órfãos (registro inexistente) e NÃO trata lead arquivado como órfão; respeita limite de lote.
- Upload de documento do engenheiro grava no Drive em Equipe/<Nome (nº id)>/<categoria>.
