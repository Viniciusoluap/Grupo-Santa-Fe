# MAPEAMENTO-PCI — modelo oficial da CAIXA (correções 06, 07, 08 e 10)

> Fonte: `PCI-CAIXA.xls` oficial enviado pelo dono em 29/10/2026 (BIFF8, ~5 MB, com macros VBA).
> Fiz só **análise estática**: os registros BIFF8 foram lidos por scripts fora do repositório, e o VBA foi
> extraído como texto com `olevba`, sem executar nada. **Nenhum dado de cliente foi copiado.** Este documento
> registra apenas a estrutura: abas, células, rótulos, listas, fórmulas e regras.
> Arquivo auxiliar para o código: `docs/handoffs/lote3/pci-listas.json`, com 136 entradas no formato `{aba, celula, rotulo, secao, campo_sistema, opcoes[], opcoes_exibicao[], fonte, intervalo_validacao, permite_branco, estilo_erro}`.
>
> Convenções usadas aqui:
> - Fórmulas em notação A1, com `;` como separador, como no Excel pt-BR.
> - O prefixo `_xlfn.` foi removido dos nomes de função.
> - `EDATE` corresponde a `DATAM`. No arquivo ele aparece como função de suplemento (EXTERNNAME), o que já foi resolvido.
> - `{=…}` indica fórmula matricial.
> - "U" indica célula desbloqueada, ou seja, de entrada.

---

## 1. Abas

| # | Aba | Visibilidade | Protegida | Observação |
|---|-----|--------------|-----------|------------|
| 1 | `Proposta_Constr_Individual` | visível | **sim** (PROTECT=1, proteção avançada FEATHEADR 0x581f) | Colunas ocultas: A–E, AY–BN. As colunas BA–BQ guardam espelhos das listas (`=Lista!…`) e as curvas. |
| 2 | `Selo Casa Azul - Unid.Isolada` | **oculta** | sim | É exibida pela macro quando `Opt_Selo` (Proposta!Y93) = "Sim". |
| 3 | `Curvas_padrão` | **muito oculta** | não | Tabelas das curvas lenta, normal e rápida por faixa de valor do imóvel. |
| 4 | `Lista` | **muito oculta** | não | Origem das listas de memorial. O `Workbook_Open` força `xlVeryHidden`. |
| 5 | `PLS` | visível | sim | Planilha de Levantamento de Serviços (medição). |
| 6 | `Calculos_Cronograma` | **muito oculta** | não | Calcula a etapa da vistoria (D6), usada pela PLS. |
| 7 | `Repactuação_Prazo` | visível | sim | |
| 8 | `Alteração_Projeto_Especific` | visível | sim | |
| 9 | `Regras` | **muito oculta** | não | Listas de programas e infraestrutura. **Nenhuma fórmula a referencia.** |

- A proteção é desfeita e refeita pela macro `VeriAWP`. A senha fica ofuscada no VBA e não foi transcrita aqui.
- A pasta não tem proteção de estrutura no nível do workbook.

### 1.1 Macros VBA relevantes

Os módulos `Planilha1`, `Planilha2`, `Planilha7` e `Planilha8`, além de `Mod_Fabrícia` e `MódPeagaH`, fazem apenas três coisas:

- **Mostrar ou ocultar linhas e abas** conforme as respostas. Exemplos:
  - `Sist_constr` (S75) = "Outros…" mostra `Espec_outros` (linha 79).
  - `Sist_constr` = "Inovador:especificar sistema" mostra `Espec_DATec` (linhas 76–78).
  - `uso_eps` (AB81) = "Sim" mostra `Alerta_EPS` (linha 91) e `fabricante` (linhas 82–83).
  - `Tipo_forma` (AA84) = "EPS" mostra a linha `CIHAR`. A referência a esse nome está quebrada no arquivo.
  - `Perm_forma` (AS84) = "Sim" mostra `Alerta_Inov` (linha 92).
  - `Sol_esgoto` (O108) ≠ "Rede de Esgoto" mostra `Trat_esgoto` (linhas 109–112).
  - Quando `ATENÇÃO` (Z161) ≠ "", mostra `Just_Prazo` (linhas 162–163).
  - Na PLS, `Opt_Selo1` (AS170) mostra `Ind_Selo` (171–175).
  - `PosRepro` (PLS!AV82) ≥ 31 mostra as linhas 126…(125+PosRepro−30) do grupo `GrupOn`.
  - `Perc_Acumul` (PLS!Y105) = 100 mostra `Conc_Selo` (linha 175).
- **Recalcular** a pasta.
- **Limpar o formulário.**

**As macros não validam valores.** As regras de validação estão todas nas fórmulas, nas validações de dados (DV) e na formatação condicional (CF).

As comparações de texto feitas pelas macros são exatas. Por isso, as opções gravadas precisam ser idênticas às da lista, inclusive espaços (ver §2.5).

---

## 2. Validações de dados do tipo lista (DV 0x01BE)

São **71 registros DV** no total: Proposta 33, Selo 5, PLS 6, Alteração 27.

- **Todos são do tipo lista.** Não há validação de número, data ou decimal em nenhuma aba, nem no cronograma.
- Todos têm `permite_branco = true` e estilo de erro "parar".
- As listas por intervalo apontam para colunas ocultas da própria aba. Essas colunas contêm fórmulas `=Lista!…` (ver §2.4).
- Na tabela abaixo, a coluna "Campo do sistema" usa o `id` de `CAMPOS_PCI` em `shared/pci-gerador.ts`.

### 2.1 Proposta_Constr_Individual, por seção

