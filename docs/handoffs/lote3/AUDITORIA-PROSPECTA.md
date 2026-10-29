# Auditoria L0 — Prospecta (main 597697c, 29/10/2026)

## Auditoria somente leitura: Prospecta-lote3 (main 597697c, merge do PR #175)

Não alterei nada no repositório. As linhas citadas são aproximadas.

Três achados merecem atenção primeiro:
- **04 – o contador "Mensagens Enviadas" para em 100.** A consulta `historico` tem `.limit(100)` e a tela usa o tamanho dessa lista como total.
- **03 – a lista de destinatários traz leads excluídos.** A consulta `leadsParaEnvio` não filtra `deleted_at`. Isso explica o caso do André Renan.
- **13A – Pluggy "property pageSize should not exist".** O código envia `pageSize=500` para `/v2/transactions`, endpoint que não aceita esse parâmetro.

---

### 01 – WhatsApp › Conversas: exclusão em lote
1. Tela: `client/src/components/whatsapp/ConversasWhatsApp.tsx` (lista nas linhas 104–131; exclusão individual nas 91–101, com `window.confirm`). Servidor: `server/whatsapp-router.ts` → `conversas` (l.393), `excluirConversa` (l.447). Tabelas `whatsapp_messages` e `whatsapp_midias` (esta com ON DELETE CASCADE).
2. **Parcial.** Existe só a lixeira por conversa. Não há checkbox, seleção múltipla, contador nem rota de exclusão em lote. A exclusão apaga fisicamente as mensagens daquela conexão. No celular nada é apagado (a integração não suporta).
3. Não é bug; é funcionalidade que falta.
4. Riscos:
   - A exclusão é física e não tem auditoria.
   - O número é comparado pelos 8 últimos dígitos (`mesmoTelefone`), então pode haver colisão.
   - O corretor precisa passar pela regra `exigirLeadDoCorretor` em cada número.
   - As consultas carregam até 2000/3000 mensagens e agrupam em memória.

### 02 – Botão "Vincular lead"
1. Tela: `ConversasWhatsApp.tsx` l.144–147 (só aparece "Criar lead" quando `!atual.leadId`). Servidor: `criarLeadDaConversa` (whatsapp-router l.473). Campo `whatsapp_messages.lead_id`. Componente que pode ser reaproveitado: `client/src/components/admin/LeadPicker.tsx` (busca local por nome e telefone).
2. **Não existe.** O vínculo hoje é inferido pelo telefone (`conversas` l.406–411 usa `contatos.find(mesmoTelefone)`, que pega o primeiro lead encontrado). `criarLeadDaConversa` cria lead novo sem verificar duplicidade.
3. —
4. Riscos:
   - O vínculo inferido sobrescreve o `leadId` gravado (`g.leadId = lead?.id ?? g.leadId`), então um vínculo manual precisa ter prioridade sobre a inferência.
   - Hoje não existe busca de lead por CPF.

### 03 – Destinatários de "Enviar Mensagem"
1. Servidor: `whatsapp-router.ts` l.266 `leadsParaEnvio`. Tela: `client/src/pages/admin/AdminWhatsApp.tsx` l.43 (consulta), l.193–206 (lista e "Selecionar todos (leads.length)"), l.124/132 (contagem).
2. **Com bug.** A consulta é `select … from(leads)` **sem `isNull(leads.deletedAt)`**. Leads excluídos (soft delete) aparecem na lista. O `enviar` (l.345–346) filtra `deletedAt` e por isso descarta os excluídos na hora do envio, mas eles continuam aparecendo e entram na contagem.
3. **Causa:** falta o filtro `deleted_at IS NULL` em `leadsParaEnvio`. Também não há `refetchOnMount`/invalidação quando um lead é excluído no CRM. "Selecionar todos" usa a lista inteira, e não a filtrada pela busca.
4. Riscos:
   - Não existe campo "inativo" no lead (só `deletedAt` e o estágio `finalized`); a regra de elegibilidade precisa ser definida.
   - Seleções já feitas podem conter IDs de leads excluídos no meio do processo.

