# Auditoria L0 — Grupo Santa Fé (main 1a62539, 29/10/2026)

## Auditoria somente leitura: Grupo Santa Fé (`/home/user/Grupo-Santa-Fe-lote3/web`, HEAD `1a62539`, merge da PR #238)

Não alterei nenhum arquivo. Os caminhos abaixo são relativos a `web/` e as linhas são aproximadas.

Três achados mudam o escopo do lote:
- **Indicador "Mensagens Enviadas" (04):** a causa está confirmada. A contagem é `historico.length` sobre uma consulta com `take: 100`.
- **Erro do Pluggy (13A):** a causa está confirmada. O código envia `pageSize=500` para `/v2/transactions`, e a Prospecta tem o mesmo bug.
- **Rótulos que não existem aqui (14 e 18):** o SF não tem "Avaliações", "Imóveis por Tipo" nem "Avaliações por Status". O pedido parece descrever as telas da Prospecta. No SF os nomes atuais são "Ticket Médio", "Distribuição por Tipo" e não há gráfico de unidades.

---

### 01 – WhatsApp › Conversas: exclusão em lote
1. Arquivos:
   - `src/app/admin/whatsapp/_components/conversas-whatsapp.tsx` (busca ~136, lixeira por conversa ~150, função `excluir` ~121).
   - `src/lib/actions/whatsapp.ts` `excluirConversaWhatsapp` (~269).
   - Modelo `MensagemWhatsapp`.
2. **Parcial.** A exclusão é de uma conversa por vez. Ela faz `deleteMany` local das mensagens daquele número; nada é apagado no celular nem na Evolution. Não há checkbox, seleção, contador nem botão de lote.
3. Não é bug.
4. Riscos:
   - O `deleteMany` é físico.
   - O agrupamento por telefone é feito em memória (`take: 2000` em `conversasWhatsapp`), então conversas antigas podem não aparecer.
   - O lote precisa respeitar `leadsProibidos` (regra do corretor) e não mexer em `Lead`.
5. Paridade: o comentário em ~125 diz que é gêmeo de `Prospecta/server/whatsapp-router.ts`.

### 02 – Vincular lead
1. Arquivos: `conversas-whatsapp.tsx` (~111 `criarLead`, botão "Criar lead" ~168) e `criarLeadDaConversaWhatsapp` em `actions/whatsapp.ts` (~294).
2. **Não existe.** Só há "Criar lead": cria um lead com origem "whatsapp" sem checar duplicidade e depois faz `updateMany` das mensagens com o `leadId`.
3. Bug relacionado: "Criar lead" pode criar lead duplicado para um telefone que já existe no CRM.
4. Riscos:
   - Normalizar o telefone com/sem 55 e 9º dígito (`mesmoTelefone` já existe).
   - Telefone presente em vários leads.
   - O vínculo hoje é só `MensagemWhatsapp.leadId`; não existe tabela de vínculo.

### 03 – Enviar Mensagem: destinatários
1. Fonte da lista: `src/app/admin/whatsapp/page.tsx` (~25):
   ```ts
   prisma.lead.findMany({ where: role === "corretor" && user.corretorId ? { corretorId } : {}, select:{id,nome,telefone,servico} })
   ```
   - Uso no cliente: `whatsapp-client.tsx` (`totalLeads` ~126, `filteredLeads` ~162, "Selecionar todos" ~362 usa `leads` inteiro).
   - Envio: `src/app/api/whatsapp/enviar/route.ts` (~48), com `where: { id: { in: leadIds } }`.
2. **Bug.** Nem a página nem a rota filtram `excluidoEm`, `arquivadoEm` ou status `perdido/arquivado/excluido`.
3. Causa: falta o filtro de excluídos. Por isso André Renan (excluído no CRM) continua aparecendo e pode receber mensagem.
   - O critério de lead ativo já existe em `src/lib/crm/pipeline.ts` `leadNoPipelineAtivo` e em `actions/leads.ts` ~273.
   - Contagem: o cabeçalho usa `leads.length`, mas "Selecionar todos" ignora o filtro de busca.
   - Atualização: a página é `force-dynamic`, mas a lista só é lida no servidor e não há refresh ao voltar para a aba.