| Seção | Célula (âncora) | Intervalo DV | Rótulo | Fonte | Opções | Campo do sistema |
|-------|-----------------|--------------|--------|-------|--------|------------------|
| RTP | AI47 | AI47:AJ47 | UF (registro RTP) | literal | 27 UFs: AC,AL,AP,AM,BA,CE,DF,ES,GO,MA,MT,MS,MG,PA,PB,PR,PE,PI,RR,RO,RJ,RN,RS,SC,SP,SE,TO | `rtpUf` (texto livre) |
| RTE | AI50 | AI50:AJ50 | UF (registro RTE) | literal | 27 UFs | `rteUf` (texto livre) |
| Imóvel | AV56 | AV56:AW56 | UF | literal | 27 UFs | `uf` (texto livre) |
| Matrícula | X58 | X58 | hemisfério da latitude | literal | N, S | `latitude.celulaHemisferio` |
| Matrícula | AQ58 | AQ58:AW58 | Finalidade | literal | Aq.Terreno e Constr. FGTS · Constr.Terr.Próprio FGTS · Aq.Terreno e Constr. SBPE · Constr.Terr.Próprio SBPE (no original, o 2º e o 4º itens começam com espaço) | `finalidade` (texto livre) |
| Documentação técnica | Q63 | Q63:V66 | Certidão de Matrícula do Imóvel | literal | Apresentado, Não apresentado | **sem campo** |
| Documentação técnica | Q64 | Q63:V66 | Alvará/Licença da Obra | literal | Apresentado, Não apresentado | `alvaraSituacao` (texto livre) |
| Documentação técnica | Q65 | Q63:V66 | ART/RRT/TRT de Proj. Arquitetura | literal | Apresentado, Não apresentado | `artProjetoSituacao` (texto livre) |
| Documentação técnica | Q66 | Q63:V66 | ART/RRT/TRT de Exec. de Obra | literal | Apresentado, Não apresentado | `artExecucaoSituacao` (texto livre) |
| Documentação técnica | AL63 | AL63:AQ63 | Projeto Legal/Arquit. c/ divisões | literal | Apresentado, Não apresentado | **sem campo** |
| Documentação técnica | AR64 | AR64:AW64 | Terreno é próprio | literal | Sim, Não | `terrenoProprio` (texto livre) |
| Documentação técnica | Q67 | Q67:AN67 | Projeto Legal Aprovado | literal | Apresentado projeto aprovado · Apresentado comprovação de Licenciamento Declaratório · Não apresentado | `projetoLegalSituacao` (texto livre) |
| Áreas | O74 | O74 | Destinação do Imóvel | literal | Residencial, Comercial | `destinacao` (texto livre) |
| Sistema construtivo | S75 | S75 | Sistema Construtivo | Proposta!BB95:BB108 (= Lista!R2:R15) | 14 opções. Ver o JSON. O 9º item termina com espaço: "Conv:Light Wood Frame NBR nº 16936 " | `sistemaConstrutivo` (texto livre) |
| Sistema construtivo | AB81 | AB81:AE81 | Existe previsão de uso de EPS…? | literal | Sim, Não | `usoEps` |
| Sistema construtivo | AP81 | AP81 | Montagem/fabricação das paredes | literal | Pré-fabricadas em canteiro, In loco, Em fábrica | `montagemParedes` |
| Formas | Q84 | Q84:T84 | As paredes tem função estrutural? | literal | Sim, Não | `paredesEstruturais` |
| Formas | AA84 | AA84:AD84 | Tipo de Fôrmas? | literal | Madeira, Aço, EPS, Alumínio, Não se aplica | `tipoFormas` |
| Formas | AS84 | AS84:AW84 | As fôrmas permanecem nas paredes acabadas? | literal | Sim, Não, Não se aplica | `formasPermanecem` |
| Sistema construtivo | AS89 | AS89:AW89 | Apresentou Doc. Complem. Sistema Inovador? | literal | Sim, Não, Não se aplica | **sem campo** |
| Selo | Y93 | Y93 | Optante pelo Selo Casa Azul - Unidade Isolada? | literal | Sim, Não, Não se aplica | `seloCasaAzul` |
| Documentação técnica (selo) | AS93 | AS93:AW93 | Apresentou docum. Complementar Selo? | literal | Sim, Não, Não se aplica | `docSeloCasaAzul` |
| Acabamentos | M96 | M96 | Padrão Acabamento | literal | Baixo, Normal, Alto | `padraoAcabamento` |
| Acabamentos | AM96 | AM96:AW96 | Implantação/Inserção | BN2:BN4 (Lista!P2:P4) | Isolada · Isolada(parte empr.não-condom.) · Condomínio | `implantacao` |
| Cobertura | G98 | G98:U98 | Cobertura | BB2:BB8 (Lista!B2:B8) | Telha Metálica c/ Platibanda · Telha Metálica s/ Platibanda · Telha de Fibrocimto. c/ Platibanda · Telha de Fibrocimto. s/ Platibanda · Telha de Cerâmica/Concreto · Laje Impermeabilizada · Outros | `cobertura` |
| Teto | V98 | V98:AB98 | Teto | BA2:BA6 (Lista!A2:A6) | Telha aparente, Forro, Laje, Laje+Forro, Outros | `teto` |
| Cômodos | AC98 | AC98:AE98 | Pavtos. | literal | 1, 2, 3, **4+** | `pavimentos` (**inteiro**) |
| Cômodos | AF98 | AF98:AQ98 | Quartos | literal | 0, 1, 2, 3, **4+** | `quartos` (inteiro) |
| Cômodos | AI98 | AF98:AQ98 | Suítes | literal | 0, 1, 2, 3, 4+ | `suites` (inteiro) |
| Cômodos | AL98 | AF98:AQ98 | Salas | literal | 0, 1, 2, 3, 4+ | `salas` (inteiro) |
| Cômodos | AO98 | AF98:AQ98 | Vagas | literal | 0, 1, 2, 3, 4+ | `vagas` (inteiro) |
| Cômodos | AR98 | AR98:AW98 | Tipo de Vagas | literal | Coberta(s), Descoberta(s) | `tipoVagas` |
| Revestimentos | G100 | G100 | Acabamento Paredes Externas | BC2:BC7 | Sem revestimento · Pintura/Textura/Grafiato · Pint./Text./Grafto. e det. em Pedra/Cerâmica · Cerâmica/Porcelanato · Outros (BC6 é a constante "Outros"; BC7 está vazia) | `paredesExternas` |
| Louças e metais | V100 | V100:AB100 | Louças e Metais | BG2:BG4 (Lista!I) | Linha Popular, Linha Média, Linha Luxo | `loucasMetais` |
| Cozinha | AC100 | AC100:AH100 | Á. Serviço | BL2:BL5 (Lista!N) | Não, Interna, Externa coberta, Externa descoberta | `areaServico` |
| Cozinha | AI100 | AI100:AO100 | Cozinha | BM2:BM5 (Lista!O) | Cozinha, Cozinha+A.Serviço, Cozinha+Copa, Cozinha americana | `cozinha` |
| Revestimentos | G102 | G102:U102 | Acabamento Paredes Internas | BC2:BC7 (mesma da G100) | igual à G100 | `paredesInternas` |
| Revestimentos | V102 | V102:AB102 | Pards./Painéis Á. Secas | BF2:BF7 (Lista!H) | Alvenaria, Gesso, Madeira, Concreto, Aço, Outros | `paredesAreasSecas` |
| Água | AC102 | AC102 | Calefação | literal | Sim, Não | `calefacao` |
| Água | AI102 | AI102 | Água Quente | BO2:BO4 (Lista!Q) | Não, Aquecimento solar, Aquecimento à gás | `aguaQuente` |
| Sustentabilidade | AP102 | AP102 | Itens Sustentabilid. | literal | Sim, Não | `itensSustentabilidade` |
| Revestimentos | G104 | G104:N104 | Revest.Parede.Á.Molhadas | BP2:BP14 (Lista!E2:E14) | 13 opções: Cimentado … Granito/Mármore 1ª. "Porcelanato 1ª" e "Outros" **não** entram | `revestParedeMolhadas` |
| Revestimentos | O104 | O104:U104 | Revest.Piso Á.Secas | BE2:BE11 (Lista!G) | 10 opções | `pisoAreasSecas` |
| Revestimentos | V104 | V104:AB104 | Revest.Piso Á.Molhadas | BD2:BD8 (Lista!F) | 7 opções | `pisoAreasMolhadas` |
| Esquadrias | G106 | G106:U106 | Esquadrias Externas | BQ2:BQ7 (Lista!D) | Alumínio, Ferro, Vidro Temperado, PVC, Madeira, Outros | `esquadriasExternas` |
| Esquadrias | O106 | — | Esquadrias Internas | **sem DV no arquivo** | texto livre | `esquadriasInternas` (texto, correto) |
| Água | V106 | V106:AB106 | Abastecimento d'Água | BH2:BH4 (Lista!J) | Concessionária, Poço, Outra | `abastecimentoAgua` |
| Drenagem | G108 | G108:N108 | Drenagem | BJ2:BJ4 (Lista!L) | Rede de Água Pluvial, Interna ao terreno, Outra | `drenagem` |
| Esgoto | O108 | O108:U108 | Coleta/Tratmto. Esgoto | BI2:BI5 (Lista!K) | Rede de Esgoto, Fossa e Filtro, Fossa e Sumidouro, Outra | `esgoto` |
| Energia alternativa | V108 | V108:AB108 | Ger. Alternt. de Energia | BK2:BK5 (Lista!M) | Nenhuma, Fotovoltaica, Eólica, Outra | `energiaAlternativa` |
| Esgoto | AR109 | AR109:AW110 | Atende Localização e Distância (NBR 17076)? | literal | Sim, Não | `esgotoDistancias` |
| Esgoto | AR110 | AR109:AW110 | Impede interferência/contaminação? | literal | Sim, Não | `esgotoContaminacao` |
| Custos | AN140 | AN140:AW140 | Executor da obra | literal | Construtora, Profissional Autônomo | **sem campo** (define o limite de BDI) |
| Cronograma | M163 | M163:P163 | Tem Justificativa? (prazo) | literal | Sim, Não | **sem campo** |