### 04 – Dashboard: "Mensagens Enviadas" travado em 100
1. Servidor: `whatsapp-router.ts` l.271–279 `historico`. Tela: `AdminWhatsApp.tsx` l.66–69 e l.133.
2. **Com bug.**
3. **Causa:** `historico` tem `.orderBy(desc(createdAt)).limit(100)` (l.274 e l.278) e a tela calcula `totalEnviadas = historico.data?.length`. Além disso, conta todas as mensagens de saída, inclusive `status="falhou"`. Não há período definido.
4. Riscos:
   - É preciso criar uma contagem própria (`count` com filtro de status `enviada/entregue/lida` e período) e não reaproveitar o histórico.
   - A taxa de leitura e as falhas também estão calculadas sobre só 100 mensagens.

### 05 – Tirar "Galeria de Fotos" do Gerador de PCI
1. `client/src/pages/AdminEditarObra.tsx` l.500–504: aba `fotos` renderiza `<GeradorPciAba/>` e `<FotosObraAba/>`. Arquivos: `client/src/components/obra/FotosObraAba.tsx` (título "Galeria de Fotos", l.10) e `GaleriaMedicoes.tsx`. Detalhes da obra: `client/src/pages/ObraDetalhes.tsx` l.218–248 (essa galeria fica).
2. **Existe.** A galeria aparece embaixo do gerador.
3. —
4. **Risco:** para o empreiteiro, a mesma aba `fotos` vira "Fotos" (l.271) e mostra só `FotosObraAba`. Remover a galeria sem condição tira as fotos do empreiteiro. A remoção deve valer só quando `!ehEmpreiteiro`.

### 06 – Cronograma físico-financeiro (acumulados)
1. Entrada na tela: `GeradorPciAba.tsx` l.209–222 (`NumeroInput` com `max={100}` e `sufixo="%"`, sem `pontoDecimal`). Regras em `shared/pci-gerador.ts`:
   - `numeroPci` (l.244)
   - `normalizarFormularioPci` (l.299–312: apenas `slice` + `numeroPci`)
   - `pendenciasPci` (l.501–510: só avisa se a última etapa for diferente de 100)
   - `calcularTotaisPci` (l.481–494; o `acumulado` dali é das incidências de custo, não do cronograma)

   Gravação: `server/caixa/pci-gerador.ts` `celulasDoFormulario` l.131–134 grava `AI166..AI189` (etapas 1–24; a etapa 0 é fórmula). Leitura: l.166–167 (prazo em T161). No PDF, l.517–518 lista só o acumulado.
2. **Parcial.** Os valores são tratados como "% acumulado" por etapa. Não há validação de 0–100, de valores não decrescentes, nem cálculo do incremental. Não existe soma de acumulados no gerador (o `acumulado` somado é o das incidências).
3. **Causa provável do "101.000":** `NumeroInput` sem `pontoDecimal` agrupa milhar enquanto a pessoa digita. Quem digita "10100" vê "10.100", e quem tenta "100.00" tem o ponto do meio ignorado. O `max` só limita ao **sair do campo** (`numero-input.tsx` l.162–163); durante a digitação o `onChange` entrega 101000.
   - Além disso, `numeroPci("101.000")` (sem vírgula) devolve 101, porque trata ponto como decimal. Isso é inconsistente com `lerNumero` da máscara.
   - O servidor não valida nada (`formularioInput` só normaliza).
4. Riscos:
   - A unidade gravada em AI166 (percentual 0–100 ou fração 0–1) precisa ser confirmada no modelo oficial. Os arquivos oficiais "PCI MYLCA" **não estão no repositório**; só existe `server/caixa/__fixtures__/pci-modelo-anonimo.xls`.
   - `lerPci` (pci.ts l.241–246) lê `AI165+k` (inclui a etapa 0) e alimenta a PLS.

### 07 – Listas e fórmulas do Excel oficial
1. `shared/pci-gerador.ts` l.74–178 `CAMPOS_PCI`, com tipos `texto|numero|inteiro|data|documento|registro|cep|telefone|coordenada`. Já existe um mapa de células completo da aba `Proposta_Constr_Individual`:
   - proponente/RTP/RTE: G44..AS50
   - imóvel: G54..AV56
   - matrícula: G58..AQ58
   - documentação: Q64..AR67
   - áreas: G73..AK74
   - memorial: M96..AC107
   - sistema: S75..AS93
   - instalações: V106..G112
   - BDI: X141
   - prazo: T161
   - local/data: H258
   - custos: AB120..AB138 (AB139 é fórmula)
   - adicionais: I/Z149..158
   - cronograma: AI166..
   - quadro de imagem: F193..AV213

   Caches gravados: X120.., AI120.., AB140–142, Z159, AC73. Leitor BIFF8: `server/caixa/biff8.ts`.