4. Risco: a prévia (`previaEnvioWhatsapp`) e `documentosParaEnvioWhatsapp` também não filtram excluídos.

### 04 – Dashboard: "Mensagens Enviadas" travado em 100
1. Arquivos: `whatsapp/page.tsx` ~68 e `whatsapp-client.tsx` ~127/202.
   ```ts
   const historicoRaw = await prisma.mensagemWhatsapp.findMany({ where: { direcao: "saida" ... }, orderBy: { enviadaEm: "desc" }, take: 100 });
   ```
   No cliente: `const totalEnviadas = historico.length;`
2. **Bug.**
3. Causa confirmada: o valor fica limitado a 100 pelo `take`. Além disso:
   - Conta também `status: "falhou"`.
   - Não tem período definido.
   - `totalLidas`, `totalFalhas` e `taxaLeitura` saem da mesma amostra de 100.
4. Correção indicada: usar um `count` separado (`direcao: "saida"`, `status in [enviada, entregue, lida]`, período explícito) e manter o `take` só para a tabela.

### 05 – Remover "Galeria de Fotos" do Gerador de PCI
1. Arquivo: `src/app/admin/obras/[id]/editar/_components/editar-obra-client.tsx`.
   - ~24: a aba `fotos` tem o rótulo "Gerador de PCI".
   - ~88: `{aba === "fotos" && !modoEmpreiteiro && <GeradorPci/>}`.
   - ~89: `{aba === "fotos" && <FotosObra .../>}` → `editar/_components/fotos-obra.tsx`.
   - Galeria em Detalhes: `src/components/obras/obra-detalhe.tsx` ~125.
2. **Existe.** A galeria aparece logo abaixo do gerador.
3. Risco: para o empreiteiro (`modoEmpreiteiro`) a mesma aba é a única galeria. A remoção precisa ser condicional (`!modoEmpreiteiro`) para não sumir com as fotos dele.

### 06 – Cronograma físico-financeiro
1. Arquivos:
   - `src/components/obras/gerador-pci.tsx` ~220-230: `NumeroInput` com `max={100}`, `sufixo="%"`, sem `pontoDecimal`.
   - `src/lib/pci-gerador.ts`:
     - `numeroPci` ~165/243 (sem vírgula, o ponto vira decimal).
     - `normalizarFormularioPci` ~233: `cronograma.map(numeroPci)`, sem validação.
     - `pendenciasPci` ~501: só avisa, não bloqueia; compara `!== 100` exato.
     - `LINHA_CRONOGRAMA_PCI=166`, `MAX_ETAPAS_PCI=24`.
   - `src/lib/caixa/pci-gerador.ts` `celulasDoFormulario` ~131: grava o valor cru em `AI166..`.
   - `src/components/ui/numero-input.tsx` ~160: o `max` só é aplicado no `onBlur`.
2. **Parcial.** Só há entrada do % acumulado por etapa. Não existe:
   - validação de que os valores não decrescem;
   - limite 0–100 no servidor;
   - coluna incremental;
   - arredondamento para 2 casas.
3. Causa provável do "101.000": a máscara exibe "101000" como "101.000" (milhar) e o `onChange` propaga 101000 enquanto o usuário digita. O clamp só acontece no blur, e o servidor não valida. Em colagem, "101.000" sem `pontoDecimal` vira 101000.
4. Riscos:
   - Confirmar se a célula AI166+ do modelo espera percentual (25) ou fração (0,25). O leitor `lerPci` (`caixa/pci.ts` ~241, AD/AI 165+k) usa o mesmo valor cru.
   - Fixture para teste: `src/lib/caixa/__fixtures__/pci-modelo-anonimo.xls`.
   - O incremental deve vir das fórmulas da planilha (AI/AP 165+).