**Destinação:** a lista é O74 (Residencial/Comercial).

**Campos sem lista, que continuam de texto livre ou numéricos:**
- áreas, valores, matrícula, ORI, construtora, CNPJ, números de ART (AF65/AF66), DATec (N76/X76/N77/X77), norma ABNT (L79/V79)
- Q80 (especificação), G83 (fabricante EPS), S86, divisão interna (AC104), outros (AC107), G112 (descrição do esgoto)
- custos (AB120:AB138), adicionais (I/Z149:158), BDI (X141), prazo (T161), pré-executado (AS161), cronograma (AI166:AI189)
- justificativas (AG155, AA163), G165 (obras pré-existentes), G245 (observações), H258 (local e data)

### 2.2 PLS

| Célula | Intervalo DV | Rótulo | Opções | Campo do sistema |
|--------|--------------|--------|--------|------------------|
| AN82 | AN82 | Houve Repatuação de prazo? | sim, não (**minúsculas**) | `dados.pls.houveRepactuacao` |
| AU84 | AU84 | A execução da obra está observando as condições contratadas? | sim, não | `condicoesContratadas` |
| AS85 | AS85 | A placa/adesivo CAIXA está afixada na obra? | sim, não | `placaAfixada` |
| AS88 | AS88:AS89 | Projeto e especificações estão sendo cumpridos? | sim, não | `projetoCumprido` |
| AS89 | AS88:AS89 | Serviços executados de modo a prevenir danos/vícios? | sim, não | `prevencaoDanos` |
| **V85:V104** | V85:X104 | Execução do Item (%) dos 20 serviços | **0%, 5%, 10%, … 100%** (21 opções, passo de 5%, gravadas como fração) | `execucoes[]` |
| AS170 | AS170:AW171 | Optante pelo Selo Casa Azul? | Sim, Não | `seloCasaAzul` |
| AS171 | AS170:AW171 | Existem itens/serviços concluídos ou em execução do Selo? | Sim, Não | **sem campo** |
| AS175 | AS172:AW175 | Todos os itens do Selo estão concluídos? | Sim, Não, Não se aplica | **sem campo** |

**DVs herdadas sem efeito.** AI62, AI65, AV71 e X73 têm lista (UF e N/S), mas contêm fórmulas que puxam da Proposta.

### 2.3 Selo Casa Azul e Alteração

As 5 listas da aba Selo são pontuações por critério: `0,1`, `0,1,2`, `0,1,2,3`, `0,2` em AT61:AW76 e `Sim,Não` em AT78. As 27 da Alteração replicam as listas do memorial, apontando para as colunas BA–BQ e AZ93:AZ105 da própria aba, mais Sim/Não, Inclusão/Exclusão e outras. Todas estão no JSON, com rótulo automático marcado como "conferir".

Particularidades da Alteração:
- A lista de sistema construtivo (AZ93:AZ105) **não tem "solo-cimento"** e tem 13 opções.
- A lista de revestimento de parede molhada (U66) **é diferente** da Proposta: inclui "Porcelanato de 1ª" e "Cerâmica/pintura".
- AF68 (Esquadrias Internas) **tem** lista na Alteração, embora a O106 da Proposta não tenha.
- Vários intervalos de Sim/Não (O71, U71, V74, …) cobrem rótulos e mesclas. São resíduos.

### 2.4 Nomes definidos (NAME) relevantes

| Nome | Referência | Uso |
|------|------------|-----|
| `PrazExec` | Proposta!$T$161 | prazo proposto (meses) |
| `Pre_executado` | Proposta!$BW$162 | |
| `PrExMin` | Proposta!$A$165:$IV$189 | linhas do cronograma |
| `ATENÇÃO` / `ATEN` | Proposta!$Z$161 / $G$162 | alertas de prazo |
| `Just_Prazo` | Proposta!$A$162:$IV$163 | linhas da justificativa |
| `Sist_constr`, `sist` | Proposta!$S$75, $A$75:$IV$75 | |
| `uso_eps`, `Tipo_forma`, `Perm_forma`, `Espec_formas` | AB81, AA84, AS84, linha 91 | |
| `Espec_DATec`, `Espec_outros`, `fabricante`, `Alerta_EPS`, `Alerta_Inov`, `cihar` | linhas 76–78, 79, 82–83, 91, 92, 90 | |
| `Sol_esgoto`, `Trat_esgoto` | O108, linhas 109–112 | |
| `Opt_Selo` | Proposta!$Y$93 | |
| `Tipo_executor`, `Perc_BDI`, `Limite_BDI` | AN140, X141, AN141 | |
| `P_Ini` | Proposta!$G$44 (proponente) | |
| `CronoRepro`, `PosRepro` | PLS!$AN$82, PLS!$AV$82 | repactuação |
| `Perc_Acumul` | PLS!$Y$105 | |
| `LimRepro`, `GrupOn`, `LN_etap31`, `Etap31…Etap60` | PLS!A125, linhas 126:167, AC126… | etapas 31–72 |
| `Opt_Selo1`, `Ind_Selo`, `Conc_Selo` | PLS!AS170, linhas 171:175, 175 | |
| `PerConc` | PLS!$BM$83 | |
| `S_Ini` | PLS!$G$59 | |
| `Total_etapas`, `PosRepro1`, `crono`, `repact`, `add_etapas`, `Etp_extra` | Repactuação | |
| `_FilterDatabase` | PLS!$G$77:$AW$175 | |
| `Print_Area` (por aba) | Proposta F34:AW266, PLS F49:AX309, etc. | |
| `S_F01…S_F10` | #REF! (quebrados) | legado |
| `recursos`, `programa`, `C0`, `AbreLista`, `InsFot`, `LmpFoto`, `VeriAWP` | ocultos e vazios (nomes de macro ou legado) | |