2. **Não existe a parte das listas.** Todos os campos do memorial, sistema, instalações, destinação e documentação são **texto livre** (`c(..., "texto")`). Não há tipo "lista" nem campo `opcoes` em `CampoPci`. `biff8.ts` não lê registros de validação de dados (DVAL/DV); só lê e escreve células, fórmulas e cache. Não há documento de mapeamento aba/célula/lista.
3. —
4. Riscos:
   - É preciso extrair as listas do arquivo oficial (validações e faixas nomeadas em abas auxiliares), sem inventar opções.
   - O BIFF8 próprio precisaria parsear DV e NAME, ou a extração seria feita offline.
   - O gêmeo no Santa Fé (`web/src/lib/caixa/pci-gerador.ts`) precisa de paridade.

### 08 – PLS: curva sem status, acumulados e aferido ausentes, vigência vazia
1. Arquivos:
   - `server/routes/obra-medicao-caixa.ts` `gerarArquivoMedicao` l.196–239: hoje **gera só PDF** (comentário: "Lote 02, correção 01: sem .xls").
   - `server/caixa/medicao-pdf.ts` `gerarPls` l.277+ e `situacao()` l.271.
   - `server/caixa/medicao-xls.ts`: `calcularPls` l.149, `curvaDeEvolucao` l.186, `preencherPls` l.203–251 (AF/AJ/AO/AT 95+etapa, AL78–80 e AS87). Não é usado no download atual.
   - `server/caixa/pci.ts` `lerPci` l.200–289: curvas lenta/normal/rápida em `PLS!BG/BH/BI95..`, cronograma em `AD/AI165..`, contrato e datas em `PLS!S51/AQ77/AL78/AV78/AI87/AS87`.
   - Tabelas `construction_progress_history` (`caixa_data`, `pci_version_id`), `construction_pci(_versions)` e `construction_projects.start_date/estimated_end_date`.
2. **Parcial, com falhas.**
3. Causas:
   - **Sem status:** `situacao()` depende de `pci.curvaLenta/Rapida`, lidas dos **valores em cache** das fórmulas BG/BH/BI da aba PLS. Se a PCI foi gerada pelo nosso gerador ou salva sem recálculo, o cache fica vazio, os arrays ficam vazios e o status sai `""`. O mesmo vale para `cronogramaProposto`.
   - **Aferido ausente:** está explícito em obra-medicao-caixa.ts l.216–218: "Acumul. Aferido … o sistema não o tem, então fica em branco. Aguarda decisão do dono". O campo `aferido` nunca é preenchido.
   - **Curva e vigência:** `curvaDeEvolucao` só roda quando `r.etapa !== null`. `etapa` exige `inicio`, que vem de `obra.startDate` ou de contratação + 30 dias (`inicioDaObra`). Sem data de contratação ou de início, tudo fica vazio. A vigência do alvará vem de `dados.pls.alvaraVigencia` ou de `PLS!AS87` da PCI.
   - Não existe leitura das abas Curvas_padrão, Calculos_Cronograma nem Regras (grep sem resultado).
4. Riscos:
   - Recalcular as fórmulas da CAIXA no servidor, porque não dá para confiar no cache.
   - Não inventar datas.
   - Preservar o histórico (cada medição usa a PCI da própria versão).

### 09 – Integrações: remover blocos do WhatsApp e excluir versão do modelo
1. Tela: `client/src/pages/admin/AdminIntegracoes.tsx` l.172–174 (`<ConexaoWhatsApp role="admin"/>` e `<SubPciAtual/>`). Os blocos ficam em `client/src/components/whatsapp/ConexaoWhatsApp.tsx`: "Minha Conexão WhatsApp" l.48 e "Conexões dos Corretores" l.88.
   - A Central já tem a aba "Minha conexão" (`AdminWhatsApp.tsx` l.155/167), então a remoção não perde a função.
   - Modelos: `client/src/components/admin/SubPciAtual.tsx` (lista e botões "Tornar atual" e baixar). Servidor: `server/pci-gerador.ts` `pciModelosRouter` l.194 (só `listar` e `definirAtual`).
   - Tabela `pci_models` (`drizzle/schema.ts` l.629; migração `drizzle/0087_pci_gerador.sql`).