### 07 – Listas e fórmulas da "PCI MYLCA ATUALIZADA"
1. Mapa de campos: `src/lib/pci-gerador.ts` `CAMPOS_PCI` (~78-180).
   - São 13 seções e cerca de 95 campos com célula na aba `Proposta_Constr_Individual`.
   - Exemplos de célula: cobertura G98, teto V98, sistemaConstrutivo S75, tipoFormas AA84, abastecimentoAgua V106, esgoto O108, drenagem G108, energiaAlternativa V108, cozinha AI100, louçasMetais V100, destinacao O74, documentação Q64-Q67, revestimentos G104/O104/V104.
   - Custos AB120-138; adicionais I/Z149-158; BDI X141; prazo T161.
2. **Não existe.** Todos os campos são do tipo `"texto"` livre (os tipos possíveis são `texto/numero/inteiro/data/documento/registro/cep/telefone/coordenada`). Não há tipo "lista", nem opções, nem documento de mapeamento.
   - Únicas listas que existem hoje, em `src/lib/medicao-caixa.ts` ~21-30, para Alteração de Projeto: `SIM_NAO`, `OPCOES_COMODOS_SERVICOS`, `OPCOES_MONTAGEM`, `OPCOES_FORMAS`, `OPCOES_FORMAS_INCORPORADAS`, `OPCOES_EXECUTOR`, `OPCOES_SISTEMA_CONSTRUTIVO`. Precisam ser conferidas contra o oficial antes de reutilizar.
3. O leitor BIFF8 (`src/lib/caixa/biff8.ts`) não lê validação de dados (registros DV/DVAL); só preserva os registros.
4. Riscos:
   - O arquivo oficial MYLCA não está no repositório. Busquei em `/home/user` e não achei.
   - Sem o arquivo não dá para extrair as listas, e o pedido proíbe inventar opções.

### 08 – Gerar PLS
1. Arquivos:
   - `src/lib/obras/medicao-gerar.ts` `gerarArquivoMedicao` (~29): a saída hoje é **somente PDF**; o .xls foi removido no Lote 02.
   - `src/lib/caixa/medicao-pdf.ts`: `situacao()` ~271, `gerarPls` ~277, curva ~384-441.
   - `src/lib/caixa/medicao-xls.ts`: `calcularPls` ~149, `curvaDeEvolucao` ~186, `preencherPls` ~203; usado só em código/teste legado.
   - `src/lib/medicao-caixa.ts`: `dadosFixosDasMedicoes` ~153, `datasAlvaraDeMedicoes` ~181.
   - `src/lib/caixa/pci.ts` `lerPci` ~200: curvas da aba PLS BG/BH/BI 95+; cronograma AD/AI/AP 165+; alvará na PLS AI87/AS87.
   - Modelos `ObraProgressoHistorico` (`pciVersaoId`, `dadosCaixa`, `progresso`) e `ObraPciVersao` (`parsed`, `dados`).
2. Causas prováveis dos sintomas:
   - **Status vazio:** `situacao()` devolve "" quando `curvaLenta[etapa]` ou `cronogramaProposto[...]` é `undefined`. Isso acontece quando a PCI não tem aba PLS, quando as colunas BG..BI estão vazias, ou quando a coluna AD (etapa) do cronograma está vazia (o push exige `etapa !== null`). Também quando `etapaDaData` é null porque falta data de início ou contratação.
   - **Aferido ausente:** em `medicao-gerar.ts` ~42 o mapa `anteriores` nunca define `aferido`. O comentário diz "fica em branco… aguarda decisão do dono".
   - **Acumulados da PLS:** só existem para as medições anteriores desta obra, por etapa via `acumuladoPorEtapa`. Se a data de início estiver vazia, `etapa` fica null e a curva sai vazia.
   - **Vigência vazia:** vem de `dadosPls.alvaraVigencia`, que por padrão usa `pci.alvaraVigencia`. Esse valor só é lido da aba **PLS AS87**, nunca do campo da proposta (Gerador: `alvaraValidade` AF64). Também não existe "vigência do contrato" no modelo.
   - Não existem as abas Curvas_padrão, Calculos_Cronograma nem Regras: o código não as lê.