### 2.5 Pontos de atenção para o código

- **Grave a opção exatamente como está na lista.** O JSON traz `opcoes` exatas e `opcoes_exibicao` sem espaços nas pontas. O VBA compara `Sist_constr` com o texto exato de "Inovador:especificar sistema" e de "Outros (…)".
- `Lista!C` (Acabamento) tem "Tijolo/Blc. Apar. Tratado/Imperm." em C6, mas a Proposta sobrescreve BC6 com "Outros". Portanto **vale a lista resolvida da Proposta**, não a da aba `Lista`. Use sempre o JSON.
- A fórmula C58 compara a Finalidade com valores antigos ("Aq.Terreno e Constr.", "Constr.Terr.Próprio"). Com as opções atuais ela resulta sempre 0. É legado, sem impacto visível.

---

## 3. Cronograma físico-financeiro na Proposta (correção 06)

| Célula | Tipo | Conteúdo |
|--------|------|----------|
| T161 (`PrazExec`) | U, General | prazo em meses |
| AS161 | U, General | "Percentual de Obra Pré-Executado (Etapa 0) %" |
| AD165 | constante 0 | etapa 0 |
| AD166:AD189 | fórmula | `=IF(AD165="";"";IF(AD165+1<=$T$161;AD165+1;""))`. Numera as etapas de 1 até T161; o máximo é 24 linhas |
| **AI165** | fórmula, formato `0.00` | `=AS161`. O acumulado da etapa 0 é o pré-executado |
| **AI166:AI189** | **U, formato General** | "% Acumulado Proposto" das etapas 1…24. É um **acumulado**, não incremental |
| AP165:AP189 | fórmula, `0.00` | `=BF165…BF189`. "Curva de Referência - % Acumulado" é a curva **normal** |
| AX166:AX189 | fórmula | `=IF($AI166=0;"";IF($AS$161>0;IF(($AI166-$AI165>$BF$157);"Excede limite da etapa";"OK");IF($AI166>$BH166;"Supera o limite";IF($AI166<$BD166;"Abaixo do mínimo";"OK"))))` |
| BB165:BB189 / BL165:BL189 | constantes 0…24 | número da etapa |
| BD165:BD189 | `{=…VLOOKUP(BBn;'Curvas_padrão'!B22:E45;2;0)…}` | curva **lenta**, usada como mínimo |
| BF165:BF189 | idem, coluna 3 | curva **normal** |
| BH165:BH189 | idem, coluna 4 | curva **rápida**, usada como máximo |
| BF157 | `=IF(AK74=0;"";IF(AK74<=264000;23;IF(AK74>500000;14;IF(AK74>264000;17;""))))` | incremento máximo por etapa quando há pré-executado |
| BD158 / BF158 / BH158 | `=VLOOKUP(100;BD165:$BM$189;9;0)` (e colunas 7 e 5) | etapa em que cada curva chega a 100% |
| Z161 | `=IF(PrazExec="";"";IF(PrazExec>$BD$158;"ATENÇÃO";IF(PrazExec<$BH$158;"ATENÇÃO";IF(PrazExec>24;"ATENÇÃO";""))))` | |
| G162 | `=IF($T$161="";"";IF($T$161>24;"Prazo de Construção ultrapassa o limite contratual, a proposta é inviável.";IF($T$161>$BD$158;"Prazo maior que as referências, necessário informar justificativa técnica…";IF($T$161<$BH$158;"Prazo menor que as referências, avalie…";""))))` | |
| Q163 / BP163 | mensagens | "Justifique adoção do prazo proposto." / "Ajuste o Prazo da sua obra." / "<== Preenchimento obrigatório." |
| AX161 | `=IF($AS$161>70;"<--Ultrapassa limite permitido";"ok")` | o pré-executado não pode passar de 70 |
| BJ162:BJ189 | escolhe uma curva conforme PrazExec | auxiliar |

**Faixa de curva.** A fórmula das curvas escolhe a faixa assim:
- `AK74` (valor do imóvel) ≤ 264000 usa a faixa 1;
- \> 500000 usa a faixa 3;
- caso contrário, usa a faixa 2.

Se AK74 = 0 ou a busca dá erro, o resultado é "". A curva normal usa `>264000.01` como limite. Na Proposta a curva vem de AK74; na PLS vem de AQ77.

**Regras do Excel:**
- **Não existe validação de dados numérica** no cronograma: nenhuma faixa 0–100 nem casas decimais. AI166:AI189 tem formato General. Só AI165 e AP têm `0.00`.
- O Excel **não verifica** se o cronograma é não decrescente nem se termina em 100. O que existe:
  - o aviso por etapa na coluna AX: abaixo da curva lenta, acima da rápida ou, com pré-executado, incremento maior que 23, 17 ou 14 p.p.;
  - a formatação condicional "=0" em AI166:AI190, que destaca campo vazio como obrigatório.
- **O incremental de cada etapa é `AI(k) − AI(k−1)`**, com etapa 0 = AS161, conforme a fórmula AX. **Nenhuma fórmula soma os acumulados.** Isso confirma a regra da correção 06.
- A PLS lê a mesma coluna: `PLS!BA95 = Proposta!AS161` e `PLS!BA96…BA119 = Proposta!AI166…AI189`.
- Os limites pedidos na 06 vão **além** do que o Excel faz e precisam ser implementados no sistema:
  - 0,00–100,00;
  - não decrescente;
  - a última etapa (T161) deve ser 100,00;
  - recusar 101.000;
  - duas casas decimais.

**Tabela `Curvas_padrão` (B22:E45, H22:K45, N22:Q45, etapas 1–24; % acumulado):**

| Etapa | F1 lenta | F1 normal | F1 rápida | F2 lenta | F2 normal | F2 rápida | F3 lenta | F3 normal | F3 rápida |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0 | 5 | 8 | 0 | 5 | 9 | 0 | 3 | 5 |
| 2 | 19 | 22 | 33 | 14 | 15 | 25 | 8 | 10 | 17 |
| 3 | 28 | 39 | 59 | 20 | 27 | 42 | 13 | 14 | 25 |
| 4 | 38 | 59 | 84 | 28 | 39 | 59 | 18 | 23 | 39 |
| 5 | 50 | 74 | 100 | 35 | 52 | 75 | 25 | 32 | 53 |
| 6 | 58 | 90 | 100 | 44 | 63 | 90 | 31 | 42 | 64 |
| 7 | 65 | 100 | 100 | 51 | 74 | 95 | 38 | 51 | 76 |
| 8 | 70 | 100 | 100 | 57 | 82 | 100 | 42 | 59 | 87 |
| 9 | 75 | 100 | 100 | 62 | 92 | 100 | 48 | 67 | 94 |
| 10 | 80 | 100 | 100 | 66 | 100 | 100 | 54 | 73 | 100 |
| 11 | 84 | 100 | 100 | 71 | 100 | 100 | 59 | 80 | 100 |
| 12 | 87 | 100 | 100 | 75 | 100 | 100 | 65 | 89 | 100 |
| 13 | 100 | 100 | 100 | 80 | 100 | 100 | 69 | 95 | 100 |
| 14 | 100 | 100 | 100 | 82 | 100 | 100 | 75 | 100 | 100 |
| 15 | 100 | … | … | 85 | 100 | 100 | 79 | 100 | 100 |
| 16 | 100 | | | 89 | 100 | 100 | 81 | 100 | 100 |
| 17 | 100 | | | 94 | 100 | 100 | 83 | 100 | 100 |
| 18 | 100 | | | 100 | 100 | 100 | 86 | 100 | 100 |
| 19–21 | 100 | | | 100 | | | 89 / 92 / 95 | 100 | 100 |
| 22–24 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 |