2. **Não existe exclusão de versão.** `pci_models` não tem `deleted_at`. `pci_generated.model_id` é FK com ON DELETE SET NULL e guarda `model_version` como cópia.
3. —
4. Riscos:
   - Apagar fisicamente perde o arquivo original das PCIs já geradas (o `model_version` continua, mas sem o binário).
   - É melhor soft delete com auditoria.
   - Impedir a exclusão da versão `is_current` (há índice único parcial).
   - Hoje não existe log de quem fez a operação.

### 10 – Modelo oficial: saída obrigatória em XLS
1. `server/caixa/pci-gerador.ts`:
   - `gerarPlanilhaPci` l.411–415: `formato === "xls" ? gerarXls : gerarXlsm`; `xlsb` dá erro (`MENSAGEM_XLSB_SO_LEITURA`).
   - `gerarXls` (BIFF8 via `PastaBiff8`, preserva registros e grava cache).
   - `gerarXlsm` (edita o XML do zip com fflate, preserva macros e validações; a imagem não entra).
   - `validarModeloPci` l.194.
   - `lerFormularioPci` lê xls/xlsm/xlsb.

   Upload em partes: POST `/api/pci-modelos` (server/pci-gerador.ts l.~280–310). Detecção do formato: `shared/pci-gerador.ts` `formatoModeloPci` l.526. Formatos aceitos no banco: `pci_models.format IN ('xls','xlsm','xlsb')` e `pci_generated.sheet_format IN ('xls','xlsm')`.
2. **Parcial.** A **saída tem o mesmo formato do modelo** (xls gera xls; xlsm gera xlsm). Não existe conversão para XLS, comparação com a versão anterior, relatório de compatibilidade nem fluxo de aprovação. O vínculo da PCI gerada com a versão existe (`pci_generated.model_id/model_version`).
3. —
4. Riscos:
   - Gerar XLS real a partir de xlsm/xlsb exigiria escrever BIFF8 do zero, o que não é suportado. O caminho viável é exigir o modelo .xls como base de saída e bloquear com aviso nos outros formatos.
   - A restrição CHECK de `sheet_format` permite xlsm.

### 11 – Layout global e responsividade
1. Componentes compartilhados:
   - `client/src/components/ui/dialog.tsx` l.126: `max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[calc(100dvh-2rem)]`, mas **sem `overflow-y-auto` por padrão**.
   - `input.tsx` (`h-9 w-full min-w-0`), `select.tsx`, `popover.tsx` e `calendar.tsx` (react-day-picker, pouco usado; as datas são `<Input type="date|month">` nativos).
   - `numero-input.tsx`, `currency-input.tsx`, `percent-input.tsx` e `DashboardLayout.tsx`.
2. Sinais de overflow:
   - `AdminBpo.tsx`: l.249 (form cliente), l.418 (Novo lançamento) e l.920 (modal **Editar lançamento**) usam `grid grid-cols-2` **sem variação responsiva**. A lista de lançamentos usa `min-w-[200px]` (l.757). Os modais de BPO passam `max-h-[90vh] overflow-y-auto` manualmente.
   - `TaxAccountingPanel.tsx`: três modais (l.182, 295, 392) com o `DialogContent` padrão (512px) mais `sm:grid-cols-2` e `type="date"`. São candidatos a datas cortadas no iPad/Safari.
   - `BancosPanel.tsx` l.293: `grid-cols-2`.
   - `GeradorPciAba.tsx` l.200: `grid-cols-[1fr_160px]`; l.186: `min-w-[140px]`.
   - `FinanceiroObra.tsx` l.386: `grid-cols-[1fr_160px_1fr_auto]`.
   - `MedicaoCaixa.tsx` l.281/328: `grid-cols-2`; l.540: `min-w-[200px]`.
   - `AdminObraMedicoes.tsx` l.227/405, `AdminFinanceiro.tsx` l.102/247, `ProgressoObraAba.tsx` l.186 (`min-w-[120px]`), `AdminEditarObra.tsx` l.270.
   - Datas nativas por arquivo: AdminBpo 5, MedicaoCaixa 5, TaxAccounting 3, AdminEditarObra 3, AdminRelatorios 2 (De/Até, l.173–206, em `flex-wrap`).