3. Riscos:
   - Preservar o histórico (`pciVersao` com `onDelete: NoAction`).
   - Não inventar datas, já que o término é calculado como início + prazo.

### 09 – Integrações
1. Arquivos:
   - `src/app/admin/integracoes/page.tsx`: renderiza `IntegracoesClient` (Asaas, Pluggy, Evolution) e `<SubPciAtual/>`.
   - `src/app/admin/integracoes/_components/conexao-whatsapp-integracoes.tsx` ("Conexão da empresa" e "Conexões dos corretores") **não é importado em lugar nenhum** (componente órfão).
   - "Minha Conexão WhatsApp" e "Conexões dos Corretores" existem só na Central WhatsApp (`whatsapp-client.tsx` ~242/~309).
   - `src/components/admin/sub-pci-atual.tsx` (~75-110): lista as versões com "Baixar original" e "Tornar atual". **Não tem excluir.**
   - Ações: `src/lib/actions/pci-gerador.ts` (`listarModelosPciAcao`, `definirModeloAtualPci`).
   - Rotas: `src/app/api/pci-modelos/route.ts` (POST) e `[id]/route.ts` (só GET).
2. Estado: a remoção dos blocos de WhatsApp em Integrações aparentemente já está feita no SF (confirmar no print do dono; pode ser um item da Prospecta). A exclusão de versão do modelo **não existe**.
3. Dependências para excluir uma versão:
   - `PciGerada.modeloId` tem `onDelete: SetNull` e `modeloVersao Int` fica preservado.
   - Bloquear a exclusão do modelo `atual`.
   - Não existe tabela de auditoria específica.

### 10 – Formato de entrada e saída do modelo
1. Arquivos:
   - `src/lib/pci-gerador.ts` ~515-537: `FormatoModeloPci = xls|xlsm|xlsb`; `formatoModeloPci` decide pela extensão e pelos bytes.
   - `src/lib/caixa/pci-gerador.ts`: `gerarPlanilhaPci` ~411; `gerarXls` ~208 com `PastaBiff8` (preserva os registros, grava células e cache de fórmulas, troca a imagem); `gerarXlsm` ~236-407 com `PastaXlsx` via fflate; xlsb lança `MENSAGEM_XLSB_SO_LEITURA`.
   - `src/lib/obras/pci-gerador-dados.ts`: `gravarModeloPci` ~69 (versão incremental, hash sha256, vira o atual); `gerarPciDaObra` ~188 (cria `PciGerada` com `modeloId`, `modeloVersao`, `planilhaFormato`).
   - Modelos `PciModelo` (versao, nome, formato, hash, dados Bytes, atual, observacao) e `PciGerada` (planilha Bytes, pdf Bytes, avisos Json).
2. **Parcial.** A saída é .xls real apenas quando o modelo é .xls. Com modelo .xlsm a saída é **.xlsm**, o que viola o requisito de "SAÍDA obrigatória XLS". Com .xlsb, bloqueia com aviso.
   - Não existe: comparação com a versão anterior, relatório de compatibilidade, extração de listas/fórmulas, passo de aprovação.
   - O vínculo PCI gerada ↔ versão do modelo **já existe**.
3. Risco: converter xlsm/xlsb para BIFF8 não tem suporte no código. Hoje só é possível gerar XLS a partir de modelo .xls.

