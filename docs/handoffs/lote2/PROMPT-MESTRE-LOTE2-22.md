# PROMPT MESTRE AIOX — LOTE 02 — 22 CORREÇÕES (v2.0, 26/10/2026)

> Texto do dono, versionado em 27/10/2026 para continuidade. Execução, merge e deploy AUTORIZADOS pelo dono em 27/10 ("Autorizo tudo, inclusive merge e deploy. Pare somente quando finalizar").
> Status vivo: `docs/handoffs/lote2/MASTER_STATUS.md`. Trabalho paralelo do Codex (16 correções: WhatsApp/BPO/Projetos) na branch `codex/aiox-16-correcoes-20261026` — não sobrepor.

## 1. Missão
Auditar, planejar, implementar, integrar e testar as 22 correções nos sistemas Prospecta Construções e Grupo Santa Fé, preservando funcionalidades, mantendo paridade e respeitando diferenças técnicas/visuais. TODO PROGRESSO SALVO CONTINUAMENTE EM HANDOFFS VERSIONADOS. Handoff Mestre por repositório com tabela das 22 correções (Pendente / Em auditoria / Em implementação / Implementada / Testada / Publicada / Bloqueada), SHA, branch, data, agente, próximos passos e dependências. Sem reset destrutivo, force push ou exclusão de trabalho de outros agentes. Não dizer que está salvo no GitHub quando estiver só local.

## 2. Regras gerais
AIOX com etapas especializadas; identificar estrutura real; preservar dados, auth, permissões, APIs e integrações; sem dados fictícios em produção; não remover além do pedido; soluções estruturais; reutilizar componentes; sem regras duplicadas; testar desktop, tablet, mobile e PWA; equivalência nos dois sistemas; sem migração destrutiva sem backup/reversão; sem segredos em logs; correção só concluída se funcionar e passar nos testes; priorizar dependências.

## 3. Correções

01 — Remover PLS em XLS (Obras › Progresso › Histórico de Medições): remover geração, botões de download e envio por e-mail da PLS XLS; manter PLS PDF; preservar histórico, percentuais, fotos, solicitações, recebimentos e documentos já gerados. PCI continua em Excel (não remover geração/edição/upload/envio de PCI XLS). Aceite: novos registros de PLS só PDF; PCI intacta.

02 — Fotos em Detalhes da Obra: mesma apresentação da galeria por medições do Editar Obra (nº da medição, % executado na medição, % acumulado, qtd de fotos, fotos com legendas), usando arquivos/metadados existentes, sem duplicar armazenamento. Gestão continua no fluxo Progresso/Medições; visualização consolidada em Detalhes.

03 — Gerador de PCI: em Editar Obra a aba "Fotos" vira "Gerador de PCI". Em Integrações, botão "Sub PCI atual" para importar versão atualizada da planilha oficial CAIXA (XLS, XLSM, XLSB; avaliar macros, fórmulas, validações, imagens, mescladas, áreas de impressão); armazenar versões dos modelos; não reconstruir arbitrariamente. Formulário preenche: proponente/cadastro, RT projeto, RT execução, CREAs, terreno/imóvel, matrícula/cartório, documentação técnica, áreas e características, padrão/memorial, sistema construtivo, instalações/infra, custos, cronograma físico-financeiro, imagem de localização, demais campos do modelo. Preenchimento automático com dados do cliente, endereços, valor da obra, financiamento, dados técnicos/financeiros; seleção do engenheiro alimenta RT (sem inventar CREA). Gera XLS (preservando estrutura do modelo) e PDF (mesmos dados, paginação). Download das duas versões e histórico por obra. Aceite: PCI consistente nos dois formatos, sem alterar o envio de PCI existente.

04 — Perfil Engenheiro (Configurações › Usuários): herda comportamento do Colaborador (permissões por módulo). Dados: nome, e-mail, telefone, endereço completo, nº CREA, UF do CREA, CREAs adicionais de outros estados. Documentos com upload múltiplo classificado (documento pessoal, anuidade CREA, carteirinha CREA, outros): enviar vários, visualizar, baixar individual, baixar todos em ZIP, substituir, excluir com confirmação, consultar quando autorizado; armazenamento permanente; download entrega o original. Integrar a Projetos, Obras, Gerador de PCI e Incorporação; selecionar engenheiro carrega dados sem redigitar.

05 — Mapa Operacional: satélite com ruas/referências, nitidez, enquadramento automático, alfinetes no lugar dos círculos marrons, tratamento de sobrepostos, agrupamento que se separa no zoom, identificação de imóveis e obras. Preservar busca, filtros, tabela, coordenadas, status, vínculos, regras de inclusão. Provedor compatível com licenças; não inventar coordenadas.

06 — Incorporação sem KML (Terreno): checkbox "Este empreendimento não possui KML": continuar sem KML, liberar etapas bloqueadas só pela ausência, lotes avulsos em quadras distintas, persistir, permitir KML depois. Desmarcado: fluxo convencional. Funções que exigem geometria indicam que não há poligonal (sem inventar medidas). Não substitui obrigações documentais.