3. Causa comum: grade fixa de 2 colunas em modais e `DialogContent` sem rolagem padrão.
4. Risco: mudar `dialog.tsx` afeta todos os modais; testar as classes passadas por quem usa.

### 12 – Lançamento BPO: categorias (novo e editar)
1. Arquivos:
   - Tela: `AdminBpo.tsx`. Novo: Tipo l.420, "Classificação contábil *" l.437–446, Categoria operacional l.452–455, Centro de Custos l.588–594. Editar: l.923 (categoria contábil), l.928 (centro de custos), l.932–934 (operacional).
   - Servidor: `server/bpo-router.ts` `lancamentoBpoSchema` l.160–176 (`categoria: z.enum(CATEGORIAS_MANUAIS)` **obrigatório**, `centroCustos` opcional, `categoriaOperacional` e `vinculoOperacionalId` obrigatórios no create) e `editar` l.297–318.
   - `server/bpo-auditoria.ts` l.108+ (`editarLancamentoAuditavel` grava `centro_custos`).
   - Colunas de `bpo_lancamentos`: `categoria` varchar(60), `centro_custos` varchar(100), `categoria_operacional` varchar(40), `vinculo_operacional_id`, `tipo_despesa_obra`, `etapa_obra`.
2. **Opções atuais:**
   - **Categoria operacional** (`shared/financeiro/bpo-operacional.ts` l.3–30):
     - Cobrança: obras, regularizacoes, comissoes, projetos, avaliacoes, imoveis, incorporacao, financiamentos.
     - Despesa: obras ("Obras"), tarefas_agenda ("Tarefas e Agenda"), regularizacoes, comissoes, incorporacao.
     - Tipo de despesa da obra: empreiteiro, terreno, comissao, fornecedor, outros, mao_de_obra, material.
   - **Classificação contábil** (`shared/financeiro/bpo-extrato.ts` l.8–20 `CATEGORIAS_BPO`): Recebimento de cliente, Financiamento/CAIXA, Material, Mão de obra, Projetos e taxas, Impostos, Tarifas bancárias, Pró-labore, Administrativo, Transferência interna (excluída do manual), Outros.
   - **Centro de custos:** texto livre, sem lista.
3. Onde cada campo é usado:
   - `categoria`:
     - DRE por competência e por categoria (`dreDosLancamentos` / `dreDasCategorias`, bpo-extrato.ts l.185–217, excluem Transferência interna).
     - `resumoPorCliente` l.167.
     - Categorização automática do extrato (REGRAS l.30–40, regra por titular, `server/bpo-extrato.ts`, `server/bancos.ts`).
     - Exibição na lista (AdminBpo l.765).
     - O DRE de Relatórios (`montarDreMensal`) **não** usa categoria.
   - `categoriaOperacional`: filtro da lista (AdminBpo l.194), link do registro vinculado (l.775), `catalogoVinculosOperacionais` e preservação na limpeza de conta (`bpo-auditoria.ts`, `vinculo_operacional_id`).
   - `centroCustos`: só é gravado e editado; **nenhum relatório nem DRE usa**.
4. Riscos:
   - Remover a classificação contábil da tela exige um mapeamento substituto da Categoria Operacional para `categoria`, porque o servidor exige o enum e o DRE e o extrato dependem dela.
   - `validarDetalhesOperacionais` (l.43–58) **exige `vinculoOperacionalId`** para qualquer categoria. As novas categorias (Impostos, Tarifas, Pró-labore, Administrativo, Outros, Projetos e taxas) não têm catálogo de vínculo e precisam de um caminho sem vínculo.
   - Os lançamentos que vêm do extrato têm `categoria` e não têm categoria operacional.