### 11 – Layout global e responsividade
1. Componentes compartilhados:
   - Shell: `src/app/admin/_components/admin-shell.tsx` (conteúdo com `min-w-0`; popover `w-[22rem] max-w-[calc(100vw-1rem)]`; modal próprio `max-h-[90dvh]`).
   - `src/components/admin/sidebar.tsx`, `src/components/layout/{navbar,footer}.tsx`.
   - Inputs: `src/components/ui/{numero-input, currency-input, percent-input, area-input, numero-br-field, phone-input, button, card, form-com-envio, submit-button, barra-envio}.tsx`.
   - **Não existe** componente compartilhado de Modal, Dialog ou DatePicker. São 16 arquivos com overlay `fixed inset-0` próprio (bpo-client, bancos-panel, financeiro-obra, obra-diario-client, conversas-whatsapp, comissao-form, agenda-client, usuarios-client, corretores-client, contrato-*, projeto-revisoes, processo-regularizacao, sugestao/zap-btn, admin-shell). Datas usam `<input type="date|month">` nativo.
   - `src/app/globals.css` só estiliza a scrollbar; não há regra para inputs de data.
2. Sinais de overflow:
   - BPO `bpo-client.tsx`:
     - Modal de edição ~797: `max-w-lg` com `grid-cols-2` sem breakpoint, contendo month/date/select.
     - Modais de novo ~834/910/996: `max-w-md` com `grid-cols-2` e Valor + Competência (`type="month"`).
     - Barra de filtros ~656: selects sem largura mínima.
     - O Valor na edição usa `type="number"` nativo.
   - `bancos-panel.tsx`: ~324 `grid-cols-2` com dates em ~335/353; `whitespace-nowrap` ~273/390/392.
   - Obras:
     - `financeiro-obra.tsx` ~303 `grid-cols-2` com date ~305; ~211/220 `whitespace-nowrap`.
     - `medicao-caixa.tsx`: 6 inputs de data (~391-438) e `min-w-[200px]` ~527.
     - `gerador-pci.tsx`: ~211 `grid-cols-[1fr_160px]`, ~197 `min-w-[140px]`, ~223 `grid-cols-2`, ~261 nowrap.
     - `editar-obra-client.tsx`: dates ~100/103; tabs sem rolagem horizontal ~80.
     - `obras-client.tsx` ~30 `grid-cols-2`.
   - `bpo/[id]/page.tsx` ~76 `grid-cols-2` com month/date ~125/137.
   - "Contabilidade" não é um módulo próprio: é a aba `contabilidade` do BPO (`bpo-client.tsx` ~1033).
3. Risco: sem um modal compartilhado, a correção precisa ser repetida em 16 arquivos.

### 12 – Categorias do lançamento (cobrança/despesa)
1. Opções atuais:
   - **Categoria contábil** (`src/lib/bpo-categorias.ts` `CATEGORIAS_BPO`): Recebimento de cliente, Financiamento/CAIXA, Material, Mão de obra, Projetos e taxas, Impostos, Tarifas bancárias, Pró-labore, Administrativo, Transferência interna (oculta nos formulários), Outros.
   - **Categoria operacional** (`src/lib/bpo-operacional.ts`):
     - `CATEGORIAS_RECEITA` = obras, regularizacoes, comissoes, projetos, avaliacoes, imoveis, incorporacao, financiamentos.
     - `CATEGORIAS_DESPESA` = obras, tarefas_agenda, regularizacoes, comissoes, incorporacao.
     - Rótulos em `ROTULOS_OPERACIONAIS`.
     - `TIPOS_DESPESA_OBRA` = Empreiteiro, Terreno, Comissão, Fornecedor, Outros, Mão de obra, Material.
     - `validarOperacaoBpo` exige sempre `vinculoOperacionalId`; no criar é obrigatório, no editar é opcional (`obrigatorio=false`).
   - **Centro de custos**: texto livre, sem lista. Valor gravado automaticamente: "Avaliação Imobiliária" (`actions/avaliacoes.ts` ~50).
   - Telas:
     - Criar: `bpo-client.tsx` ~896 (cobrança, padrão "Recebimento de cliente") e ~982 (despesa, padrão "Outros"); centro de custos ~901/987.
     - Editar: ~810 e ~813.
     - Criar e editar usam `CamposOperacionais` (`campos-operacionais.tsx`).
     - Outra tela de criação: `bpo/novo/page.tsx`.
     - Ações em `src/lib/actions/bpo.ts`: criar ~130-165 (grava `categoria` e `categoriaContabil` iguais) e `editarLancamentoBpo` ~234.
   - Modelo `BpoLancamento`: `tipo`, `categoria`, `categoriaContabil`, `categoriaOperacional`, `vinculoOperacionalId/Rotulo`, `tipoDespesaObra`, `etapa`, `centroCustos`.