07 — Projeto Aprovado → Projetos: todo processo de projeto salvo na incorporação gera registro em Projetos (nome, empreendimento, órgão, engenheiro, prazo, status, checklist, documentos, editar/revisar/excluir). Sincronização bidirecional dos dados compartilhados; separar andamento técnico interno de situação de aprovação externa; sem duplicar ao salvar/editar/reabrir; não exige lead do CRM.

08 — Dados Gerais: "Nome do estudo" → "Nome do empreendimento"; Responsável = seleção de usuário (Administrador, Colaborador, Engenheiro) salvo por ID; remover do formulário Matrícula do imóvel, Registro CAR, Zoneamento oficial, Fonte oficial do zoneamento (preservar dados históricos no banco).

09 — Redesenho completo da Incorporação (cabeçalho, identificação, progresso, menu de etapas, cards, formulários, tabelas, botões, checklists, uploads, modais, indicadores, navegação): moderno, premium, responsivo, coerente com cada marca. NÃO altera funcionalidades, cálculos, integrações, abas ou serviços (salvo outra correção). Validar desktop, tablet, smartphone, PWA.

10 — Estudo de Massa Generativa: Terreno mantém upload KML com mapa melhor (satélite, ruas, poligonal, zoom, camadas, nitidez, informações verificadas). Estudo de Massa: planta urbanística estimada a partir da poligonal real (contorno, proporção, curvas/recortes, orientação/limites, vias e quadras dentro, lotes proporcionais, nada ultrapassa a poligonal, áreas não parceláveis), em unidades métricas e SRS apropriado, sem imagem genérica. Cálculos separados: área bruta, pública, verde, institucional, sistema viário, APP, supressão vegetal, faixa de transmissão, faixa de servidão, demais não parceláveis, área líquida vendável, qtd de lotes, área média, taxa de aproveitamento, VGV; sem sobreposição/subtração duplicada. Cenários por testada/profundidade, área mínima, largura de vias, quadras, grid, cul-de-sac quando aplicável, topografia/irregularidades, parâmetros configuráveis; planta e resultados por cenário; se inviável, informar motivo. Referência funcional Lotelytics (sem copiar). Sempre identificado como estudo preliminar.

11 — Salvar Cenários de verdade: cenários, parâmetros, planta, poligonal de referência, lotes, VGV, indicadores, distribuição de áreas, usuário, data, versão. Seção "Estudos Salvos": abrir, editar, salvar nova versão, selecionar cenário principal, excluir com confirmação (preserva os demais; não apaga geometria; verificar dependências de unidades/orçamentos/viabilidade). Persistência após recarregar, nova sessão, outro dispositivo.

12 — Orçamento Parametrizado integrado (Dados Gerais, Terreno, Topografia, Estudo de Massa, cenário selecionado, lotes, áreas, infraestrutura, quantidades), método conforme tipo de empreendimento (não confundir área vendável de lotes com área de construção). Importação Excel: ler itens, descrições, unidades, quantidades, unitários, totais, fórmulas; conferência/correção do mapeamento; importar confirmados; preservar arquivo original; editar e baixar; integrar à Viabilidade. Não sobrescrever silenciosamente importados; sem dupla contabilização.

13 — Negociação do Terreno: sem sobreposição de Data, Autor, Tipo, Status; desktop horizontal, tablet quebra colunas, mobile empilhado.

14 — Projeto Aprovado: sem sobreposição/corte em Órgão, Protocolo, Prazo Previsto, Status, Observações, Ações; legível em todos os tamanhos; preserva Correção 07.

15 — Unidades à Venda automáticas: ao selecionar e salvar cenário, gerar as unidades (50 lotes = 50 unidades), identificação individual, vínculo com empreendimento e cenário, sem duplicar, atualização controlada se o cenário mudar, preservando vendas/reservas. Comprador: cliente do CRM (carrega dados e valor negociado cadastrado, editável) ou nome avulso. Status Disponível / Reservado / Vendido com permissões e histórico.

16 — Unidades: máscara BRL em tempo real (1.000.000,00); Editar (comprador, valor, status); Excluir com confirmação (verificar contratos, clientes, cobranças em reservadas/vendidas); atualização de cenário não recria unidade excluída; integridade e histórico.

17 — Planejamento do Lançamento: sem sobreposição entre Data Realizada e Status; conferir Marco, Data Prevista, Responsável, botões, menus; mobile em cartões quando a tabela prejudicar; mesma solução estrutural de 09/13/14.

18 — Fornecedores: máscara BRL na digitação; cálculos corretos com todos os valores no orçamento; separar Total Orçado e Total Contratado; somatórios atualizam em incluir/editar/excluir/mudar status; preservar relação com custos da Viabilidade.

