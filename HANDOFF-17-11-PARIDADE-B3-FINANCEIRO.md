# Handoff — Paridade 17/11, bloco 3 (financeiro) com a Prospecta

Pedido (autorizado pelo dono em 17/11): portar para o Grupo Santa Fé, com a MESMA regra de negócio, o "Bloco 3":
(1) Conta Azul — reimportação segura; (2) Gerador de PCI; (3) painel Anthropic em Integrações; (4) BPO — as duas
diferenças que ficaram de 13/11. Branch `claude/paridade17-b3-financeiro` (worktree `/home/user/sf-b3-financeiro`,
a partir de `origin/main` 98f9778). Sem merge, sem PR, sem deploy, sem banco real, nenhum dado apagado.

## Migração (NÃO aplicada em banco real)
`web/prisma/migrations/20261117300000_paridade_b3_financeiro/migration.sql` — só aditiva e idempotente
(CREATE TABLE/INDEX IF NOT EXISTS; RLS ligado + REVOKE de anon/authenticated, como `bpo_centros_custo`).
Aplicar no Supabase ANTES do deploy do código. Conteúdo por item está comentado no arquivo.
Schema Prisma: blocos `// ── Paridade 17/11 bloco 3 ──`. `prisma migrate diff` (banco com a migração × schema) = vazio.

## Item 1 — Conta Azul: reimportação segura (Prospecta EPIC-024 S-01, `794feca`) — concluído
- `web/src/lib/financeiro/conta-azul.ts`: `PREFIXO_CHAVE_CONTA_AZUL`, `CONFIRMACAO_LIBERAR_REIMPORTACAO` ("LIBERAR").
- `web/src/lib/bpo-conta-azul.ts`: a prévia separa "já importados (ativos)" de `arquivados` (bloqueando, liberáveis,
  com vínculo, de outra origem, exemplos com o motivo); a importação devolve `lancamentosArquivadosBloqueando`;
  `liberarReimportacaoContaAzul` (transação, travas `bpo_exclusao_lote` → `bpo_importar_conta_azul`, `FOR UPDATE`,
  cópia em `bpo_lancamentos_expurgo` com lote/usuário, histórico por lançamento, DELETE revalidando todos os vínculos:
  movimentação bancária, Asaas, baixa, obra, regularização, combinação nos dois sentidos; divergência = nada apagado).
  Só alcança os arquivados que seguram as chaves DO BACKUP enviado; ativos e outras origens nunca.
- `web/src/lib/actions/bpo-paridade.ts`: `liberarReimportacaoContaAzulAcao` — `exigirAdminAtivo` (perfil admin ativo)
  + módulo BPO; confirmação conferida no servidor.
- `web/src/lib/bpo-restauracao.ts` + `web/src/lib/actions/bpo-lote.ts`: restaurar não duplica — chave do Conta Azul em
  uso por outro lançamento → "já existe" (aviso diferente se o outro está arquivado); limpeza de ajustes cujo lançamento
  foi expurgado → aviso próprio; apagado fora do sistema → "não existe mais (foi apagado em definitivo)"; sem a tabela
  (antes da migração) confere com `to_regclass` e não aborta a transação.
- Tela `web/src/app/admin/bpo/_components/importar-conta-azul.tsx`: cartão "Já importados (ativos)", aviso dos
  arquivados que bloqueiam, botão "Liberar reimportação" com digitação de LIBERAR, prévia refeita depois.
- Diferença de permissão que já existia (mantida): no Santa Fé prévia e importação já exigiam o perfil admin; na
  Prospecta só o módulo BPO. Liberar exige admin nos dois.
- Sem FK de `expurgadoPorUsuarioId` para `usuarios` (padrão dos backups do BPO no Santa Fé; na Prospecta há FK SET NULL).