### 13 – BPO › Bancos
**A) Erro da Pluggy**
1. `server/_core/pluggy.ts` `fetchPluggyTransactions` l.104–155.
2. **Com bug.**
3. **Causa:** l.112 `new URLSearchParams({ accountId, pageSize: "500" })` e l.113 `params.set("dateFrom", desde)`, chamando **`/v2/transactions`** (l.120), que pagina por cursor (`next`). O `pageSize` é parâmetro do `/transactions` v1. O `dateFrom` também precisa ser conferido na documentação da v2 (a v1 usa `from`/`to`).
   - A deduplicação é feita por `externalId = t.id`, com `identificadorBancario` (providerId) em coluna própria (migração 0077) e proteção contra cursor repetido e mais de 200 páginas.
4. Risco: mudar os parâmetros sem quebrar a chave histórica da migração v1→v2. Testes em `server/bancos-sync.test.ts`.

**B) Exclusão de conta**
1. Tela: `client/src/pages/admin/BancosPanel.tsx` l.77 (`previaExclusao`), l.255–274 (modal). Servidor: `server/bpo-auditoria.ts` `previaLimpezaConta` l.15 e `limparContaComBackup` l.45 (CTE atômica com backup em `bpo_conta_limpeza_backups`, preserva lançamentos Asaas, manuais ou com vínculo, e remove a conta).
2. **Parcial.** A prévia já mostra transações, lançamentos removidos e preservados e vínculos. A confirmação exige **digitar o rótulo da conta**, não "EXCLUIR".
3. —
4. Riscos:
   - A auditoria registra só `criado_por_user_id` no backup.
   - `bpo_lancamentos.bank_transaction_id` é ON DELETE CASCADE.

### 14 – Relatórios: "VGV de Obras" e Ticket Médio
1. Servidor: `server/relatorios-router.ts` `overview` l.163–242: o card "Avaliações" vem de `avaliacoesAgg` (l.187) e o `ticketMedio` (l.215–218) = receita de `financial_transactions` income/commission ÷ quantidade de transações. Tela: `client/src/pages/admin/AdminRelatorios.tsx` l.251 ("Avaliações") e l.268 ("Ticket médio").
   - Fonte do VGV: `construction_projects.vgv` (schema l.501). Regra do "VGV simulado": `shared/obra-localizacao.ts` l.70 (obra com lead usa `leads.simulation_value`; sem lead, o VGV digitado).
   - Outros campos: `financed_amount`, `subsidy_amount`, `down_payment_total`.
2. **Não existe** o indicador de VGV de Obras.
3. —
4. Riscos:
   - Definir a data que determina o período (start_date, created_at ou contratação).
   - Obras canceladas.
   - Divisão por zero.
   - A coluna `vgv` gravada pode estar diferente do VGV simulado (ver HANDOFF-22-10-VGV-SIMULADO.md).

### 15 – BPO › DRE: filtros de mês e ano
1. `AdminBpo.tsx` l.816–905 (alterna competência/categoria em l.822). Servidor: `bpo-router.ts` l.323–325 (`dre` e `dreCategorias` sem parâmetros, usam `db.getAllBpoLancamentos()`).
2. **Não existe filtro.** Mostra todas as competências.
3. —
4. Risco: `dreCategorias` não tem competência por linha; o filtro precisa ser aplicado na origem.

### 16 – Seleção em lote em Cobranças e Despesas
1. `AdminBpo.tsx` l.734–812 (lista sem checkbox e sem paginação). `bpo-router.ts` `lancamentos` (`list`, `create`, `receber`, `marcarPago`, `editar`; **nenhum `excluir`**). Conciliação parcial em `bpo-recebimentos.ts` e na migração 0083. Asaas: `asaas_payment_id` (único).
2. **Não existe** seleção, combinação de pagamentos nem exclusão.
3. —
4. Riscos:
   - Os registros protegidos precisam ser definidos: Asaas, extrato (`bank_transaction_id`), `obra_movimentos.bpo_lancamento_id`, `regularizacao_recebimentos`. É o mesmo critério do `previaLimpezaConta`.
   - `bpo_lancamentos` não tem soft delete.