2. Onde cada campo é usado nos relatórios:
   - `categoria`:
     - DRE (`financeiro/bpo-resultado.ts` `montarDre`/`dreUltimos12Meses`) só para excluir Transferência interna (`contaNoResultado`).
     - Contabilidade `resumoContabil` agrupa `porCategoria` por `categoria`, e `impostosPagos` usa `categoria === "Impostos"`.
     - Conciliação bancária (`bancos/lancamentos-bpo.ts` ~55-189, `sugerirCategoria`, regras por titular) e a lista (~503).
   - `categoriaContabil`: só exibição e edição.
   - `categoriaOperacional`: filtro `?categoriaOperacional=` (`bpo/page.tsx` ~69), link "Financeiro deste serviço" (`components/admin/financeiro-servico.tsx`) e catálogo `bpo-catalogo.ts`.
   - `centroCustos`: **não é usado** em nenhum relatório.
3. Riscos:
   - As novas categorias operacionais (Impostos, Tarifas etc.) não têm registro vinculado. O validador exige vínculo, então precisa ser mudado.
   - Se "categoria contábil" sair da interface, a Contabilidade e "Impostos" perdem a fonte. Precisa de mapeamento substituto (operacional → `categoria`).
   - Extrato e Pluggy continuam gravando `categoria` por `sugerirCategoria`.

### 13 – BPO › Bancos
**(A) Pluggy**
1. Arquivo: `src/lib/bancos/pluggy.ts` `fetchPluggyTransactions` ~106-158.
   ```ts
   const params = new URLSearchParams({ accountId, pageSize: "500" }); if (desde) params.set("dateFrom", desde);
   … `${PLUGGY_API}/v2/transactions${proxima}`
   ```
2. **Bug.** A v2 é paginada por cursor (`next`) e rejeita `pageSize` com "property pageSize should not exist".
3. Causa confirmada: o parâmetro `pageSize` no endpoint v2.
   - Antes de corrigir, conferir na documentação os nomes aceitos (provavelmente `accountId`, `dateFrom`/`dateTo`, `cursor`, talvez `limit`).
   - Teste existente: `src/lib/__tests__/*pluggy*` (espera `dateFrom`).
   - Deduplicação: `src/lib/bancos.ts` ~96-127 faz upsert por `TransacaoBancaria.externalId @unique`; `desde` = max(dataInicial, última) em ~145.
4. Paridade: a Prospecta tem o mesmo bug em `server/_core/pluggy.ts` ~112.

**(B) Exclusão de conta**
1. Arquivos: `src/lib/actions/banco.ts` (`previaLimpezaContaBancaria` ~170-192, `excluirContaBancaria` ~195) e `bancos-panel.tsx` ~237.
2. **Parcial.** Já existe:
   - prévia (transações, lançamentos removidos/preservados, vínculos operacionais);
   - transação com backup em `BpoContaLimpezaBackup`;
   - conta marcada como inativa.

   A diferença: a confirmação pede para digitar o **nome da conta** (`p.rotulo`), não "EXCLUIR". Lançamentos sem vínculo são apagados fisicamente (`deleteMany`), com snapshot JSON.

