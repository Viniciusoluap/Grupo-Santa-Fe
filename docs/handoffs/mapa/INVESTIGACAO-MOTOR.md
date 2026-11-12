# Investigação — motor e fontes do mapa do terreno (pedido do dono, 11/11/2026)

> Documento idêntico em `Prospecta/docs/handoffs/mapa/` e `Grupo-Santa-Fe/docs/handoffs/mapa/`.
> Pontos de teste: **A** −5,47310 −47,53452 (Imperatriz/MA, margem do Tocantins) e **B** −5,50963 −47,44423.
> Terreno de teste = quadrado de 700 m × 700 m (49 ha) centrado em cada ponto. Todos os testes abaixo foram feitos
> neste ambiente em 11/11/2026 (respostas gravadas em `__fixtures__/camadas-terreno/`).

## 1. Motor do concorrente (Lotelytics) — evidência

Baixamos só o HTML/JS **público** de `https://lotelytics.com/` (sem login):

| Evidência | Onde |
|---|---|
| `assets/vendor-mapbox-BlWtfM7g.js` (1,66 MB) = **Mapbox GL JS v3.16.0** (string `"3.16.0"`, `mapbox-gl-js/building-gen`, `draco_decoder`) | bundle de vendor |
| `style:"mapbox://styles/mapbox/satellite-streets-v12"` (mapa do estudo) e `mapbox://styles/mapbox/standard` | `UrbanDesignStudio-*.js`, `KMZMapViewer-*.js` |
| Token buscado numa *edge function* Supabase `get-mapbox-token` e guardado no `localStorage` (`useMapboxToken-*.js`) | token público da conta deles |
| UCs: `const bi=[{nome:"CNUC/MMA via IBAMA (Pamgia)",url:…lim_unidades_conservação_mma_a/MapServer/0/query?…&f=geojson}, {nome:"CNUC/MMA via IBAMA (SIGAGEO)",…/SIGAGEO/bases/MapServer/19/query…}, {nome:"ICMBio via INDE (só federais)", …geoservicos.inde.gov.br…WFS}]` com `AbortSignal.timeout(15e3)` — tentativa em cascata | `UrbanDesignStudio-*.js` |
| Geologia: raster `geoportal.sgb.gov.br/…/gestaoterritorial/geodiversidade_estados/MapServer/export?bbox={bbox-epsg-3857}…` | idem |
| Furos: fonte `"SIAGAS · Serviço Geológico do Brasil"`, camada `siagas-pocos` | `VarreduraAmbiental-*.js` |
| APP e vegetação nativa: `"FBDS (APP e vegetação nativa)"`, funções `process-fbds-job` / `check-fbds-status` por município (processamento no backend deles) | `TerrainRestrictionsSection-*.js` |
| Servidões: `powerline … fonte:"OpenStreetMap; largura conforme norma"`, `"OpenStreetMap (faixas de domínio de rodovia, ferrovia e linha de transmissão)"`, função `analyze-roads` | idem |
| Mananciais/APAs estaduais: geoservers estaduais (`datageo.ambiente.sp.gov.br`, `geo.sema.mt.gov.br`, `siga.meioambiente.go.gov.br`, `geoserver.inema.ba.gov.br`, `ide.geobases.es.gov.br`, `catalogo.ipe.df.gov.br`) + função `consultar-mananciais` | `UrbanDesignStudio-*.js` |

**Conclusão:** o concorrente usa **Mapbox GL JS** (satélite Mapbox/Maxar até z22) + dados públicos (CNUC/Pamgia, SGB, SIAGAS,
FBDS pré‑processado por município, OSM). Adotamos **MapLibre GL JS** (fork aberto do Mapbox GL, mesma API/renderização WebGL,
sem chave). Validação cruzada: com a mesma fonte SIAGAS obtivemos para o ponto A **“15 furos · 1,7–4,9 km”** — o print do
concorrente mostra “15 furos · 1,6–4,8 km”.