### 17 – "Cadastro livre" vinculado a cliente do CRM
1. `AdminBpo.tsx` l.248 (texto "Cadastro livre…") e l.929–930 (editar cliente BPO / nome livre). `bpo-router.ts` `clientes.buscarLeads` l.183 e `importarCrm` l.205. Campos `bpo_clients.lead_id` e `bpo_lancamentos.cliente_nome_livre`.
2. **Parcial.** Existe edição manual de `clienteId`. Não há sugestão de vínculo por ID, CPF/CNPJ, telefone ou similaridade de nome.
3. —
4. Riscos: ambiguidade com homônimos e telefones repetidos; aplicar aqui também as mudanças de categoria da 12.

### 18 – Relatórios
- **18.1** "Imóveis por Tipo": `relatorios-router.ts` l.183 (`imoveis` agrupado por `tipo`); tela `AdminRelatorios.tsx` l.399. Para o novo gráfico: `construction_projects.vgv` / `financed_amount` / `subsidy_amount` / `down_payment_total`. **Não existe.**
- **18.2** Funil de leads:
  - Consulta: l.185 `select stage, count from leads group by stage`, **sem `deleted_at IS NULL`** e sem período. O total de leads (l.184) também inclui os excluídos.
  - **Causa dos nomes técnicos:** `AdminRelatorios.tsx` l.45–57 tem um `STAGE_LABELS` próprio e antigo, sem `approved_projects`, `contracts_registry`, `measurements` e `finalized`. A l.487 cai em `?? s.stage` e mostra a chave crua.
  - A fonte correta é `shared/lead-pipeline.ts` `LEAD_PIPELINE_STAGES` (l.2–10: Lead Novo, Em Atendimento, Aprovado e Follow up, Projetos e Vistorias, Contratos e Cartório, Medições, Finalizado) mais `LEGACY_STAGE_LABELS`.
- **18.3** Ranking de corretores vazio:
  - Consulta: l.196–204 lê só `operational_commissions` com `beneficiary="corretor"`. `buildCorretorRanking` (l.49–67) conta só `status === "paga"`.
  - **Causa provável:** as comissões de obras são calculadas à parte (`server/operacional-router.ts` `listarComissoesDeObras` l.464; status "paga" vem de `shared/financeiro/comissao.ts` l.75) e **não entram no ranking**. Se as comissões reais estão nas obras, o ranking fica vazio.
  - O ranking também não usa o período (from/to). A tabela legada `broker_commissions` não é mais consultada.
- **18.4** "Avaliações por Status" (l.188; tela l.436). Fontes de "Unidades Disponíveis":
  - Catálogo: `imoveis.status` (enum disponivel/reservado/vendido, schema l.1451–1463).
  - Incorporação: `incorporation_units.status` (varchar, padrão "disponivel", schema l.1961).

  **Não existe.** Riscos: a deduplicação entre catálogo e incorporação não está definida, e os valores de status da incorporação são varchar livre.

### Padronização numérica
1. Já existe:
   - Máscara única `shared/numero-mascara.ts` + `client/src/components/ui/numero-input.tsx`, com os wrappers `currency-input.tsx` e `percent-input.tsx`.
   - `shared/numero-br.ts` (`parseNumeroBR`).
   - `formatarPercentual` (`shared/financeiro/progresso.ts` l.200) e `client/src/lib/format.ts`.
2. **Parcial.** Ainda existem `<Input type="number">` em vários lugares:
   - AdminBpo l.342 e l.922 (valor no Editar lançamento)
   - BancosPanel l.344 (ano, que é correto ficar como inteiro)
   - Admin.tsx 4, AdminJuridico 3, AdminImovelForm 3, AdminAvaliacoes/Editar 3, BrokerPortal 3, telas de incorporação etc.
3. Inconsistência: `numeroPci` (shared/pci-gerador.ts l.244) trata "1.000" como 1, enquanto `parseNumeroBR` trata como 1000.
4. Risco: CPF, telefone, ano e IDs não podem entrar na máscara.

### Recomendação de ordem
Começar por 03, 04, 18.2 e 13A, que são correções de uma ou duas linhas com causa confirmada. Em seguida 05 e 09, de tela. Por último 06, 07, 08 e 10, que dependem dos arquivos oficiais MYLCA; peça esses arquivos ao dono antes de iniciar.