## Item 2 — Gerador de PCI (Prospecta EPIC-024 S-09, `95f60bf`) — concluído
- `web/src/lib/pci-gerador.ts`: substituído pelo gêmeo novo da Prospecta (`shared/pci-gerador.ts` de 95f60bf; diferença
  só de imports) — `copiavel`/`CAMPOS_COPIAVEIS_MODELO_PCI`, procedência por campo de pessoa, blocos de pessoa
  (`PESSOAS_PCI`, `mesmaPessoaPci`, `provaMesmaPessoaPci`), `sugestoesAutomaticasPci`, `compararPreenchimentoPci`,
  `aplicarEscolhasPci`, `misturaPessoaPci` (em `errosPci` ao gerar), `conferirProcedenciaPci`, `registrarConfirmacoesPci`,
  modelos (`extrairModeloPreenchimentoPci`, `dadosPessoaisNoModeloPci`, `avisosEmpresaNoModeloPci`…).
  Adaptações de stack (ids texto/cuid no Santa Fé): `ConfirmacaoPessoaPci.por` e `OrigemModeloPci.id` são texto;
  a origem conferível aceita `engenheiro:<cuid>` (na Prospecta `engenheiro:<número>`).
- `web/src/lib/engenheiros.ts`: `dadosEngenheiroParaPci` (UM engenheiro, com CPF; mesmas regras da lista).
  A lista de engenheiros continua sem CPF.
- `web/src/lib/obras/pci-gerador-dados.ts`: `engenheiroDaPci` (só quem a lista oferece; log
  `pci.cpf_engenheiro_lido` só com ids), engenheiro da obra (formulário → rascunho → última PCI gerada → projeto não
  cancelado do MESMO serviço do CRM, `Projeto.servicoLeadId`), `fontesAutomaticasPci` com motivos (PCI ilegível deixa
  de ser engolida), abertura sem rascunho com o relatório (`preenchimento`), conferência da procedência e registro das
  confirmações no servidor (salvar e gerar), CRUD/versões dos modelos (recusa de dado pessoal, nome único também na
  versão, autor original ou admin exclui, obra de origem só para o admin).
- `web/src/lib/actions/pci-gerador.ts`: `engenheiroPciAcao`, `sugestoesAutomaticasPciAcao`, `listar/obter/historico/
  salvar/excluirModeloPreenchimentoPciAcao` — mesmo acesso do gerador (admin ou colaborador com Obras).
- Tela `web/src/components/obras/gerador-pci.tsx`: seletor com busca do perfil e confirmação, "Mesmo profissional do
  RTP", painel do resultado (pessoa inteira por rádio; campos técnicos por caixa), aviso de mistura com "Confirmo que
  nome e CPF são da mesma pessoa" e Gerar bloqueado, painel "Modelos de preenchimento", "Começar em branco".
- Tabela `pci_modelos_preenchimento` (na mesma migração 20261117300000): versões por `anteriorId` (único), `substituido`,
  índice único parcial `lower(nome)` das versões atuais não excluídas, RLS + REVOKE. Sem FK para obras/usuarios.
- Diferenças que ficaram (de propósito):
  - sem lead do CRM, o proponente continua vindo do nome/telefone do cadastro da obra (regra anterior do Santa Fé),
    rotulado "Cadastro da obra (cliente sem lead do CRM)"; na Prospecta, sem lead não há cliente;
  - valor do imóvel: o Santa Fé usa o VGV da obra (como antes); a Prospecta cai no valor de simulação do lead quando a
    obra não tem VGV;
  - geração da planilha oficial (`web/src/lib/caixa/pci-gerador.ts`) não foi tocada.
- Expectativa antiga MUDADA (registrada no teste): `pci-gerador.test.ts` "a PCI vinculada tem prioridade" — antes o
  proponente vinha da PCI mesmo com o CRM apontando outra pessoa; agora fica vazio para a escolha da pessoa inteira
  (mesma mudança feita na Prospecta).

## Item 3 — Painel Anthropic em Integrações (Prospecta S-10 `794feca` + S-11 `6862f03`) — concluído
- `web/src/lib/ia/anthropic-painel.ts` (gêmeo de `server/_core/anthropic-painel.ts`): chave validada na Anthropic
  (`models.list`, sem tokens) antes de salvar, criptografada em `configuracoes["segredo.anthropic_painel_api_key"]`
  (`@/lib/segredo`, grupo "integracoes"), só os 4 últimos voltam à tela, erro mascarado (`sk-ant-…`), chave ilegível
  avisada, `plain:` recriptografado, troca de chave revalida o preferencial e o modelo de cada função; modelo
  preferencial; modelo por função (validar/gravar sem deixar pela metade; modelo que sumiu da conta é limpo com aviso).
  `configuracaoAnthropicPainel`/`existeChaveAnthropicPainel` da Prospecta NÃO foram portados: no Santa Fé nenhuma função
  lê a chave do painel (Dolores e Maquete não existem aqui).