## 2. Nitidez — por que estava borrado e o que mudou

* `tilemap` da Esri World Imagery (`…/World_Imagery/MapServer/tilemap/{z}/{y}/{x}/1/1?f=json`) no ponto A e B: **foto real até z17**;
  em z18+ a Esri devolve o ladrilho‑aviso “Map data not yet available” (2.521 bytes). Em Nova York há foto até z20, em São Paulo até z19.
* Antes: Leaflet com ladrilho 256 px e `maxNativeZoom: 17` fixo → em tela retina cada pixel da foto virava 2×2 (e acima de 17, 4×4…).
* Agora: MapLibre consulta o `tilemap` (z17…z22) e usa como `maxzoom` da fonte o **maior nível com foto real** da região;
  em tela retina usa `tileSize: 128` (a tela pede o nível seguinte, foto 2× mais densa) e não amplia mais que 2 níveis além do nativo.
* Com **token público do Mapbox** (opcional, Admin › Integrações › Mapbox) usa `mapbox.satellite` em `@2x` (512 px, até z22).
  Sem token tudo funciona com a Esri. Atribuição: “© Mapbox © OpenStreetMap © Maxar” / “Imagens © Esri, Maxar, Earthstar Geographics”.
* Limite real: no interior do MA a Esri só tem foto de ~1,2 m/pixel (z17). Nitidez acima disso só com imagem de outro provedor (Mapbox).

## 3. Fontes por camada (consulta exata)

Todas por `query` ArcGIS REST com `geometry=<oeste,sul,leste,norte>&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=<campos>&returnGeometry=true&outSR=4326&geometryPrecision=6&f=geojson`,
bbox = terreno + folga. Código: `camadas-terreno.ts` (`FONTES`, `FOLGA_M`) e `camadas-terreno-busca.ts`.