### 14 – "Avaliações" → "VGV de Obras" e Ticket Médio
1. Arquivos:
   - `src/app/admin/bpo/_components/bpo-client.tsx` `BpoRelatorios` ~139-160. KPIs atuais: "Receita Total (12m)" (comissões pagas), "Imóveis Ativos", "Leads Captados", "Ticket Médio" (= receita de comissões / nº de comissões pagas).
   - Dados em `src/app/admin/bpo/page.tsx` ~17-135.
   - Campos disponíveis em `Obra`: `vgv`, `financiamentoCef`, `fgts`, `subsidio`, `dataInicio`, `criadoEm`, `status`. Cálculo da entrada em `src/lib/financeiro/obra.ts` ~197 (`entradaTotal = vgv − financiamento − fgts − subsídio`). Há também `src/lib/financeiro/vgv-lead.ts` (VGV = `Lead.valorAprovado`).
2. **Não existe** KPI "Avaliações" no SF (diferença de paridade).
3. Riscos:
   - Definir qual VGV é o "simulado": `Obra.vgv` ou `Lead.valorAprovado`.
   - Definir a data que fecha o período e o critério de obra elegível.

### 15 – DRE
1. Arquivos:
   - `bpo-client.tsx` aba `dre` ~722-760: tabela por competência.
   - `dreRows` ~419 vem de `montarDre(todosLancamentos)` (`bpo/page.tsx` ~118).
   - Filtros `mesFilter`/`anoFilter` (~328, ~375-386) existem só em Cobranças e Despesas. A barra é escondida em `aba !== "dre"` (~600).
2. **Não existe** filtro no DRE. A tabela traz todas as competências e não há quebra por categoria.

### 16 – Lote de cobranças e despesas
1. Arquivos: `bpo-client.tsx` `renderLancamentoTable` (~490-530) e abas `cobracas` ~641 e `despesas` ~685.
2. **Não existe** checkbox, seleção, "Combinar pagamentos", "Excluir" nem "Excluir tudo" para lançamentos.
   - Infra reaproveitável: `src/lib/exclusao.ts`, `src/components/admin/acoes-excluir.tsx`, `src/lib/bpo-limpeza.ts` e o padrão de backup do item 13B.
   - A lista vem com `take: 2000` (`page.tsx` ~33), então "Excluir tudo" precisa ser feito no servidor.
3. Riscos:
   - Proteger `transacaoId`, `asaasPaymentId`, `BpoBaixa`, `bpoLancamentoHistorico` e vínculos de obra/regularização (`movimentosObra`, `recebimentosRegularizacao`).
   - Ver Asaas em `src/lib/bancos/cobrancas-asaas.ts`.

### 17 – "Cadastro livre" → cliente do CRM
1. Arquivos:
   - `BpoLancamento.clienteNomeLivre` / `clienteId` → `BpoCliente.leadId`.
   - Opção "Cadastro livre / fornecedor" em `bpo/novo/page.tsx` ~30.
   - A edição (`bpo-client.tsx` ~797) só repassa `clienteId`/`clienteNomeLivre` em campos ocultos.
   - Na criação, `actions/bpo.ts` ~137 resolve o cliente pelo `leadId` do vínculo operacional.
   - Importação CRM→BPO: `src/lib/bpo-importacao-crm.ts` (só por ID).
2. **Não existe** reconciliação por CPF, telefone ou nome. A edição não permite trocar o cliente e mantém Categoria contábil e Centro de custos (fica alinhado com o item 12).