Observações sobre a tabela:
- A tabela horizontal das linhas 2–17 **difere** na normal da etapa 1: lá é 0, aqui é 5. As fórmulas usam a vertical (22–45).
- A cópia nas linhas 47–71 tem F2 lenta da etapa 17 = 89, diferente do 94 das linhas 22–45. Nenhuma fórmula usa essa cópia.
- A etapa 0 não está na tabela. O VLOOKUP falha e o resultado vira "" (BD/BF/BH165 = 0 constante).

---

## 4. PLS, curva e situação da obra (correção 08)

### 4.1 Entradas da PLS ("U") e datas

| Célula | Rótulo | Tipo/formato | Observação |
|--------|--------|--------------|-----------|
| S51 | nº do contrato | U `#,##0` | CF obrigatório |
| AQ77 | Valor do imóvel | U `#,##0.00` | **define a faixa das curvas BG/BH/BI** |
| AL78 | Contratação | U data | obrigatório (CF) |
| **AV78** | **Nº Etapas original** | U `#,##0` | obrigatório (CF). **Sem ele, `AV83` = 0 e a coluna AC (etapas) fica vazia** |
| AL79 | Data início de obra | **fórmula** `=DATE(YEAR($AL$78);MONTH($AL$78);DAY($AL$78)+30)` | contratação + 30 dias |
| AL80 | Término Previsto | **fórmula** `=IF(AL79="";"";EDATE($AL$79;$AV$83))` (os dois ramos do IF são iguais) | |
| AL81 | Data do Levantamento (vistoria) | U data | |
| AQ79 | aviso | `=IF(OR($AL$78=0;$AL$79=0;$AL$80=0;$AL$81=0);"Documento inválido. Existem campos de data não preenchidos.";"")` | |
| AN82 (`CronoRepro`) | Houve repactuação? | U lista sim/não | |
| AV82 (`PosRepro`) | Etapas Repact. | U | BP82 exige quando AN82="sim" |
| AV83 | Total de etapas | `=IF(CronoRepro="Sim";AV82;AV78)` | |
| AU84, AS85, AS88, AS89 | perguntas de qualidade | U lista sim/não | |
| AS86 | O alvará está válido? | `=IF(OR(AL81="";AS87="");"";IF(AL81<=AS87;"Sim";"Não"))` | BP86 mostra o aviso de alvará vencido |
| AI87 | Data Emissão Alvará | U data | |
| **AS87** | **Data Vigência Alvará** | U data | obrigatório (CF). É a "data de vigência" |
| V85:V104 | Execução do Item | U, lista 0–100% em passos de 5% | |
| S85:S104 | Incidência | `=Proposta_Constr_Individual!X120…X139` | |
| Y85:Y104 | Execução na Obra | `=IF(S85=0;0;V85*S85*100/100)` | |
| Y105 (`Perc_Acumul`) | Mensurado Acumulado Atual | `=SUM(Y85:AA104)` | |
| Y106 | Mensurado acumulado no mês anterior | **U** | |
| Y108 | % Executado nessa etapa | `=Y105-Y106` | |
| W109 | Etapa de referência | `=IF($BN$96=0;"";$BN$96)` | |
| **U110** | Situação da obra - Cronog./Curva de Referência | `=$BN$98` | |
| **U111** | Situação da obra - Cronograma Proposto | `=BN100` | |
| G113 | Observações | U | |
| AS168 | Evolução inferior à referência por 3+ etapas consecutivas? | `=BN99` | |
| AS169 | % executado ultrapassa a evolução típica mensal? | `=IF(AND(AQ77<=264000;Y108*AQ77>AQ77*26);"Sim";IF(AND(AQ77>264000;AQ77<=500000;Y108*AQ77>AQ77*17);"Sim";IF(AND(AQ77>500000;Y108*AQ77>AQ77*14);"Sim";"Não")))`, ou seja, Y108 > 26, 17 ou 14 p.p. | |
| AS170:AS175, M172:M174 | Selo | U | |
| H301 | Local e data | U | |

### 4.2 Curva de evolução: AC95:AW167 (etapas 0–72)

Linha = 95 + etapa. As linhas 126–167 (etapas 31–72) ficam no grupo `GrupOn`, que a macro mostra quando PosRepro ≥ 31.

| Coluna | Rótulo | Conteúdo |
|--------|--------|----------|
| AC95 | Etapas | constante 0 |
| AC96:AC124 | | `=IF(AC95="";"";IF(AC95+1<=$AV$83;AC95+1;""))` |
| AC125 | | usa `$AV$82` |
| AC126:AC167 | | usa `PosRepro` |
| **AF95:AF167** | **Acumul. PLS** | **U** `#,##0.00` |
| **AJ95:AJ167** | **Acumul. Aferido** | **U** `#,##0.00`. Neste modelo é entrada, não fórmula |
| AO95 | Acumul. Adotado | `=IF(OR(AJ95="";AJ95=0);AF95;AJ95)` |
| AO96:AO167 | | `=IF(AND(AF96="";AJ96="");AO95;IF(OR(AJ96="";AJ96=0);AF96;AJ96))`. Repete o valor anterior até o fim |
| AT95:AT167 | Mês referência | `=IF($AC95="";"";$BK95)` |
| BK95 | | `=IF(AL79="";"";$AL$79)` |
| BK96… | | `=IF($BK$95="";"";IF(BC96="";"";EDATE($BK$95;BC96)))` |
| BC95:BC167 | | constantes 0…72 |
| BA95 / BA96:BA119 | proposto | `=Proposta!AS161` / `=Proposta!AI166…AI189` |
| BD95… | | `=AF95` (Acumul. PLS, **não** o adotado) |
| BG/BH/BI 95 | | constantes 0 |
| BG/BH/BI 96:120 | Curva Lenta/Normal/Rápida | `{=…VLOOKUP(BCn;'Curvas_padrão'!…;2/3/4;0)…}` com base em `$AQ$77` |
| BG/BH/BI 126… | | repetem a linha anterior |
| BJ | Executado | `=AOn` |
| **BL95:BL125** | situação na curva | `=IF(BJ95="";"";IF(BJ95<BG95;"OBRA LENTA";IF(BJ95>BI95;"OBRA RÁPIDA";"NORMAL")))` |
| BL126:BL167 | | mesma lógica com os textos "ATRASADA"/"ADIANTADA"/"NORMAL" |
| **BB95:BB119** | situação no cronograma proposto | `=IF(BA95=0;"";IF(BD95<(BA95-10);"ATRASADA";IF(BD95>(BA95+10);"ADIANTADA";"NORMAL")))` |
| BE | etapa efetiva | `=IF($AN$82="sim";ACn;BCn)` |
| BF95 | atraso por 3 etapas | `=IF(AND(AT96<=$AL$81<AT95;AO95<BG95);"Sim";"Não")` |
| BF97… | | `=IF(AND(BC97=$W$109;AO97<BG97;AO96<BG96;AO95<BG95);"Sim";"Não")` |
| BL89 (fim do contrato) | | `=IF(CronoRepro="sim";EDATE(AL79;PosRepro);BL91)` |
| BL91 | | `=EDATE(AL78;24)` |
| **BN95 / BN96** | etapa efetiva / prevista | `=Calculos_Cronograma!D6` |
| BN97 | Parcela prevista | `=Calculos_Cronograma!D9/100` |
| **BN98** | Situação da obra | `=IF($AL$81>$BL$89;"PRAZO EXTRAPOLADO";XLOOKUP($BN$95;BC96:BC132;BL96:BL132;"";0;1))` |
| BN99 | ATR_3 etapas | `=XLOOKUP(BN96;BC97:BC133;BF97:BF133;"";0;1)` |
| **BN100** | Situação CDC | `=IF($AL$81>$BL$89;"PRAZO EXTRAPOLADO";XLOOKUP($BN$95;BC96:BC119;BB96:BB119;"";0;1))` |

