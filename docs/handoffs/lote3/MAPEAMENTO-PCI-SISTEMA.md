# MAPEAMENTO-PCI-SISTEMA — modelo oficial da PCI ↔ sistema (Lote 03, correções 06, 07, 08 e 10)

> Derivado de `MAPEAMENTO-PCI.md` e `pci-listas.json` (Excel oficial da CAIXA, 29/10/2026) e do código atual.
> Os dois sistemas usam o mesmo mapa (paridade): Prospecta `shared/pci-gerador.ts`, `shared/pci-listas.ts`,
> `shared/pci-curvas.ts`, `server/caixa/*`; Santa Fé `web/src/lib/pci-gerador.ts`, `web/src/lib/pci-listas.ts`,
> `web/src/lib/pci-curvas.ts`, `web/src/lib/caixa/*`.
> As listas vêm de um módulo gerado do JSON (o teste `pci-lote3` confere módulo × JSON e campos × listas).

## 1. Proposta_Constr_Individual — campos do Gerador de PCI

| Aba | Célula | Campo | Tipo | Lista (opções exatas, exibidas sem espaços nas pontas) | Fórmula | Validação no sistema | Campo do sistema |
|-----|--------|-------|------|------|---------|-----------|------------------|
| Proposta_Constr_Individual | G44 | Proponente | texto livre | — | — | — | `proponenteNome` |
| Proposta_Constr_Individual | Y44 | E-mail | texto livre | — | — | — | `proponenteEmail` |
| Proposta_Constr_Individual | AK44 | CPF/CNPJ | CPF/CNPJ | — | — | — | `proponenteCpf` |
| Proposta_Constr_Individual | AQ44 | DDD | inteiro | — | — | — | `proponenteDdd` |
| Proposta_Constr_Individual | AS44 | Telefone | telefone | — | — | — | `proponenteTelefone` |
| Proposta_Constr_Individual | G47 | Nome do RTP | texto livre | — | — | — | `rtpNome` |
| Proposta_Constr_Individual | Q47 | E-mail | texto livre | — | — | — | `rtpEmail` |
| Proposta_Constr_Individual | AB47 | Nº CAU/CREA/CFT | registro | — | — | — | `rtpRegistro` |
| Proposta_Constr_Individual | AI47 | UF do registro | lista | AC · AL · AP · AM · BA · CE · DF · ES · GO · MA · MT · MS · MG · PA · PB · PR · PE · PI · RR · RO · RJ · RN · RS · SC · SP · SE · TO | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `rtpUf` |
| Proposta_Constr_Individual | AK47 | CPF | CPF/CNPJ | — | — | — | `rtpCpf` |
| Proposta_Constr_Individual | AQ47 | DDD | inteiro | — | — | — | `rtpDdd` |
| Proposta_Constr_Individual | AS47 | Telefone | telefone | — | — | — | `rtpTelefone` |
| Proposta_Constr_Individual | G50 | Nome do RTE | texto livre | — | — | — | `rteNome` |
| Proposta_Constr_Individual | Q50 | E-mail | texto livre | — | — | — | `rteEmail` |
| Proposta_Constr_Individual | AB50 | Nº CAU/CREA/CFT | registro | — | — | — | `rteRegistro` |
| Proposta_Constr_Individual | AI50 | UF do registro | lista | AC · AL · AP · AM · BA · CE · DF · ES · GO · MA · MT · MS · MG · PA · PB · PR · PE · PI · RR · RO · RJ · RN · RS · SC · SP · SE · TO | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `rteUf` |
| Proposta_Constr_Individual | AK50 | CPF | CPF/CNPJ | — | — | — | `rteCpf` |
| Proposta_Constr_Individual | AQ50 | DDD | inteiro | — | — | — | `rteDdd` |
| Proposta_Constr_Individual | AS50 | Telefone | telefone | — | — | — | `rteTelefone` |
| Proposta_Constr_Individual | G54 | Endereço | texto livre | — | — | — | `endereco` |
| Proposta_Constr_Individual | AJ54 | Complemento | texto livre | — | — | — | `complemento` |
| Proposta_Constr_Individual | G56 | Bairro | texto livre | — | — | — | `bairro` |
| Proposta_Constr_Individual | V56 | CEP | CEP | — | — | — | `cep` |
| Proposta_Constr_Individual | AA56 | Município | texto livre | — | — | — | `municipio` |
| Proposta_Constr_Individual | AV56 | UF | lista | AC · AL · AP · AM · BA · CE · DF · ES · GO · MA · MT · MS · MG · PA · PB · PR · PE · PI · RR · RO · RJ · RN · RS · SC · SP · SE · TO | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `uf` |
| Proposta_Constr_Individual | G58 | Matrícula | registro | — | — | — | `matricula` |
| Proposta_Constr_Individual | M58 | ORI (Registro de Imóveis) | texto livre | — | — | — | `cartorio` |
| Proposta_Constr_Individual | T58 | Latitude | coordenada | — | — | hemisfério N/S em X58 | `latitude` |
| Proposta_Constr_Individual | Y58 | Longitude | coordenada | — | — | hemisfério fixo W (AC58 é rótulo, não gravado) | `longitude` |
| Proposta_Constr_Individual | AD58 | Construtora (se houver) | texto livre | — | — | — | `construtora` |
| Proposta_Constr_Individual | AK58 | CNPJ da construtora | CPF/CNPJ | — | — | — | `cnpjConstrutora` |
| Proposta_Constr_Individual | AQ58 | Finalidade | lista | Aq.Terreno e Constr. FGTS · Constr.Terr.Próprio FGTS · Aq.Terreno e Constr. SBPE · Constr.Terr.Próprio SBPE | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `finalidade` |
| Proposta_Constr_Individual | Q63 | Certidão de matrícula do imóvel | lista | Apresentado · Não apresentado | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `certidaoMatricula` |
| Proposta_Constr_Individual | AL63 | Projeto legal/arquitetônico com divisões | lista | Apresentado · Não apresentado | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `projetoArquitetonico` |
| Proposta_Constr_Individual | Q64 | Alvará/Licença da obra | lista | Apresentado · Não apresentado | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `alvaraSituacao` |
| Proposta_Constr_Individual | AH64 | Validade do alvará | data | — | — | — | `alvaraValidade` |
| Proposta_Constr_Individual | AR64 | Terreno é próprio | lista | Sim · Não | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `terrenoProprio` |
| Proposta_Constr_Individual | Q65 | ART/RRT/TRT de projeto | lista | Apresentado · Não apresentado | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `artProjetoSituacao` |
| Proposta_Constr_Individual | AF65 | Número da ART de projeto | texto livre | — | — | — | `artProjetoNumero` |
| Proposta_Constr_Individual | Q66 | ART/RRT/TRT de execução | lista | Apresentado · Não apresentado | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `artExecucaoSituacao` |
| Proposta_Constr_Individual | AF66 | Número da ART de execução | texto livre | — | — | — | `artExecucaoNumero` |
| Proposta_Constr_Individual | Q67 | Projeto legal aprovado | lista | Apresentado projeto aprovado · Apresentado comprovação de Licenciamento Declaratório · Não apresentado | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `projetoLegalSituacao` |
| Proposta_Constr_Individual | G73 | Área coberta padrão (m²) | número | — | — | — | `areaCoberta` |
| Proposta_Constr_Individual | N73 | Área permeável (m²) | número | — | — | — | `areaPermeavel` |
| Proposta_Constr_Individual | U73 | Área acessória coberta (m²) | número | — | — | — | `areaAcessoria` |
| Proposta_Constr_Individual | AJ73 | Área do terreno (m²) | número | — | — | — | `areaTerreno` |
| Proposta_Constr_Individual | AR73 | Valor proposto do terreno (R$) | número | — | — | — | `valorTerreno` |
| Proposta_Constr_Individual | O74 | Destinação do imóvel | lista | Residencial · Comercial | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `destinacao` |
| Proposta_Constr_Individual | AK74 | Valor proposto do imóvel (R$) | número | — | — | — | `valorImovel` |
| — | — | Valor financiado (R$) — informativo, só no PDF | número | — | — | só no PDF | `valorFinanciado` |
| Proposta_Constr_Individual | M96 | Padrão de acabamento | lista | Baixo · Normal · Alto | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `padraoAcabamento` |
| Proposta_Constr_Individual | AM96 | Implantação/Inserção | lista | Isolada · Isolada(parte empr.não-condom.) · Condomínio | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `implantacao` |
| Proposta_Constr_Individual | G98 | Cobertura | lista | Telha Metálica c/ Platibanda · Telha Metálica s/ Platibanda · Telha de Fibrocimto. c/ Platibanda · Telha de Fibrocimto. s/ Platibanda · Telha de Cerâmica/Con… | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `cobertura` |
| Proposta_Constr_Individual | V98 | Teto | lista | Telha aparente · Forro · Laje · Laje+Forro · Outros | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `teto` |
| Proposta_Constr_Individual | AC98 | Pavimentos | lista | 1 · 2 · 3 · 4+ | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `pavimentos` |
| Proposta_Constr_Individual | AF98 | Quartos | lista | 0 · 1 · 2 · 3 · 4+ | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `quartos` |
| Proposta_Constr_Individual | AI98 | Suítes | lista | 0 · 1 · 2 · 3 · 4+ | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `suites` |
| Proposta_Constr_Individual | AL98 | Salas | lista | 0 · 1 · 2 · 3 · 4+ | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `salas` |
| Proposta_Constr_Individual | AO98 | Vagas | lista | 0 · 1 · 2 · 3 · 4+ | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `vagas` |
| Proposta_Constr_Individual | AR98 | Tipo de vagas | lista | Coberta(s) · Descoberta(s) | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `tipoVagas` |
| Proposta_Constr_Individual | G100 | Acabamento paredes externas | lista | Sem revestimento · Pintura/Textura/Grafiato · Pint./Text./Grafto. e det. em Pedra/Cerâmica · Cerâmica/Porcelanato · Outros | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `paredesExternas` |
| Proposta_Constr_Individual | V100 | Louças e metais | lista | Linha Popular · Linha Média · Linha Luxo | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `loucasMetais` |
| Proposta_Constr_Individual | AC100 | Área de serviço | lista | Não · Interna · Externa coberta · Externa descoberta | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `areaServico` |
| Proposta_Constr_Individual | AI100 | Cozinha | lista | Cozinha · Cozinha+A.Serviço · Cozinha+Copa · Cozinha americana | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `cozinha` |
| Proposta_Constr_Individual | G102 | Acabamento paredes internas | lista | Sem revestimento · Pintura/Textura/Grafiato · Pint./Text./Grafto. e det. em Pedra/Cerâmica · Cerâmica/Porcelanato · Outros | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `paredesInternas` |
| Proposta_Constr_Individual | V102 | Paredes/painéis áreas secas | lista | Alvenaria · Gesso · Madeira · Concreto · Aço · Outros | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `paredesAreasSecas` |
| Proposta_Constr_Individual | AC102 | Calefação | lista | Sim · Não | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `calefacao` |
| Proposta_Constr_Individual | AI102 | Água quente | lista | Não · Aquecimento solar · Aquecimento à gás | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `aguaQuente` |
| Proposta_Constr_Individual | AP102 | Itens de sustentabilidade | lista | Sim · Não | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `itensSustentabilidade` |
| Proposta_Constr_Individual | G104 | Revest. parede áreas molhadas | lista | Cimentado · Cerâmica Comercial · São Tomé · Emborrachado · Granita · Formicado · Porcelanato 2ª · Granito/Mármore 2ª · Pintura/Textura · Grafiato · Cerâmica … | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `revestParedeMolhadas` |
| Proposta_Constr_Individual | O104 | Revest. piso áreas secas | lista | Cimentado · Cerâmica Comercial · Pedra · Vinílico · Emborrachado · Porcelanato 1ª · Porcelanato 2ª · Laminado · Granito/Mármore · Outros | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `pisoAreasSecas` |
| Proposta_Constr_Individual | V104 | Revest. piso áreas molhadas | lista | Cimentado · Cerâmica Comercial · Pedra · Porcelanato 1ª · Porcelanato 2ª · Granito/Mármore · Outros | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `pisoAreasMolhadas` |
| Proposta_Constr_Individual | AC104 | Divisão interna (ambientes) | texto livre | — | — | — | `divisaoInterna` |
| Proposta_Constr_Individual | G106 | Esquadrias externas | lista | Alumínio · Ferro · Vidro Temperado · PVC · Madeira · Outros | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `esquadriasExternas` |
| Proposta_Constr_Individual | O106 | Esquadrias internas | texto livre | — | — | — | `esquadriasInternas` |
| Proposta_Constr_Individual | AC107 | Outros (especificar) | texto livre | — | — | — | `outrosEspecificar` |
| Proposta_Constr_Individual | S75 | Sistema construtivo | lista | Conv:Alvenaria estrutural · Conv:Estrut Concreto, Aço ou Madeira/Vedação blocos cerâmico · Conv:Estrut Concreto, Aço ou Madeira/Vedação blocos concreto · Con… | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `sistemaConstrutivo` |
| Proposta_Constr_Individual | N76 | DATec — nº | texto livre | — | — | condicional (macro do modelo) | `datecNumero` |
| Proposta_Constr_Individual | X76 | DATec — detentor | texto livre | — | — | condicional (macro do modelo) | `datecDetentor` |
| Proposta_Constr_Individual | N77 | DATec — validade | texto livre | — | — | condicional (macro do modelo) | `datecValidade` |
| Proposta_Constr_Individual | X77 | DATec — nome do sistema | texto livre | — | — | condicional (macro do modelo) | `datecSistema` |
| Proposta_Constr_Individual | L79 | Norma ABNT (nº) | texto livre | — | — | condicional (macro do modelo) | `normaAbnt` |
| Proposta_Constr_Individual | V79 | Norma ABNT (título) | texto livre | — | — | condicional (macro do modelo) | `normaTitulo` |
| Proposta_Constr_Individual | Q80 | Especificação do sistema construtivo | texto livre | — | — | — | `especificacaoSistema` |
| Proposta_Constr_Individual | AB81 | Previsão de uso de EPS | lista | Sim · Não | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `usoEps` |
| Proposta_Constr_Individual | AP81 | Montagem/fabricação das paredes | lista | Pré-fabricadas em canteiro · In loco · Em fábrica | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `montagemParedes` |
| Proposta_Constr_Individual | G83 | Fabricante/sistemista do EPS | texto livre | — | — | condicional (macro do modelo) | `fabricanteEps` |
| Proposta_Constr_Individual | Q84 | Paredes com função estrutural | lista | Sim · Não | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `paredesEstruturais` |
| Proposta_Constr_Individual | AA84 | Tipo de fôrmas | lista | Madeira · Aço · EPS · Alumínio · Não se aplica | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `tipoFormas` |
| Proposta_Constr_Individual | AS84 | Fôrmas permanecem nas paredes | lista | Sim · Não · Não se aplica | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `formasPermanecem` |
| Proposta_Constr_Individual | AS89 | Apresentou doc. complementar do sistema inovador | lista | Sim · Não · Não se aplica | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `docSistemaInovador` |
| Proposta_Constr_Individual | Y93 | Optante pelo Selo Casa Azul | lista | Sim · Não · Não se aplica | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `seloCasaAzul` |
| Proposta_Constr_Individual | AS93 | Documentação complementar do selo | lista | Sim · Não · Não se aplica | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `docSeloCasaAzul` |
| Proposta_Constr_Individual | V106 | Abastecimento d'água | lista | Concessionária · Poço · Outra | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `abastecimentoAgua` |
| Proposta_Constr_Individual | G108 | Drenagem | lista | Rede de Água Pluvial · Interna ao terreno · Outra | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `drenagem` |
| Proposta_Constr_Individual | O108 | Coleta/tratamento de esgoto | lista | Rede de Esgoto · Fossa e Filtro · Fossa e Sumidouro · Outra | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `esgoto` |
| Proposta_Constr_Individual | V108 | Geração alternativa de energia | lista | Nenhuma · Fotovoltaica · Eólica · Outra | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `energiaAlternativa` |
| Proposta_Constr_Individual | AR109 | Esgoto atende localização e distâncias | lista | Sim · Não | — | opção exata da lista (fora dela bloqueia salvar/gerar); condicional (macro do modelo) | `esgotoDistancias` |
| Proposta_Constr_Individual | AR110 | Solução impede contaminação | lista | Sim · Não | — | opção exata da lista (fora dela bloqueia salvar/gerar); condicional (macro do modelo) | `esgotoContaminacao` |
| Proposta_Constr_Individual | G112 | Descrição da solução de esgoto | texto livre | — | — | condicional (macro do modelo) | `esgotoDescricao` |
| Proposta_Constr_Individual | AN140 | Executor da obra | lista | Construtora · Profissional Autônomo | — | opção exata da lista (fora dela bloqueia salvar/gerar) | `executor` |
| Proposta_Constr_Individual | X141 | BDI (%) | número | — | — | aviso acima do limite AN141 (18/6) | `bdi` |
| Proposta_Constr_Individual | AG155 | Justificativa (incidências/BDI fora da referência) | texto livre | — | — | — | `justificativaIncidencias` |
| Proposta_Constr_Individual | T161 | Prazo de execução (meses) | inteiro | — | — | 1 a 24 meses (G162) | `prazoMeses` |
| Proposta_Constr_Individual | AS161 | Obra pré-executada — etapa 0 (%) | número | — | — | 0 a 70% (AX161) | `preExecutado` |
| Proposta_Constr_Individual | M163 | Tem justificativa para o prazo? | lista | Sim · Não | — | opção exata da lista (fora dela bloqueia salvar/gerar); condicional (macro do modelo) | `justificativaPrazo` |
| Proposta_Constr_Individual | AA163 | Justificativa técnica do prazo | texto livre | — | — | condicional (macro do modelo) | `justificativaPrazoTexto` |
| Proposta_Constr_Individual | G165 | Obras pré-existentes (descrição) | texto livre | — | — | — | `obrasPreExistentes` |
| Proposta_Constr_Individual | G245 | Outras observações | texto livre | — | — | — | `observacoes` |
| Proposta_Constr_Individual | H258 | Local e data (assinatura) | texto livre | — | — | — | `localData` |
| Proposta_Constr_Individual | AB120:AB138 | Custos dos serviços 1–19 | número (R$) | — | — | ≥ 0 | `custos[]` |
| Proposta_Constr_Individual | I149:I158 / Z149:Z158 | Serviços adicionais (descrição/custo) | texto / número | — | Z159 = SUM(Z149:AE158); AB139 = Z159 | — | `adicionais[]` |
| Proposta_Constr_Individual | X120:X139 | Incidência (%) | fórmula | — | IFERROR(100*AB/AB140;0) | cache gravado pelo sistema | calculado (`calcularTotaisPci`) |
| Proposta_Constr_Individual | AB140 / AB141 / AB142 | Total, BDI, total com BDI | fórmula | — | SUM; X141*AB140%; AB141+AB140 | cache gravado | calculado |
| Proposta_Constr_Individual | AN141 | Limite do BDI | fórmula | — | Construtora 18; Profissional Autônomo 6 | cache gravado; aviso se BDI > limite sem justificativa (AG155) | `limiteBdiPci` |
| Proposta_Constr_Individual | AI165 | Acumulado da etapa 0 | fórmula | — | =AS161 | cache = pré-executado | `analisarCronogramaPci().etapa0` |
| Proposta_Constr_Individual | AI166:AI189 | % acumulado proposto, etapas 1..T161 | número (2 casas) | — | (entrada) | 0,00–100,00; não decrescente (etapa 0 = AS161); última etapa = 100,00; "101.000" lido como 101000 e rejeitado; bloqueia salvar (valor inválido) e gerar (também vazio/≠100) | `cronograma[]` |
| Proposta_Constr_Individual | AD166:AD189 | Nº da etapa | fórmula | — | 1..T161 | cache gravado (1..prazo) | calculado |
| Proposta_Constr_Individual | AX166:AX189 | Aviso da etapa | fórmula | — | incremento > 23/17/14 p.p. com pré-executado; senão acima da curva rápida / abaixo da lenta | aviso não bloqueante por etapa | `analisarCronogramaPci().avisos` |
| Proposta_Constr_Individual | — (tela/PDF) | % da etapa (incremental) | calculado | — | AI(k) − AI(k−1) | nunca soma acumulados | `analisarCronogramaPci().incrementais` |
| Proposta_Constr_Individual | Z161 / G162 | Alerta de prazo | fórmula | — | prazo > 24, > etapa 100% da lenta, < etapa 100% da rápida | aviso; mostra M163/AA163 | `alertaPrazoPci` |
| Curvas_padrão | B22:Q45 | Curvas lenta/normal/rápida, faixas 1–3 | tabela | — | faixa pelo valor do imóvel (≤264.000; >500.000) | recalculadas no sistema (não usa cache) | `shared/pci-curvas.ts` |