### 18 – Relatórios
- **18.1** O pie "Distribuição por Tipo" (`bpo-client.tsx` ~240) agrupa `prisma.imovel.groupBy({by:["tipo"]})` (`page.tsx` ~59, ~91). Ainda não existe "Números de Obra".
- **18.2 Funil:** `page.tsx` ~58 faz `prisma.lead.groupBy({ by: ["status"] })`, e `statusMap` (~98) só traduz os status legados novo/contato/visita/proposta/fechado/perdido.
  - Qualquer outro valor de `Lead.status` aparece cru (`statusMap[s.status] ?? s.status`).
  - As etapas reais do CRM ficam em `Lead.etapaOperacional`, com rótulos em `src/lib/types/crm.ts` `LEAD_STAGE_CONFIG` ~79: novo_lead, em_atendimento, aprovado_follow_up, projetos_vistorias, contratos_cartorio, medicoes, finalizado. Conversão em `src/lib/crm/pipeline.ts` `etapaDoLead`.
  - Os nomes `measurements`, `contracts_registry` e `approved_projects` **não existem** no código do SF (vêm da Prospecta ou de status legados gravados no banco).
  - Além disso, a contagem não filtra `excluidoEm`/`arquivadoEm`, e `totalLeads` também inclui excluídos.
- **18.3 Ranking vazio:** `page.tsx` ~61:
  ```ts
  prisma.corretor.findMany({ where:{ativo:true}, include:{ comissoes:{ where:{status:"paga"} } }, take: 10 })
  ```
  Causas prováveis:
  - O `take: 10` é aplicado **antes** de ordenar (pega 10 corretores quaisquer).
  - Considera só a tabela `Comissao` com status "paga" e `corretorId` preenchido. As comissões pagas via movimentos da obra (`categoria:"comissao"`, `status:"confirmado"`, ver `src/lib/comissoes/*` ~32) ficam de fora.
  - Corretores inativos são excluídos.
- **18.4** Não existe "Avaliações por Status" nem gráfico de unidades.
  - Fontes: `EstudoUnidade.status` (padrão "disponivel", varchar 20) para incorporação e `Imovel.status` (venda, locacao, lancamento, vendido, locado) para o catálogo.

### Padronização numérica
- Já existe o componente único `src/components/ui/numero-input.tsx`, com a lógica em `src/lib/numero-mascara.ts` e os wrappers currency, percent, area e numero-br-field.
- Formatação: `src/lib/utils.ts` (`formatCurrency` Intl BRL com 2 casas; `formatArea`/`formatPercent` com até 2 casas, sem mínimo; `parseNumeroBR`). Leitura da PCI: `numeroPci`.
- Lacunas:
  - Ainda há **26 `type="number"` nativos** em 16 arquivos: BPO (`bpo-client` Valor da edição ~806, `bancos-panel`, `bpo/[id]`, `bpo/novo`), imóveis, avaliações, regularização, 7 abas de incorporação e `corretor/imoveis`.
  - `formatPercent`/`formatArea` não fixam 2 casas.
  - O `max` do `NumeroInput` só é aplicado no blur (ver item 06).

### Diferenças de paridade com a Prospecta
- O bug do `pageSize` no Pluggy é o mesmo na Prospecta.
- O gerador de PCI e a medição se declaram gêmeos de `Prospecta/server/caixa/*` e `shared/pci-gerador.ts`.
- Os rótulos de relatórios citados no pedido (Avaliações, Imóveis por Tipo, Avaliações por Status, measurements/contracts_registry/approved_projects) não existem no SF, então essas correções vão criar telas novas, não renomear.
- No SF o bloco de WhatsApp em Integrações já não é renderizado.

**Pendências de insumo:**
- O arquivo oficial "PCI MYLCA ATUALIZADA.xls/.xlsb" não está nos repositórios e bloqueia os itens 06 (fórmula do incremental), 07 e 08 (abas Curvas_padrão, Calculos_Cronograma, Regras).
- Sem acesso ao banco não consegui confirmar quais valores reais de `Lead.status` geram os nomes técnicos do item 18.2, nem os status reais de `Comissao` do item 18.3.