**Formatação condicional:**
- U110: "OBRA RÁPIDA", "OBRA LENTA" e "NORMAL" têm cores próprias.
- U111: "ADIANTADA", "ATRASADA" e "NORMAL" têm cores próprias.
- AS168 e AS169 são destacados quando valem "Sim".
- AT95:AT167, BK95:BK200, W109 e outras células têm a regra "=0" (obrigatório).

### 4.3 `Calculos_Cronograma`

| Célula | Fórmula | Situação |
|--------|---------|----------|
| **D6** | `=IF(AND(PLS!AL79<>"";PLS!AL81<>"");INT(DAYS360(PLS!AL79;PLS!AL81)/30);"Datas?")` | **É a única célula efetivamente usada pela PLS** (BN95/BN96). É a etapa da vistoria |
| D3 | `=PLS!Y105` | |
| D5 | `=D6` | |
| E5 | `=IFERROR(D5-3;0)` | |
| D8, D9 | `=VLOOKUP($D$5;PLS!$BC$96:$BD$200;2)` | Devolvem o Acumul. PLS, apesar dos rótulos "curva lenta/rápida". Só D9 é usada, em BN97 (legado) |
| D4, D16, D18 | referenciam `Proposta!AK197:AM220` | Essa área é o quadro da poligonal: referência obsoleta |
| E3 | contém `#REF!` | quebrada |
| L6:N6 | `YEAR/MONTH/DAY(PLS!AH79)` | AH79 está dentro do rótulo mesclado AC79:AK79: legado |
| D12 / E12 | referenciam PLS!AS92/AC83/AT92/AT83 | sem sentido; não são usadas |
| C21:H26 | | tabela textual de situações: adiantada, normal, em atenção, em risco de paralisação, paralisado ("inferior a 1% em 90 dias"). **Nenhuma fórmula a usa** |

### 4.4 Lógica de situação, em resumo

1. **Etapa da vistoria** `e = INT(DAYS360(início=AL79; levantamento=AL81)/30)`.
2. **Curva de referência (U110).**
   - Se AL81 > BL89, o resultado é **"PRAZO EXTRAPOLADO"**. BL89 = início + etapas repactuadas, se houve repactuação; senão, **contratação + 24 meses**.
   - Caso contrário, compara o **Acumul. Adotado** da etapa `e` (AO, aferido se houver, senão o PLS, repetindo o último) com as curvas da etapa `e` na faixa de AQ77:
     - menor que a lenta: **"OBRA LENTA"**;
     - maior que a rápida: **"OBRA RÁPIDA"**;
     - entre as duas: **"NORMAL"**.
   - Se `e` = 0 ou não for encontrada, o resultado é "".
3. **Cronograma proposto (U111).**
   - Mesmo teste de "PRAZO EXTRAPOLADO".
   - Depois compara o **Acumul. PLS digitado na linha da etapa `e`** (AF, não o adotado) com o proposto `Proposta!AI` da etapa `e`, com **tolerância de ±10 p.p.**:
     - abaixo de proposto − 10: "ATRASADA";
     - acima de proposto + 10: "ADIANTADA";
     - caso contrário: "NORMAL".
   - Se o proposto for 0, o resultado é "".
   - A busca só cobre as etapas 1–24.
4. **Atraso por 3 etapas (AS168).** "Sim" quando o adotado está abaixo da lenta na etapa `W109` e nas duas anteriores.
5. **Entradas necessárias para chegar a esses resultados:**
   - AL78 (contratação) e AL81 (vistoria);
   - AV78 (nº de etapas original) ou AN82/AV82 (repactuação);
   - AQ77 (valor do imóvel, para a faixa da curva);
   - AF/AJ por etapa (histórico de medições);
   - Proposta!AS161 e AI166:AI189 (cronograma proposto);
   - Y106 (acumulado anterior).

---

## 5. Campos obrigatórios, protegidos e de entrada na Proposta

- **Células desbloqueadas (entrada):** 199 na Proposta e 217 na PLS. Todas as outras estão travadas e a aba está protegida.
- **Obrigatórios:** o modelo marca com formatação condicional "valor = 0", que destaca célula vazia. Nas observações da planilha está escrito "todos os campos em roxo claro… precisam estar preenchidos".

Intervalos obrigatórios na Proposta:
- G44:AW44, G47:AW47, G50:AW50, G54:AW54, G56:AW56, G58:AB58, AD58:AP58, AQ58:AS58
- Q63, AL63, Q64:Q67, AR64
- G73:L73, N73, U73, AJ73, AR73, AC73, O74, S75
- N76:N77, X76:X77, L79, V79, Q80, AB81, AP81, G83:G84, Q84, AA84, AS84, N85, X85, S86, AH89, AS89, Y93, AE93, AS93
- M96, AM96:AW96, G98, V98, AC98:AW98, G100, V100, AC100:AO100, G102, V102, AC102, AI102, AP102, G104, O104, V104, AC104, G106, O106, V106, AC107, G108, O108, V108, AR109:AR110, G112
- AB120:AH138, X120:AL139, AB140:AH142, AN140, X141, I149:AE158, AG155
- T161, AS161, M163, AA163, AP164, G165, **AI166:AI190**
- G216, G245:G246, H258:Z258