- `web/src/lib/ia/funcoes-anthropic.ts`: as linhas do Santa Fé — `central_vendas_agente` (agente da Central de Vendas)
  e `incorporacao_mercado` (pesquisa de anúncios do Mercado, quando o provedor é a Anthropic). Sem Dolores/Maquete.
- `web/src/lib/ia/modelo-por-funcao.ts`: só nomes de modelo; ordem: variável de ambiente da função (Mercado:
  `INCORPORACAO_IA_MODELO`, prioridade como antes) → modelo da função → modelo configurado na própria função (Central:
  "Modelo da IA" das configurações dela) → preferencial do painel → padrão. Nunca lança.
- Ligações: `web/src/lib/central-vendas/ia.ts` (só o `model` muda; a chave continua a da Central ou
  `ANTHROPIC_API_KEY`) e `web/src/lib/incorporacao/mercado-anuncios.ts` (`modeloMercadoAnuncios`; a chave continua
  `ANTHROPIC_API_KEY`). Escolher modelo nunca liga a IA (as chaves, os interruptores da Central e
  `INCORPORACAO_IA_ATIVA` continuam como estavam).
- Ações (só admin ativo): `statusAnthropicAcao`, `testarAnthropicAcao`, `salvarAnthropicAcao`, `removerAnthropicAcao`,
  `modelosAnthropicAcao`, `salvarModeloAnthropicAcao`, `modelosPorFuncaoAnthropicAcao`, `salvarModeloFuncaoAnthropicAcao`
  em `web/src/lib/actions/integracoes.ts`. Tela: `web/src/app/admin/integracoes/_components/anthropic-card.tsx`
  (incluída em `page.tsx`, abaixo do Mapbox): "Valendo agora" com a origem, e aviso quando a função está sem a chave dela.
- Sem migração (usa a tabela `configuracoes`).
- [AUTO-DECISION] "a variável de ambiente continua tendo prioridade" → aplicada ao modelo do Mercado
  (`INCORPORACAO_IA_MODELO`) e às chaves (nenhuma função passa a usar a chave do painel). Na Central não existe variável
  de modelo; o "Modelo da IA" dela vale como o "modelo anterior" (mesmo papel do campo antigo do cartão da Dolores).
- Diferença com a Prospecta: lá a chave do painel é usada por Maquete e Dolores; aqui por nenhuma função. Lá Central e
  Mercado não têm linha no painel (comentário em `shared/funcoes-anthropic.ts`); aqui têm, por pedido de 17/11.

## Item 4 — BPO: as duas diferenças de 13/11 — concluído
- (a) Crédito do Asaas sem id de pagamento (Prospecta `server/bpo-asaas.ts`, passo 3, e `creditoDaCobranca`):
  - `web/src/lib/financeiro/bpo-asaas.ts` (novo, regra pura gêmea): cobrança PAGA ↔ crédito de mesmo valor (bruto ou
    líquido, em centavos) e data até 3 dias do pagamento; o mais próximo vence; em aberto nunca liga.
  - `web/src/lib/bancos/cobrancas-asaas.ts`: candidatos = créditos de conta `provedor = asaas` sem `asaasPaymentId`,
    com lançamento ativo sem cobrança (não arquivado, não combinado) ou parados em "A classificar" sem lançamento (fora
    os usados em divisão de pagamento). Com lançamento → ele vira a cobrança (mesmo caminho do crédito com id); sem
    lançamento → o lançamento nasce ligado ao crédito, com o valor e a data do dinheiro que entrou. O extrato ganha o id
    do pagamento (a próxima sincronização acha pelo id; não duplica). Ordem igual à da Prospecta: pelo id → por
    valor/data → Conta Azul → nova.
  - Junto (Prospecta: `if (credito) continue`): crédito com o id da cobrança SEM lançamento e fora de "A classificar"
    (transferência interna, ou já usado numa divisão de pagamentos) não vira receita. Antes o Santa Fé criaria um
    lançamento novo ligado a ele (o que, para crédito já dividido, contaria o dinheiro duas vezes).