## 2. PLS — medição

| Aba | Célula | Campo | Tipo | Lista | Fórmula | Validação no sistema | Campo do sistema |
|-----|--------|-------|------|-------|---------|-----------|------------------|
| PLS | S51 | Nº do contrato | número | — | — | "pendente" no PDF se faltar | `dados.pls.numeroContrato` |
| PLS | AQ77 | Valor do imóvel | número | — | — | define a faixa das curvas; "pendente" se faltar (reserva: Proposta!AK74) | `dados.pls.valorImovel` / `pci.valorImovel` |
| PLS | AL78 | Contratação | data | — | — | "pendente" se faltar (nunca inventada) | `dados.pls.dataContratacao` |
| PLS | AV78 | Nº de etapas original | inteiro | — | — | gravado = prazo da PCI (T161) | `pci.prazoMeses` |
| PLS | AL79 / AL80 | Início / término previsto | fórmula | — | contratação+30; EDATE(AL79;AV83) | início do Editar Obra (decisão H6) ou contratação+30; "pendente" se faltar | `calcularPls().inicio/termino` |
| PLS | AL81 | Data do levantamento | data | — | — | obrigatória | `dados.pls.dataLevantamento` |
| PLS | AN82 / AV82 | Repactuação / etapas repactuadas | lista sim/não / inteiro | sim · não | — | etapas obrigatórias se "sim" | `houveRepactuacao` / `etapasRepactuadas` |
| PLS | AU84, AS85, AS88, AS89 | Perguntas de qualidade | lista | sim · não | — | — | `condicoesContratadas`, `placaAfixada`, `projetoCumprido`, `prevencaoDanos` |
| PLS | AI87 / AS87 | Emissão / vigência do alvará | data | — | AS86 = AL81 ≤ AS87 | vigência: PLS → reserva Proposta!AH64 (Gerador); "pendente" se faltar | `alvaraEmissao` / `alvaraVigencia` |
| PLS | V85:V104 | Execução do item | lista | 0% … 100% (passo 5%) | — | aviso se não for múltiplo de 5% | `execucoes[]` (Progresso) |
| PLS | AF95:AF167 | Acumul. PLS | número | — | — | executado declarado por etapa (medições desta obra) | `curvaDeEvolucao().pls` |
| PLS | AJ95:AJ167 | Acumul. Aferido | número | — | — | medições anteriores confirmadas como recebidas pela CAIXA (`received_at`/`recebidaEm`); sem confirmação fica vazio e o PDF sinaliza | `curvaDeEvolucao().aferido` |
| PLS | AO95:AO167 | Acumul. Adotado | fórmula | — | aferido (≠0) senão PLS, repete o anterior | recalculado | `curvaDeEvolucao().adotado` |
| PLS | BL89 | Fim do contrato | fórmula | — | repactuação: EDATE(AL79;AV82); senão EDATE(AL78;24) | recalculado | `situacaoDaPls().fimContrato` |
| PLS | U110 (=BN98) | Situação — curva de referência | fórmula | — | PRAZO EXTRAPOLADO; adotado < lenta → OBRA LENTA; > rápida → OBRA RÁPIDA; senão NORMAL (etapas 31+: ATRASADA/ADIANTADA) | recalculado no servidor; cache gravado no .xls | `situacaoDaPls().situacaoCurva` |
| PLS | U111 (=BN100) | Situação — cronograma proposto | fórmula | — | PRAZO EXTRAPOLADO; AF da etapa vs Proposta!AI ±10 p.p. → ATRASADA/ADIANTADA/NORMAL; proposto 0 → vazio | recalculado no servidor | `situacaoDaPls().situacaoProposto` |
| PLS | AS168 | 3 etapas abaixo da lenta | fórmula | — | adotado < lenta na etapa e nas 2 anteriores | recalculado | `situacaoDaPls().atraso3Etapas` |
| Calculos_Cronograma | D6 | Etapa da vistoria | fórmula | — | INT(DAYS360(AL79;AL81)/30) | igual | `etapaDaData` |