Os campos condicionais (DATec, norma, fabricante, S86, AS89) só aparecem quando a macro exibe as linhas correspondentes.

Na PLS, os obrigatórios por CF "=0" são: S51, AQ77, AL78, **AV78**, AL81, AV82, AI87, **AS87**, Y106, G113, AT95:AT167, W109 e H301.

**Mensagens de obrigatoriedade por fórmula na Proposta:**

| Célula | Condição | Mensagem |
|--------|----------|----------|
| W63 | Q63 = "Falta" | "Item Obrigatório" |
| W64 | Q64 = "Não apresentado" | "Obrigatório 1ª desembolso" |
| W65, W66 | Q65 / Q66 = "Não apresentado" | "Item Obrigatório" |
| AO66 | Q67 = "Não apresentado" | "Obrigatório para análise da proposta." |
| AX74 | AK74 vazio, 0 ou 1 | "<==Informar Valor." |
| BP110 | AR109 = "Não" | "<== Resposta obrigatória." |
| AX112 | AR110 = "Sim" | "<== Descrição obrigatória." |
| BP140 | — | "<--Obrigatório indicar o tipo de Executor da obra" |
| BP141 | BDI acima do limite | "<--BDI ultrapassa limite de referência, necessário justificar" |
| BP163 | — | justificativa de prazo |
| AX120:AX139 | incidência fora da faixa AN–AS | "Excede máximo - justifique" / "Abaixo do mínimo" / "OK" |

**Outras fórmulas da Proposta:**
- `AC73 = G73+U73` (área construída)
- `X120… = IFERROR(100*AB120/$AB$140;0)` (incidência, `0.00`)
- `AI120 = X120` e `AI121 = X121+AI120`: acumulado das incidências, % Ac.
- `AB139 = $Z$159` e `Z159 = SUM(Z149:AE158)`: o item "Outros" é a soma dos adicionais
- `AB140 = SUM(AB120:AH139)`, `AB141 = X141*AB140%`, `AB142 = AB141+AB140`
- `AN141 = IF(AN140="Construtora";18;IF(AN140="Profissional Autônomo";6;IF(AN140="";"";0)))`: limite do BDI
- `AP150:AT152`: resumo de custos e custo por m²
- `AF259 = P_Ini`, `AF260 = AK44`, `AF264 = G50`, `AF265 = AK50`, `AQ265 = AB50&"/"&AI50`: assinaturas

---

## 6. Comparação com o sistema (Prospecta `server/caixa/*`, `shared/pci-gerador.ts`)

As versões gêmeas no Santa Fé estão em `web/src/lib/caixa/*` e `web/src/lib/pci-gerador.ts`.

### 6.1 Gerador de PCI (`shared/pci-gerador.ts` `CAMPOS_PCI` e `server/caixa/pci-gerador.ts`)

| Campo do sistema | Célula no sistema | Célula no Excel | Tipo no sistema | Excel | Situação |
|------------------|-------------------|-----------------|-----------------|-------|----------|
| rtpUf / rteUf / uf | AI47 / AI50 / AV56 | igual | texto | lista com 27 UFs | **virar seletor** |
| latitude (hemisfério) | X58 | igual | coordenada | lista N/S | ok; restringir a N/S |
| longitude (hemisfério) | **AC58** | AC58 é **rótulo travado constante "W"** | coordenada | — | **o sistema não deve gravar em AC58** |
| finalidade | AQ58 | igual | texto | lista com 4 opções | seletor |
| alvaraSituacao, artProjetoSituacao, artExecucaoSituacao | Q64, Q65, Q66 | igual | texto | Apresentado / Não apresentado | seletor |
| projetoLegalSituacao | Q67 | igual | texto | lista com 3 opções | seletor |
| terrenoProprio | AR64 | igual | texto | Sim / Não | seletor |
| **alvaraValidade** | **AF64** | **AH64** (AH64:AK64; AF64 fica dentro do rótulo AC64:AG64) | data | data | **corrigir a célula** |
| destinacao | O74 | igual | texto | Residencial / Comercial | seletor |
| sistemaConstrutivo | S75 | igual | texto | 14 opções | seletor; dispara campos condicionais |
| usoEps, montagemParedes, paredesEstruturais, tipoFormas, formasPermanecem | AB81, AP81, Q84, AA84, AS84 | igual | texto | listas (§2.1) | seletores |
| seloCasaAzul, docSeloCasaAzul | Y93, AS93 | igual | texto | Sim / Não / Não se aplica | seletores |
| padraoAcabamento, implantacao | M96, AM96 | igual | texto | listas | seletores |
| cobertura, teto, tipoVagas | G98, V98, AR98 | igual | texto | listas | seletores |
| pavimentos, quartos, suites, salas, vagas | AC98, AF98, AI98, AL98, AO98 | igual | **inteiro** | lista "0,1,2,3,4+" (pavtos: "1,2,3,4+") | **seletor com texto "4+"**. Hoje "4+" é impossível e um número 5 seria recusado no Excel |
| paredesExternas, loucasMetais, areaServico, cozinha | G100, V100, AC100, AI100 | igual | texto | listas | seletores |
| paredesInternas, paredesAreasSecas, calefacao, aguaQuente, itensSustentabilidade | G102, V102, AC102, AI102, AP102 | igual | texto | listas | seletores |
| revestParedeMolhadas, pisoAreasSecas, pisoAreasMolhadas | G104, O104, V104 | igual | texto | listas | seletores |
| esquadriasExternas | G106 | igual | texto | lista | seletor |
| esquadriasInternas | O106 | igual | texto | **sem lista** | manter texto livre |
| abastecimentoAgua, drenagem, esgoto, energiaAlternativa | V106, G108, O108, V108 | igual | texto | listas | seletores. O teste `server/pci-gerador.test.ts` usa esgoto "Rede pública", **fora da lista oficial** ("Rede de Esgoto") |
| esgotoDistancias, esgotoContaminacao | AR109, AR110 | igual | texto | Sim / Não | seletores; G112 obrigatório se AR110="Sim" |
| divisaoInterna, outrosEspecificar, especificacaoSistema, esgotoDescricao | AC104, AC107, Q80, G112 | igual | texto | livre | ok |
| custos 1–19 / adicionais | AB120:AB138 / I,Z149:158 | igual | número/texto | entrada | ok |
| bdi | X141 | igual | número | entrada; limite AN141 depende de AN140 | falta o executor |
| prazoMeses | T161 | igual | inteiro | entrada (≤24, alertas G162/Z161) | ok |
| cronograma[k] | AI166+k | igual | número | acumulado; General | ok. Ver §3: as validações da 06 são do sistema |
| localData | H258 | igual | texto | livre | ok |
| — | Q63 | Certidão de Matrícula | — | lista | **falta** |
| — | AL63 | Projeto Legal/Arquit. c/ divisões | — | lista | **falta** |
| — | AS89 | Doc. complementar do sistema inovador | — | lista | **falta** |
| — | N76, X76, N77, X77 | DATec (nº, detentor, validade, nome), quando inovador | — | livre | **falta** |
| — | L79, V79 | norma ABNT e título, quando "Outros" | — | livre | **falta** |
| — | G83 | fabricante/sistemista EPS, quando usoEps="Sim" | — | livre | **falta** |
| — | S86, X85, N85 | especificação e DATec das fôrmas EPS | — | livre | **falta** |
| — | AN140 | Executor da obra | — | Construtora / Profissional Autônomo | **falta** (define o limite do BDI: 18 ou 6) |
| — | AS161 | % pré-executado (etapa 0) | — | número ≤70 | **falta**. AI165 = AS161; hoje a etapa 0 fica sempre 0 |
| — | M163, AA163 | justificativa de prazo | — | Sim/Não + texto | **falta** |
| — | AG155 | justificativas de incidência fora da faixa | — | livre | **falta** |
| — | G165, G245 | obras pré-existentes; outras observações | — | livre | **falta** |