| Camada | Fonte principal (URL base) | Campos | Espelho | Folga | Resultado no ponto A |
|---|---|---|---|---|---|
| Trechos de drenagem | ANA/SNIRH BHO 2017 1:5k `www.snirh.gov.br/arcgis/rest/services/SPR/BHO2017_5K_TRECHODRENAGEM/MapServer/0` | `NORIOCOMP,NUSTRAHLER,DEDOMINIAL` | DNIT via Pamgia `01_Publicacoes_Bases/hid_trecho_drenagem_l/MapServer/5` (`nome,larguramed`) | 600 m | 3 trechos (Rio Tocantins ordem 7) — 1,5 s |
| Massas d'água (rio largo como polígono) | ANA/SNIRH `SPR/Massa_dagua/MapServer/0` | `nmoriginal,detipomass` | ANA via Pamgia `BasesSincronizadas/lim_bho_massa_dagua_ana_p/MapServer/0` | 600 m | 1 polígono “Rio Tocantins” (122 kB, recortado no servidor) |
| Nascentes | derivadas da BHO: 1º vértice de trecho de ordem 1 que não encosta em outro (a BHO é orientada no sentido do fluxo) + `natural=spring` do OSM | — | — | 600 m | B: 1 nascente |
| APP hídrica | **calculada** (Código Florestal art. 4º I e IV) sobre ANA + OSM: largura do rio medida no polígono oficial (2·área/perímetro, antes do recorte) ou estimada pela ordem de Strahler (≤2→5 m; 3–4→25 m; 5–6→100 m; ≥7→300 m); nascente 50 m; une tudo, tira a lâmina d'água e mede dentro do terreno | — | — | — | A: faixa 500 m (Tocantins ~1,9 km de largura), 11,6% do terreno |
| Vegetação nativa / supressão | **MapBiomas Coleção 2023** servido pela EPE `gisepeprd2.epe.gov.br/arcgis/rest/services/MapBiomas_2023/MapServer/identify` (multiponto; grade ≤ 80 pontos, lado ≥ 30 m) | `UniqueValue.Pixel Value` (classe) | — | — | A: 98% pastagem / 1,6% formação florestal; B: 12,5% nativa |
| Unidades de conservação | CNUC/MMA via IBAMA (Pamgia) `BasesSincronizadas/lim_unidades_conservação_mma_a/MapServer/0` | `nome_uc,categoria,esfera,grupo` | SIGAGEO `SIGAGEO/bases/MapServer/21,20,22` (federal/estadual/municipal — a 19 do concorrente é *group layer*) | 3 km | A e B: nenhuma a 3 km; teste MS: RPPN Arara Azul a 1,1 km |
| Linhas de transmissão | EPE Webmap `SMA/ENG_Webmap_EPE_Sistema_Eletrico_Existente/MapServer/9` | `Nome,Tensao` (kV) | IBAMA SIGA Geo `21_SIGA_Geo/linha_transmissao/MapServer/0` (sem tensão; lê “xxx kV” do nome) + OSM `power=line` (`voltage`) como complemento | 250 m | perto de A (−5,418 −47,479): LT 230 kV e 500 kV |
| Rodovias / faixa de domínio | DNIT/SNV via Pamgia `BasesSincronizadas/line_rodovias_federais_dnit_l/MapServer/0` | `vl_br,sg_uf,ds_jurisdi,ds_legenda` | OSM (vias, só desenho) | 250 m | BR‑010 na região (não a 250 m de A) |
| Geologia / geodiversidade | SGB/CPRM `geoportal.sgb.gov.br/server/rest/services/gestaoterritorial/geodiversidade_estados/MapServer/identify` com o **polígono do terreno** (`esriGeometryPolygon`, `layers=all`) | `SIGLA_UNID,NOME_UNIDA,LITOTIPO1/2,DOM_GEO,RELEVO,DECLIVIDAD,GR_COER` | — | — | A: Formação Codó + Depósitos aluvionares → “atenção: várzea”; B: Codó → “favorável” |
| Furos/poços | SGB SIAGAS `hidrologia/SIAGAS_MODDAD/MapServer/0` | `str_nome_ponto,str_natureza_ponto,num_profundidade,ne,str_aquifero` | — | 5 km (raio do centro) | A: 15 poços 1,7–4,9 km, NE mediano 29,7 m |
| OSM (complemento) | Overpass `overpass-api.de` → espelho `overpass.kumi.systems` (`waterway`, `natural=water`, `riverbank`, relações de água, `natural=spring`, `highway`, `power`) | tags | — | 600 m | **neste ambiente: timeout / HTTP 429** → legenda mostra “indisponível · tentar de novo”, o resto segue |

### Regras de faixa usadas (documentadas no código)

* **APP** (Lei 12.651/2012, art. 4º): rio < 10 m → 30 m; 10–50 → 50; 50–200 → 100; 200–600 → 200; > 600 → 500; nascente → raio 50 m.
  O seletor manual (30…500 m) continua (ex.: lei municipal de Imperatriz, 500 m no Tocantins).
* **Faixa de servidão de LT** (largura TOTAL, eixo no centro) — não há largura fixa em lei; a concessionária calcula pela ABNT NBR 5422
  (flecha, balanço do cabo, distâncias de segurança) e vale a escritura/decreto de utilidade pública. Valores de referência usuais de
  mercado adotados: ≤ 34,5 kV → 15 m; 69 kV → 20 m; 138 kV → 30 m; 230 kV → 40 m; 345 kV → 50 m; 440 kV → 60 m; 500 kV → 70 m;
  > 525 kV → 100 m; tensão não informada → 40 m (como 230 kV). **Confirmar sempre com a concessionária.**
* **Rodovia federal**: faixa de domínio de referência 35 m de cada lado do eixo (o DNIT define por trecho — confirmar) + 15 m não
  edificáveis de cada lado (Lei 6.766/79, art. 4º, III, red. Lei 13.913/2019).
