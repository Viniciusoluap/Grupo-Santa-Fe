# HANDOFF 19/11 — 3 correções da revisão automática do PR #263 (Santa Fé) + paridade na Prospecta

Branch: `claude/paridade17-correcoes-revisao` (nos dois repositórios). Sem merge, sem PR, sem deploy, sem migração.
O mesmo arquivo existe na raiz da Prospecta, com a parte de lá.

## Concluído

Os três defeitos foram confirmados no código antes da correção, nos dois sistemas (o código do PR #263 veio da Prospecta).

1. **Viabilidade sem premissas gravadas não salvava**
   - Causa: `useSalvamento` tratava o JSON inicial (padrões do formulário) como já gravado; `salvarFila` só grava quando
     `atual !== gravado`. Botão mostrava "Premissas salvas" e não gravava nada.
   - `web/src/lib/incorporacao/fila-salvamento.ts`: campo opcional `registrado` (ausente = como antes) e parâmetro
     `forcar`; com `registrado === false` e `forcar`, grava mesmo sem alteração (o JSON inicial vale como "anterior",
     então nenhum `JSON.parse` recebe `null`).
   - `web/src/app/admin/incorporacao/_components/salvamento.ts`: opção `{ semRegistro: true }`; `salvo` fica falso até a
     primeira gravação; `salvar` (botão) força; o salvamento automático e a gravação ao desmontar usam a versão sem forçar
     (abrir a aba não grava). Sem a opção, nada muda para os outros usos.
   - `viabilidade-tab.tsx`: passa `{ semRegistro: !salvo }` (sem `loteamentoJson` válido) e mostra "Premissas ainda não
     gravadas — clique em Salvar premissas para registrá-las." no lugar de "Salvando alterações automaticamente…".
2. **Proposta do terreno: o e-mail podia anexar um PDF diferente da prévia**
   - `web/src/lib/incorporacao/proposta-terreno.ts`: `conferirPdfDaPrevia` + `ERRO_PROPOSTA_MUDOU`. A confirmação recebe o
     `pdfSha256` da prévia; o servidor gera de novo e recusa se o hash for outro (ou ausente/malformado) com
     "A proposta mudou desde a prévia; gere a prévia de novo." Nada é enviado nem registrado (o código já não registra
     envio nas outras validações de entrada, então não foi criado registro "falhou").
   - `web/src/lib/actions/proposta-terreno.ts`: `enviarPropostaTerreno(..., dataEmissao, pdfSha256)`.
   - `proposta-terreno-envio.tsx`: manda `previa.pdf.sha256`; nesse erro, o botão vira "Gerar a prévia de novo".
3. **Mapa operacional: marcadores de agrupamento velhos depois de filtrar/buscar**
   - `web/src/lib/mapa-alfinetes.ts`: `chaveDoMarcador(propriedades, geracao)` — a chave leva a geração dos dados.
   - `web/src/components/map/property-map.tsx`: a cada `setData` a geração sobe e o cache de marcadores é limpo
     (`limparMarcadores`), então posição, contagem e clique antigos nunca são reaproveitados.

Testes novos/ajustados (nenhum apagado nem pulado):
- `web/src/lib/__tests__/incorporacao-autosalvamento.test.ts` (+6 casos: sem registro, forçar, falha, padrão inalterado).
- `web/src/lib/__tests__/incorporacao-proposta-terreno.test.ts` (+1 caso: negociação muda depois da prévia; chamadas
  existentes passam o hash).
- `web/src/lib/__tests__/mapa-operacional-maplibre.test.ts` (+2 casos: chave por geração; limpeza antes do `setData`).

## Testes

(a) Automáticos (rodados nesta sessão, em `web/`):
- `npx tsc --noEmit -p .` → sem erros.
- `npx eslint` nos 11 arquivos alterados → 1 erro e 1 aviso, ambos **pré-existentes e idênticos no HEAD**
  (`viabilidade-tab.tsx`: `react-hooks/preserve-manual-memoization` na linha do `useMemo` de `montarViabilidade` e `step`
  sem uso). Conferido rodando o eslint na versão do HEAD. Nada novo.
- `npx vitest run --maxWorkers=3` → 205 arquivos passaram, 30 pulados (já pulados antes); 1690 testes passaram, 205 pulados.

(b) Manuais: nenhum (sem navegador nesta sessão).

(c) Pendente de validação em produção (depois do merge autorizado):
- Abrir a Viabilidade de um estudo sem premissas: aparece "Premissas ainda não gravadas"; clicar Salvar grava e o
  Relatório deixa de pedir para salvar; abrir a aba sem clicar não grava.
- Proposta: abrir a prévia, alterar o valor em outra aba e salvar, confirmar envio → recusa com a mensagem; "Gerar a
  prévia de novo" → envio funciona.
- Mapa operacional: filtrar/buscar e conferir que os números dos grupos e o clique correspondem ao conjunto novo.

## Próximo passo

Revisão do PR desta branch pelo dono/QA e merge na `main` só com autorização. Nenhuma migração foi criada.