**Leitura (`server/caixa/pci.ts`, `lerPci`):**
- Lê corretamente a identificação (G44…AQ58), as incidências X120:X139 (localizadas pela coluna G), as faixas AN e AS, o cronograma AD/AI165:189 e a curva de referência AP165:189 (a curva normal).
- Na PLS lê BG/BH/BI95:167, S51, AQ77, AL78, AV78 (prazo), AI87, AS87 e AS170.
- Os valores das curvas são cache de fórmula. Ficam vazios se a PCI nunca teve AQ77 ou AK74 preenchido.

### 6.2 PLS (`server/caixa/medicao-xls.ts`, `medicao-pdf.ts`)

| Dado | Célula | Sistema hoje | Lacuna |
|------|--------|--------------|--------|
| Nº de etapas original | **AV78** | **não grava** | **Causa provável do problema da 08.** Com AV78 vazio (PCI gerada pelo sistema ou PLS limpa), AV83 = 0, AC96… ficam "", AT (mês referência) e AL80 (término) ficam vazios ou errados e a curva perde a etapa. Gravar `pci.prazoMeses` (T161) em AV78 |
| Valor do imóvel | AQ77 | só grava se conhecido | sem ele, BG/BH/BI = "" e não há status de curva. Bloquear a PLS ou avisar |
| Contratação | AL78 | só grava se conhecida | sem ela, AL79/AL80 ficam vazios, D6 = "Datas?" e a situação fica "". Sinalizar a falta, sem inventar data |
| Início | AL79 | sobrescreve a fórmula com `obra.inicio` | é uma decisão H6 que difere do modelo (contratação + 30). Documentar ou confirmar com o dono |
| Término | AL80 | cache ou sobrescrita | no modelo, `EDATE(AL79;AV83)` |
| Levantamento | AL81 | grava | ok |
| Repactuação | AN82 / AV82 | grava (minúsculas) | ok |
| Acumul. PLS | AF95+e | grava as medições por etapa (`curvaDeEvolucao`) | ok |
| Acumul. Aferido | AJ95+e | grava com `escreverSobreFormula`. Neste modelo **AJ é entrada**, então o caminho normal funciona | ok |
| Adotado / Mês ref. | AO / AT | só cache | ok (o Excel recalcula). O cache para depois da última medição, enquanto o Excel repete o último valor até o fim |
| Execução do item | V85:V104 | aceita qualquer % | **o Excel só aceita múltiplos de 5%** (lista). O seletor deveria ter passo de 5 |
| Acumulado anterior | Y106 | grava | ok |
| Data de vigência do alvará | AS87 | só grava se informada | é obrigatória (CF) e AS86 depende dela. Exigir ou sinalizar |
| Selo | AS170 | grava | AS171, M172:M174 e AS175 **não são preenchidos** |
| Etapa da vistoria | (Calc!D6) | `etapaDaData` = INT(DAYS360/30) | igual ao modelo |
| **Situação (curva)** | U110 = BN98 | `situacao(acumulado, lenta, rápida)` no PDF devolve "NORMAL"/"ATRASADA"/"ADIANTADA" usando o **acumulado da medição atual** | **diverge do Excel.** O Excel usa os textos "OBRA LENTA"/"OBRA RÁPIDA"/"NORMAL", compara o **adotado** da etapa `e` e tem a regra "PRAZO EXTRAPOLADO" (AL81 > BL89) |
| **Situação (proposto)** | U111 = BN100 | `situacao(acumulado, proposto)` sem tolerância | **diverge.** O Excel usa **±10 p.p.**, compara o AF da etapa `e`, devolve "" se o proposto = 0 e tem "PRAZO EXTRAPOLADO" |
| Atraso por 3 etapas / evolução típica | AS168 / AS169 | não reproduzidos no PDF | replicar (§4.2) |

---

## 7. Resumo das lacunas e próximos passos

1. **Correção 07.** Transformar em seletores todos os campos do §2.1 que hoje são texto livre ou inteiro.
   - Usar `pci-listas.json` com as `opcoes` exatas.
   - Tratar "4+" como opção de texto.
   - Corrigir AF64 → AH64.
   - Não gravar AC58.
   - Incluir os campos que faltam: Q63, AL63, AS89, DATec, norma, fabricante EPS, AN140, AS161, M163/AA163, AG155, G165 e G245.
   - Os campos condicionais devem seguir as regras de exibição das macros (§1.1).
2. **Correção 06.**
   - O Excel não valida faixa nem monotonicidade. Implementar no sistema: 0,00–100,00, não decrescente, última etapa (T161) = 100,00, duas casas decimais.
   - O incremental é a diferença consecutiva, com etapa 0 = AS161.
   - Reproduzir os avisos da coluna AX: lenta, rápida e incremento máximo de 23, 17 ou 14 quando há pré-executado.
3. **Correção 08.**
   - Gravar **AV78** = prazo.
   - Exigir ou sinalizar AQ77, AL78, AL81 e AS87.
   - Alinhar o cálculo de situação ao §4.4: textos, ±10, adotado vs. AF e "PRAZO EXTRAPOLADO" (BL89 = contratação + 24 meses, ou início + etapas repactuadas).
   - Restringir a execução do item a passos de 5%.
4. **Correção 10.**
   - Ao receber uma nova versão do modelo, reaplicar os scripts de extração (DV 0x01BE, NAME, FORMULA/SHRFMLA/ARRAY, CF 0x01B0/0x01B1, XF de travamento) e comparar com este JSON.
   - A leitura de DV e CF ainda **não existe** em `server/caixa/biff8.ts` e precisa ser portada.
   - O modelo tem fórmulas `IFS` e `XLOOKUP` (BIFF8 com `_xlfn.`) e VBA. A saída em .xls deve preservar os registros sem tentar recalcular.

### Status de teste

- (a) Automático: extração reproduzível. Foram encontrados 71 DVs, 173 nomes e todas as fórmulas foram decompiladas; nenhuma ficou sem origem resolvida.
- (b) Manual: os rótulos de Proposta e PLS foram conferidos célula a célula.
- (c) Pendente:
  - confirmar com um arquivo da versão "MYLCA ATUALIZADA" (.xlsb), se for diferente deste;
  - validar no Excel que o arquivo gerado mantém as DVs.