* **Geologia** (leitura simples como o “Geologia (CPRM) favorável” do concorrente): coerência “duras/muito duras” → “rocha: alto”;
  “médias” ou rochas cristalinas → “rocha: atenção”; planície de inundação/aluvião → “atenção: várzea”; senão “favorável”.

### Licença / atribuição

ANA/SNIRH (dados abertos, citar ANA), IBAMA/Pamgia (CNUC/MMA, DNIT/SNV — dados públicos federais), EPE Webmap (citar EPE),
MapBiomas (CC BY 4.0 — “Projeto MapBiomas, Coleção 2023”), SGB/CPRM (dados públicos, citar SGB), OpenStreetMap (ODbL, “© OpenStreetMap”),
Esri World Imagery (uso conforme termos Esri, atribuição na tela), Mapbox (só com token do cliente; termos Mapbox, atribuição na tela).

## 4. O que NÃO foi possível (e por quê)

* **CAR/SICAR (vegetação nativa, reserva legal, APP declarada)**: `geoserver.car.gov.br` responde 200, mas o GetCapabilities WFS/WMS
  **não publica nenhuma camada** anonimamente e `sicar:*` dá *InvalidParameterValue*. Substituído pelo MapBiomas (via EPE).
  O Pamgia tem `CAR_NACIONAL/Cadastro_Ambiental_Rural__Área_Imóvel_` (só o perímetro do imóvel, não a vegetação) — não usado.
* **FBDS** (base do concorrente para APP/vegetação): `geo.fbds.org.br` não está liberado aqui; é download por município (shapefile),
  exigiria pré‑processamento. Pendência se o dono quiser a mesma base.
* **ICMBio via INDE** (`geoservicos.inde.gov.br`) — host bloqueado neste ambiente; usamos o SIGAGEO do próprio Pamgia como espelho.
* **ANEEL SIGEL** (`sigel.aneel.gov.br`) — timeout aqui; a EPE cobre as LTs da Rede Básica com tensão. Distribuição (MT) só via OSM.
* **Overpass** (`overpass-api.de`, `overpass.kumi.systems`) — timeout / HTTP 429 neste ambiente. Em produção costuma responder;
  o mapa não depende dele (é complemento).
* **Zona de manancial / APAs estaduais** (cartões do concorrente): não há serviço nacional; o concorrente usa geoservers estaduais
  (SP, MT, GO, BA, ES, DF) — nenhum cobre MA/TO/PA e os hosts não estão liberados. Fica como pendência.
* **Ferrovias / dutos** (o concorrente usa OSM): não incluídos nesta etapa (o Pamgia tem `line_ferrovias_federais_dnit_l` e
  `21_SIGA_Geo/duto` — próximo passo natural).
* **Satélite mais nítido que z17 sem Mapbox**: não existe na Esri para o interior do MA. Esri Clarity/Wayback e Google exigem
  outros hosts/contratos.

## 5. Hosts usados (todos liberados neste ambiente)

`server.arcgisonline.com` (satélite, tilemap, rótulos), `www.snirh.gov.br`, `pamgia.ibama.gov.br`, `gisepeprd2.epe.gov.br`,
`geoportal.sgb.gov.br`, `overpass-api.de` / `overpass.kumi.systems` (complemento), `api.mapbox.com` (só com token),
`tile.openstreetmap.org` (botão “Ruas”, já usado antes). **Nenhum host extra é necessário.**

## 6. Segunda etapa (11–12/11/2026) — o que tinha ficado de fora e como entrou