- (b) Transferência interna não gera lançamento (Prospecta `lancamentoDaMovimentacao` → null):
  - `web/src/lib/bancos/lancamentos-bpo.ts`: em todos os modos (nova, classificada, reprocessar) a movimentação de
    transferência fica só com a categoria, fora de "A classificar"; o lote nem pega movimentação já categorizada como
    transferência (e o laço conta a categorização como progresso, para não parar antes).
  - Dados existentes: NADA é alterado. Os lançamentos "Transferência interna" já gravados ficam como estão (continuam
    fora de listas, DRE e totais pelo filtro de categoria, que não mudou). Movimentação que já tem lançamento não é
    reprocessada. Marcar no painel Bancos uma movimentação que JÁ tem lançamento como transferência continua só trocando
    a categoria do lançamento (fica oculto) — na Prospecta ele é apagado; aqui não, para não apagar dado.
  - Números: DRE, Cobranças/Despesas, painel de valores, resumo por cliente e Contabilidade já excluíam a categoria;
    portanto não mudam. Achado (não alterado, fora do pedido): o detalhe do cliente BPO (`/admin/bpo/[id]`, "total
    pago") e as listas "BPO disponíveis" de obra/regularização e de vínculo de cliente não filtravam a categoria; com a
    regra nova, transferências NOVAS deixam de aparecer ali (as antigas continuam aparecendo como antes).
  - Para conferir os dados reais antes do deploy (só leitura; o lead roda no Supabase):
    `SELECT count(*), sum(valor) FROM bpo_lancamentos WHERE categoria = 'Transferência interna';` (fica igual depois);
    `SELECT count(*) FROM transacoes_bancarias t LEFT JOIN bpo_lancamentos l ON l."transacaoId" = t.id WHERE t.categoria = 'Transferência interna' AND l.id IS NULL;`
    (hoje deve ser 0; depois só crescem as novas);
    `SELECT count(*) FROM bpo_lancamentos WHERE categoria = 'Transferência interna' AND "clienteId" IS NOT NULL;` (as que aparecem no detalhe do cliente).

## Testes — rodada final (branch inteira, 17/11)
- (a) automáticos:
  - `npx tsc --noEmit -p .` ✅. ESLint em todos os .ts/.tsx alterados na branch: 0 erros, 1 aviso (`_descartadas` em
    `web/src/lib/pci-gerador.ts`, idêntico ao gêmeo da Prospecta).
  - `npx vitest run --maxWorkers=3` (sem banco): 186 arquivos ✅ / 30 pulados; 1.460 testes ✅ / 205 pulados; 0 falhas.
  - Com banco (`*.db.test.ts`, Postgres 16 local com `prisma db push` + migrações 20261113100000 e 20261117300000,
    `--no-file-parallelism`): 259 ✅ / 9 ❌ / 29 pulados — as mesmas 9 já registradas como falhas da `main` neste
    ambiente em `HANDOFF-13-11-PARIDADE-BPO.md` (bancos-sync Asaas, avisos Pluggy, exclusão definitiva ×4, projeto-
    engenheiro ×3) + os arquivos de Drive/medições que não carregam sem as migrações de gatilho. `bancos-sync` Asaas
    conferido: falha igual com o `cobrancas-asaas.ts` da `main`. Em paralelo (sem `--no-file-parallelism`) os testes
    que rodam o reprocessamento global se atropelam no mesmo banco — rodar em série.
  - Sob carga (outras frentes na mesma máquina), testes PGlite da Central de Vendas estouram o limite de 5 s; com
    `--testTimeout=60000` passam (11 arquivos / 115).
  - `npx next build`: ✓ Compiled, TypeScript ok; parou na geração estática de "/" por falta de banco
    (DatabaseNotReachable) — esperado.
- (b) manuais: nenhum nesta sessão (sem navegador). Telas novas/alteradas a conferir: Importar backup Conta Azul
  (aviso de arquivados + LIBERAR), Gerador de PCI (seletor, painel de resultado, modelos), Integrações › Anthropic.
- (c) produção: aplicar a migração; Conta Azul com o ZIP real; Gerador de PCI numa obra com engenheiro; cadastrar a
  chave da Anthropic e escolher o modelo de cada função; sincronizar o Asaas e conferir créditos sem id; conferir que
  uma transferência nova não cria lançamento e que os números do DRE/totais não mudaram (SQL do item 4).

## Testes por item
- (a) automáticos (item 4): `bpo-paridade.db.test.ts` +3 (crédito sem id: líquido, crédito antigo com lançamento,
  5 dias não liga, em aberto não liga, reexecução sem duplicar; crédito-transferência não vira receita; transferência
  nova/reprocessar/painel Bancos sem lançamento, volta de categoria cria, lançamento antigo intacto, DRE igual) e
  `bpo-paridade-regras.test.ts` +1 (`creditoDaCobranca`). Expectativas antigas MUDADAS (registradas nos testes):
  `bpo-extrato.db.test.ts` "importação gera 1 lançamento…" (lançamentos criados 1 → 0; 4 → 3 lançamentos; a
  transferência fica sem lançamento) e `bpo-paridade.db.test.ts` (movimentação de transferência e "ignorar" agora sem
  lançamento; antes com lançamento "Transferência interna").
- (a) automáticos (item 3): `web/src/lib/__tests__/integracoes-anthropic.test.ts` (24, sem rede: SDK simulado) —
  chave protegida (criptografada, nunca devolvida, recusada não salva, formato inválido não chega à API, troca/remoção,
  sem chave não chama, revogada mascarada, ilegível, `plain:`), modelos e preferência, revalidação ao trocar a chave,
  modelo sumido, gravação sem deixar pela metade, função desconhecida recusada, resolução do modelo (ordem, banco fora do
  ar, nunca lê a chave), "valendo"/"sem chave", só admin (colaborador/corretor/cliente recusados sem chamar a API),
  salvar não muda `ANTHROPIC_API_KEY`/`MERCADO_ENV`, a GUARDA (varre `web/src`: ninguém além do painel cita a chave;
  módulo de modelos com imports exatos; Central e Mercado só importam `modeloDaFuncao`; Central/Mercado continuam
  com as chaves deles) — conferida também no negativo (marca colocada em `central-vendas/ia.ts` → falha) —, e a ligação
  do Mercado com `INCORPORACAO_IA_MODELO` na frente. Central de Vendas + Mercado: 11 arquivos / 115 ✅.
- (a) automáticos (item 2):
  - `pci-s09.test.ts` (21, porte das regras puras da Prospecta, ids texto) e `pci-s09.db.test.ts` (18, Postgres real):
    lista sem CPF; CPF do escolhido com log só de ids; recusa de inativo/cliente/corretor/id inexistente; perfil
    desativado/ausente; abertura com RTP do projeto do mesmo serviço; projeto cancelado ignorado; escolha da pessoa
    inteira; gerar recusa mistura; procedência forjada rebaixada; confirmação gravada com autor/hora sem repetir;
    PCI ilegível vira motivo; modelos (só técnico, recusa de dado pessoal com trecho mascarado, CNPJ com aviso,
    aplicar em outra obra, versões, corrida no índice único, exclusão só admin/autor original); permissões.
  - Suítes PCI + engenheiro + migração: 10 arquivos, 107 testes ✅.
- (a) automáticos (item 1):
  - `web/src/lib/__tests__/bpo-paridade.db.test.ts`: +8 cenários (Postgres 16 local com o schema + migrações
    20261113100000 e 20261117300000): arquivados à parte na prévia/importação; liberar só os sem vínculo, com cópia e
    histórico, legado intacto, confirmação errada recusada, segunda vez nada; reimportar depois de liberar (4 uma vez,
    transferência fora, centro de custo sem dobrar, A classificar preservado, clientes reaproveitados) e restaurar a
    limpeza antiga sem duplicar; exclusão JSON antiga pula a linha reimportada (ativa e arquivada); não-admin barrado;
    outra origem nunca removida; combinada/baixa mantidas; apagados fora do sistema. 28/28 no arquivo.
    O mock de `@/lib/auth/modulos` virou `vi.fn` (mesmo comportamento) para simular o não-admin.
  - `bpo-restauracao.test.ts` +1 (regra pura); `paridade-b3-migracao.test.ts` (PGlite: duas vezes, RLS, REVOKE, sem DML).
  - Junto: `bpo-restaurar-exclusao`, `bpo-limpeza-ajustes`, `bpo-lote3` (db) passam — 43/43. `tsc` ok; ESLint 0.
- (b) manuais: nenhum ainda.
- (c) produção: aplicar a migração; enviar o ZIP real; conferir o aviso dos arquivados e, se houver, LIBERAR.

## Próximo passo exato
Revisão do lead → aplicar a migração 20261117300000 no Supabase (antes do deploy) → PR/merge/deploy (lead) → validar (c).