## 3. Alteração_Projeto_Especific (usadas pelo sistema)

| Aba | Célula | Campo | Tipo | Lista | Validação | Campo do sistema |
|-----|--------|-------|------|-------|-----------|------------------|
| Alteração_Projeto_Especific | P82 | Novo sistema construtivo | lista | 13 opções (JSON `P82:AW82`) | opção exata | `OPCOES_SISTEMA_CONSTRUTIVO` |
| Alteração_Projeto_Especific | Q72 | Alteração de área | lista | Sim · Não · Não se aplica | opção exata | `OPCOES_ALTERA_AREA` |
| Alteração_Projeto_Especific | Q64, V81, R86 | Sim/Não | lista | Sim · Não | opção exata | `SIM_NAO` |
| Alteração_Projeto_Especific | Q75, Q79 | Cômodos / serviços | lista | Inclusão · Exclusão · Não se aplica | opção exata | `OPCOES_COMODOS_SERVICOS` |
| Alteração_Projeto_Especific | P85, AB85, AU85, AN118, AT88 | Montagem, fôrmas, incorporadas, executor, doc. | lista | conforme JSON | opção exata (AT88 gravado em minúsculas) | `OPCOES_MONTAGEM`, `OPCOES_FORMAS`, `OPCOES_FORMAS_INCORPORADAS`, `OPCOES_EXECUTOR` |

## 4. Versões do modelo (correções 09b e 10)

- Saída sempre `.xls` (BIFF8). Modelo atual `.xlsm`/`.xlsb` → usa a versão `.xls` não excluída mais recente com as mesmas abas e células-chave (`xlsCompativelCom`); sem ela, bloqueia com "Envie a versão .xls do modelo oficial".
- Envio de versão: lê abas, células-chave (entrada/fórmula/ausente) e listas (DV 0x01BE no `.xls`; `dataValidation`/`x14:dataValidation` no `.xlsm`; `.xlsb` sem listas), compara com a versão atual e com `pci-listas` e guarda o relatório (`compat_report` / `relatorioCompatibilidade`). Mudança crítica (aba da proposta/PLS ausente, célula do mapeamento que deixou de ser entrada, lista de campo do sistema alterada) → versão fica "aguardando confirmação" até o admin confirmar.
- Exclusão por versão: lógica (`deleted_at`/`excluidoEm` + autor), não exclui a atual, prévia com nº de PCIs geradas que usam a versão, arquivo preservado (download da versão usada continua), auditoria em `pci_model_audit` / `pci_modelo_auditoria`.