| Item | Como entrou | Fonte (testada ao vivo) | Limite que continua valendo |
|---|---|---|---|
| **CAR/SICAR** | Camada `car`: `identify` com o polígono do terreno no serviço do IBAMA — uma requisição cobre as 27 camadas (uma por UF). Mostra os imóveis do CAR que sobrepõem o terreno (código, situação, % do terreno) e confere com o nº do CAR informado no cadastro do estudo. | `pamgia.ibama.gov.br/…/CAR_NACIONAL/Cadastro_Ambiental_Rural__Área_Imóvel_/MapServer/identify` (~2 s). Ponto A: 4 imóveis cobrindo 100% do terreno. | A base pública traz só o **perímetro do imóvel**. Reserva legal, APP e vegetação declaradas no CAR não são publicadas sem login no SICAR — a vegetação continua vindo do MapBiomas. |
| **Mananciais** | Camada `mananciais`: captações de abastecimento público (superficiais e subterrâneas) e massas de água usadas para abastecimento, a até 5 km, com distância. | ANA, Atlas Águas: `AtlasAguas2020/captacoes/MapServer/0 e 1` e `Atlas2020/Massa_dagua_abastecimento/MapServer/0`. Perto de Imperatriz: captação superficial "Rio Tocantins" a ~2 km. | **Zona de proteção de manancial** é definida por lei estadual/municipal e não existe em base nacional (nem estadual para MA/TO/PA). O mapa mostra onde estão os mananciais; o limite legal da zona tem de ser confirmado na prefeitura/órgão estadual. APAs já aparecem na camada de UCs. |
| **Ferrovias** | Camada `ferrovias` + faixa. | DNIT via IBAMA `BasesSincronizadas/line_ferrovias_federais_dnit_l/MapServer/0` (espelho: `21_SIGA_Geo/ferrovia`). Testado: Ferrovia Norte-Sul (FNS) em João Lisboa/MA. | Só ferrovias federais. |
| **Dutos** | Camada `dutos` + faixa. Traçados "indicativos" (estudo da EPE) ficam de fora. | EPE `SMA/Webmap_EPE_Infraestrutura_de_Gas_Natural/MapServer/5, 6, 7` (transporte, distribuição, escoamento) + IBAMA `21_SIGA_Geo/duto` (oleodutos licenciados). Testado: GASBOL em Paulínia/SP. | O servidor da EPE é lento (~9 s por camada); prazo de 40 s só nesta camada. |
| **Larguras legais** | Cada item de faixa diz o que é **lei** e o que é **referência**, e tem um campo para o dono informar a **largura confirmada** (concessionária, DNIT, escritura), salva no estudo. | Lei 6.766/79, art. 4º: III (rodovia, 15 m não edificáveis de cada lado, redutível a 5 m por lei municipal), III-A (ferrovia, 15 m) e § 3º (dutos: definida no licenciamento). | Faixa de domínio por trecho (DNIT) e servidão de LT por linha (ANEEL) não são publicadas em serviço acessível: `servicos.dnit.gov.br` e `sigel.aneel.gov.br` não responderam neste ambiente. Por isso a largura de domínio/servidão é referência até ser confirmada. |
| **Estudo de Massa** | Passou para o mesmo motor MapLibre (`mapa-base-ml.ts`, compartilhado com o mapa do Terreno): satélite Mapbox quando há token, senão Esri no zoom nativo real. `camadas-base.ts` (Leaflet) foi removido. | — | O mapa operacional (Admin › Mapa) continua em Leaflet. |

### Regras de faixa (substituem as da seção 3)

| Elemento | Padrão usado | Base |
|---|---|---|
| Rodovia federal | 35 m de domínio + 15 m não edificáveis de cada lado (100 m no total) | 15 m: lei. 35 m: referência |
| Ferrovia | 15 m de domínio + 15 m não edificáveis de cada lado (60 m no total) | 15 m não edificáveis: lei. Domínio: referência |
| Duto | 20 m no total | referência (lei remete ao licenciamento) |
| Linha de transmissão | tabela por tensão (seção 3) | referência |
| Qualquer item | largura total informada pelo dono | confirmada |

Persistência: Prospecta `incorporation_studies.terrain_widths_json` (migração 0102); Santa Fé `estudos_incorporacao.largurasFaixaJson`
(migração `20261111210000_larguras_faixa_terreno`). Formato: `{"rod:BR-010": 80, "fer:Açailândia - Porto Nacional": 60}`.