19 — 19.1 Fornecedores: trocar indicador percentual "Contratados" por "Valor Total Orçado" (soma de todos); manter "Valor Total Contratado" (só status Contratado). 19.2 Material Publicitário: trocar "Em Aprovação" por "Valor Total Orçado"; campo de valor orçado por peça; somar todos independentemente do status; manter indicador de aprovados. 19.3 Atendimento aos Clientes: Cliente = CRM ou avulso; Unidade = unidades reais do empreendimento com status e comprador; registrar atendimento não muda status comercial da unidade.

20 — Viabilidade: quadro "Terreno & Urbanístico" carrega o cenário selecionado e salvo do Estudo de Massa (área bruta, pública, verde, institucional, viário, APP, servidão, outras restrições), mesma base de cálculo, conversões corretas, sem duplicar, atualiza ao trocar cenário, persiste, identifica ajustes manuais, protege contra sobrescrita; indicadores dependentes atualizados.

21 — Formatação numérica global (os dois sistemas): ponto de milhar, vírgula decimal, 2 casas (1.000.000,00 · 0,52 · 0,00), máscara durante a digitação sem perder foco; valores financeiros, áreas, preços, percentuais, índices, juros e taxas quando compatível. Não alterar valor armazenado; não reduzir precisão interna; preservar precisões técnicas maiores quando exigidas; não mexer em datas, documentos, códigos, IDs, contagens inteiras; negativos, zero, grandes, colagem; cursor estável (inclusive iPhone); compatível com importações/exportações. Componente numérico reutilizável único.

22 — Relatórios: remover a seção "Relatórios" do fim da Viabilidade Econômica e levá-la à aba Incorporação › Relatório Executivo: 1ª seção "Relatório Executivo Completo da Incorporação" (o atual, preservado); 2ª seção "Relatórios da Viabilidade e Negociação" com (1) Relatório Executivo da Viabilidade, (2) Relatório de Custos, (3) Relatório do Terreneiro — individualizados, mesmos públicos/dados/cálculos/modelos/downloads; Terreneiro sem informação interna/confidencial; sem alterar cálculos.

## 4. Dependências
04 → 03 → 07 · 06 → 10 → 11 → 12, 15, 20 · 15 → 16 → 19 · 21 é base de 16, 18 e campos financeiros · 09 coordenada com 13, 14, 17 · 22 por último. Paralelizar só o independente, sem conflito de arquivos, migrações e modelos.

## 5. Fases
1 Auditoria e baseline · 2 Arquitetura e planejamento · 3 Fundações (formatação numérica, engenheiros, integrações de dados, persistência de cenários, KML opcional, estruturas financeiras, base de documentos/modelos da PCI) · 4 Operacionais (PCI, fotos, mapas, estudo de massa, orçamento, unidades, projetos, viabilidade, fornecedores, publicidade, atendimento, relatórios) · 5 Design e responsividade · 6 Testes e auditoria final (build, typecheck, lint, unit, integração, E2E, persistência, permissões, upload/download, fórmulas, vínculos, geometria, responsividade, regressões, performance, equivalência; por correção: critério, resultado, evidência, commit, pendências; não marcar aprovado por suposição) · 7 Entrega, merge e deploy (validar remotos, conflitos, PRs, migrações, envs, rollback, testes finais, handoffs; registrar URLs, versões, SHAs, smoke tests).

## 6. Matriz de aceite
01 PLS só PDF; PCI XLS preservada · 02 Fotos por medição em Detalhes · 03 PCI XLS e PDF · 04 Engenheiro com CREAs, documentos e downloads · 05 Mapa satélite e alfinetes · 06 Com ou sem KML · 07 Projetos sincronizados sem duplicação · 08 Dados Gerais simplificados · 09 Redesenho sem perda funcional · 10 Planta proporcional ao KML e cálculos corretos · 11 Cenários salvos/recuperáveis/editáveis/excluíveis · 12 Orçamento integrado e importação Excel · 13 Negociação sem sobreposição · 14 Projeto Aprovado responsivo · 15 Unidades geradas e ligadas ao CRM · 16 Valores e edição/exclusão de unidades · 17 Planejamento responsivo · 18 Fornecedores somados · 19 Indicadores orçados e atendimento integrado · 20 Viabilidade sincronizada · 21 Formatação numérica consistente · 22 Relatórios na aba correta.

## 7. Economia e continuidade
Ler handoffs primeiro; reaproveitar diagnósticos; não repetir builds sem necessidade; testes por módulo; agentes só quando agregam; decisões registradas na hora; checkpoints pequenos; não duplicar componente em andamento por outro agente; ao interromper, handoff com próximo passo exato (comandos, arquivos, pendências); com limite de créditos, priorizar publicar progresso e handoff.

## 8. Entrega
Por repositório: concluídas, parciais, bloqueadas, arquivos, migrações, commits/PRs, testes aprovados e pendentes, merge, deploy, handoffs, próximo passo. Só evidências reais.
