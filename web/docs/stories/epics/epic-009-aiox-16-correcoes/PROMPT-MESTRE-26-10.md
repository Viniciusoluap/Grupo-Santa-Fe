# PROMPT MESTRE AIOX — PROSPECTA CONSTRUÇÕES E GRUPO SANTA FÉ

> Texto enviado pelo dono em 27/10/2026, versionado para continuidade entre agentes (o original não estava no repositório).
> Situação de cada correção: ver `MATRIZ-16-CORRECOES.md` nesta pasta e o `HANDOFF-26-10-AIOX-16-CORRECOES.md` na raiz.

Versão: 1.0 — 26/10/2026
Escopo: 16 correções e implementações
Repositórios: Prospecta Construções e Grupo Santa Fé
Metodologia: AIOX, auditoria, implementação, testes, Handoff e entrega controlada.

## MISSÃO PRINCIPAL

Auditar, planejar, implementar e testar as 16 correções especificadas neste documento nos repositórios Prospecta Construções e Grupo Santa Fé.

Preservar todas as funcionalidades existentes e manter a paridade funcional entre os dois sistemas, respeitando suas diferenças técnicas, arquiteturais e operacionais.

REGRA MÁXIMA E INEGOCIÁVEL: TODO PROGRESSO DEVE SER SALVO CONTINUAMENTE EM HANDOFFS VERSIONADOS DENTRO DE CADA REPOSITÓRIO, PARA GARANTIR CONTINUIDADE PELO CHATGPT, CHATGPT WORK, CLAUDE OU OUTRO AGENTE, SEM DEPENDER DO HISTÓRICO DA CONVERSA.

A elaboração deste prompt não autoriza alterações. A execução deverá começar somente após autorização explícita do proprietário dos repositórios.

## 1. PROTOCOLO OBRIGATÓRIO DE CONTINUIDADE

### 1.1. Auditoria inicial dos repositórios

Antes de modificar qualquer arquivo:

1. Identificar os repositórios corretos no GitHub e confirmar suas URLs.
2. Consultar a branch principal e a branch de trabalho atual.
3. Comparar HEAD local e remoto.
4. Executar a verificação de git status.
5. Identificar alterações locais não commitadas.
6. Consultar os últimos commits e branches ativos.
7. Consultar PRs abertos, aprovados ou recentemente integrados.
8. Ler os arquivos CLAUDE.md, AGENTS.md e demais instruções existentes, quando disponíveis.
9. Localizar os Handoffs já produzidos.
10. Verificar alterações de outros agentes, especialmente Claude.
11. Identificar funcionalidades já implementadas, evitando retrabalho.
12. Verificar ambientes de desenvolvimento, homologação e produção.

Não presumir que os arquivos locais representam o estado mais recente do GitHub.

### 1.2. Proteção do trabalho existente

É proibido:

- Executar git reset --hard sobre trabalho não identificado.
- Utilizar git push --force para sobrescrever trabalho de terceiros.
- Apagar branches ou arquivos de outros agentes sem autorização.
- Substituir implementações funcionais sem necessidade demonstrada.
- Recriar funcionalidades já concluídas.
- Alterar credenciais, integrações ou variáveis de ambiente desnecessariamente.
- Fazer migrações destrutivas sem backup e estratégia de recuperação.

Se houver trabalho paralelo, utilizar branches ou worktrees isolados.

Verificar conflitos antes de aplicar cada alteração importante.

### 1.3. Handoff obrigatório e contínuo

Em cada repositório, identificar e reutilizar a estrutura de Handoff existente. Se não houver uma convenção estabelecida, criar:

- docs/handoff/ACTIVE.md
- docs/handoff/CHANGELOG.md
- docs/handoff/IMPLEMENTATION_STATUS.md
- docs/handoff/TEST_RESULTS.md

Manter registros históricos versionados quando necessário.

O Handoff deverá informar:

- Repositório e branch.
- HEAD e commit de referência.
- Data e identificação da sessão.
- Objetivo atual.
- Correções concluídas.
- Correções em andamento.
- Correções pendentes.
- Arquivos modificados.
- Estruturas de banco alteradas.
- Migrações aplicadas ou pendentes.
- APIs e integrações envolvidas.
- Decisões arquiteturais.
- Testes executados e resultados.
- Erros identificados.
- Bloqueios e dependências.
- Próximos comandos e etapas.
- Commits e PRs correspondentes.
- Situação de merge e deploy.
- Instruções para outro agente continuar.

CHECKPOINTS OBRIGATÓRIOS — atualizar os registros:

1. Antes de iniciar cada correção.
2. Após alterações estruturais relevantes.
3. Depois de cada correção implementada.
4. Depois dos testes.
5. Antes e depois de commits importantes.
6. Antes e depois de PRs, merges ou deploys.
7. Sempre que houver risco de interrupção da sessão.
8. Ao finalizar cada etapa de execução.

Sempre que possível e autorizado, publicar esses checkpoints por commits e push no repositório remoto, de modo que fiquem acessíveis fora da sessão atual.

Um Handoff apenas local não deve ser apresentado como progresso seguramente salvo no GitHub.

Não registrar senhas, tokens, dados pessoais desnecessários nem segredos nos Handoffs.

### 1.4. Retomada entre agentes

Ao receber uma nova sessão:

1. Ler o Handoff mais recente.
2. Confirmar sua correspondência com a branch e o HEAD remoto.
3. Identificar alterações posteriores ao Handoff.
4. Recuperar o estado real do trabalho.
5. Continuar exatamente da etapa pendente.
6. Não repetir tarefas já validadas.
7. Atualizar o Handoff ao concluir novos avanços.

Se houver divergências entre Handoff e repositório, prevalecerá a análise do estado real do código.

## 2. CORREÇÕES DO WHATSAPP

### CORREÇÃO 01 — Reorganizar conexões WhatsApp

Mover da aba Integrações para: Painel de Controle → Serviços → WhatsApp

Os dois quadros:

- Minha Conexão WhatsApp.
- Conexões dos Corretores.

Preservar números, sessões, estados de conexão, permissões e controles existentes.

Remover os quadros da localização antiga, sem duplicar funcionalidades.

Reaproveitar os componentes e serviços já implementados.

Aceite: os quadros funcionam integralmente na nova localização, sem necessidade de reconectar os números.

### CORREÇÃO 02 — Identificação correta das conversas

Atualmente, números diferentes podem aparecer com o nome do proprietário da conexão.

Corrigir a identificação considerando esta prioridade:

1. Nome do contato registrado no CRM ou cadastro disponível.
2. Nome público informado pelo contato no WhatsApp, quando disponibilizado pela integração.
3. Número telefônico, caso nenhum nome confiável esteja disponível.

Nunca utilizar o nome do proprietário da sessão como substituto da identidade do contato.

Aplicar na listagem de conversas, cabeçalho e pesquisa.

Aceite: contatos diferentes não recebem indevidamente o mesmo nome; números sem identificação confiável aparecem como número telefônico.

### CORREÇÃO 03 — Navegação ao visualizar documentos

Ao abrir PDFs e arquivos recebidos nas conversas, deve existir um caminho evidente para retornar ao atendimento.

Implementar visualização com botão Voltar à conversa ou fechamento de visualizador interno.

Preservar:

- Conversa selecionada.
- Posição de rolagem.
- Estado do atendimento.
- Histórico de mensagens.

Validar em iPhone, Android, navegador e PWA.

Aceite: abrir e fechar documentos sem perder a conversa atual.

### CORREÇÃO 04 — Reformular todos os templates

Reescrever profissionalmente os templates existentes:

- Captação — Boas-vindas ao lead.
- Acompanhamento — Follow-up 48h.
- Agenda — Confirmação de visita.
- Negociação — Envio de proposta.
- Financiamento — Atualização do financiamento.
- Documentação — Lembrete de documentos.

Adotar textos comerciais objetivos, profissionais, personalizados e orientados à ação.

O template de captação deverá ser mais elaborado, transmitir confiança e estimular o início do atendimento.

Remover a variável {{servico}} do template de captação.

Exemplo inicial:

"Olá, {{nome}}! Tudo bem?

Sou {{corretor}}, da {{empresa}}.

Recebemos seu contato e será um prazer ajudar você a encontrar a melhor solução para seu objetivo.

Nosso atendimento é personalizado, e quero entender melhor sua necessidade para apresentar as possibilidades mais adequadas e orientar você durante todo o processo.

Podemos começar com algumas perguntas rápidas?"

Os demais modelos deverão ser igualmente revisados, respeitando sua finalidade.

Adaptar automaticamente a identidade da empresa, conforme Prospecta ou Grupo Santa Fé.

### CORREÇÃO 05 — Seleção inteligente de serviços nos templates

Sempre que existir {{servico}} ou {{servicos}} em um template:

- Exibir uma lista selecionável dos serviços disponíveis.
- Permitir seleção individual ou múltipla.
- Utilizar um checklist semelhante ao já existente para documentos.
- Preencher a mensagem somente com os serviços selecionados.
- Não inserir todos os serviços automaticamente.
- Atualizar a prévia imediatamente.
- Validar variáveis antes do envio.

A lista deverá utilizar os serviços reais cadastrados, sem duplicar definições.

O template de captação continuará sem a variável de serviço, conforme a Correção 04.

### CORREÇÃO 06 — Corrigir confirmação de visita

Reestruturar o template de agendamento.

Manter: Nome; Horário.
Adicionar: Dia/data da visita.
Remover do template padrão: Endereço.

Campos de dia e horário deverão aparecer no formulário de envio.

Exemplo: "Olá, {{nome}}! Sua visita está confirmada para o dia {{dia}}, às {{horario}}. Qualquer dúvida, estou à disposição!"

Validar o preenchimento dos campos obrigatórios e atualizar a prévia antes do envio.

### CORREÇÃO 07 — Transformar Templates em gerenciador

A aba Templates passará a servir exclusivamente para gerenciar os modelos de mensagens.

Funcionalidades:

- Criar novo template.
- Editar template existente.
- Salvar alterações.
- Organizar por finalidade.
- Definir nome e conteúdo.
- Validar variáveis.
- Visualizar prévia.
- Aplicar permissões conforme perfil de usuário.

Os templates serão utilizados na aba Enviar mensagem.

Preservar os templates existentes por migração controlada.

Não apagar os modelos atuais antes de garantir suas substituições.

### CORREÇÃO 08 — Remover a aba Histórico

Retirar a aba Histórico da interface atual de mensagens.

Preservar no banco de dados os registros de: mensagens enviadas; entrega; leitura; falhas; datas; destinatários; identificadores de envio.

Preservar as informações necessárias às métricas e auditorias.

Não excluir dados históricos; apenas retirar a aba desnecessária.

## 3. CORREÇÕES DO BPO FINANCEIRO

### CORREÇÃO 09 — Exclusão consistente de contas bancárias

Problema: ao excluir uma conta bancária, lançamentos importados por ela continuam aparecendo em Cobranças, Despesas, DRE e relatórios.

Implementar exclusão controlada dos dados vinculados à conta removida.

Regras:

1. Identificar movimentações pertencentes à conta.
2. Identificar lançamentos derivados exclusivamente dessas movimentações.
3. Identificar vínculos de conciliação e registros auxiliares.
4. Antes de excluir, apresentar a quantidade de registros afetados.
5. Solicitar confirmação administrativa.
6. Remover os registros elegíveis e seus reflexos financeiros de forma consistente.
7. Não deixar registros órfãos.
8. Não deixar movimentações duplicadas após reconexão.
9. Recalcular saldos, totais, DRE e indicadores afetados.
10. Preservar dados de outras contas.

PROTEÇÃO ESSENCIAL: Cobranças independentes do Asaas e registros operacionais legítimos não devem ser apagados apenas por estarem conciliados com uma conta bancária removida.

Diferenciar a origem efetiva do lançamento do seu vínculo bancário.

Como o sistema está em fase de testes, oferecer um procedimento administrativo seguro para limpar dados importados de teste e suas dependências, sem comprometer dados financeiros legítimos.

Realizar backup antes de qualquer limpeza destrutiva.

### CORREÇÃO 10 — Diagnosticar e corrigir Pluggy HTTP 410

A integração Pluggy apresenta erro HTTP 410 na leitura de transações das contas C6.

Realizar diagnóstico técnico de causa raiz:

1. Inspecionar os endpoints utilizados.
2. Conferir a documentação atual da Pluggy.
3. Verificar compatibilidade da versão da API.
4. Analisar status de conectores e itens.
5. Inspecionar respostas e códigos detalhados.
6. Verificar autenticação e validade da conexão.
7. Confirmar paginação e sincronização incremental.
8. Investigar eventual uso de endpoint descontinuado.
9. Corrigir a causa confirmada.
10. Testar novamente a recuperação de movimentações.

Não presumir que o HTTP 410 tenha uma causa única sem validar a resposta real da API.

Se houver necessidade de migração para uma API mais recente, implementar as alterações conforme documentação oficial.

Impedir duplicação de transações ao reprocessar.

Preservar dados existentes e proteger credenciais.

### CORREÇÃO 11 — Corrigir importação dos extratos Cora

Os extratos importados da Cora apresentam descrições genéricas e não identificam adequadamente os participantes.

Corrigir o processamento dos arquivos bancários.

Extrair e preservar, quando disponíveis: nome do pagador; nome do favorecido; descrição original; histórico da movimentação; identificador bancário; data; valor; tipo de transação; informações complementares.

Suportar os formatos de extrato efetivamente aceitos pelo sistema.

Não substituir informação disponível por descrição genérica.

Não inventar dados ausentes do arquivo original.

Garantir funcionamento na próxima importação da conta Cora e impedir duplicidades por reimportação.

### CORREÇÃO 12 — Permitir edição de cobranças e despesas

Ao clicar em uma cobrança ou despesa, abrir formulário para visualização e edição.

Campos pertinentes: valor; nome ou identificação; descrição; categoria; cliente; serviço vinculado; data; vencimento; competência; observações; outros dados existentes.

Permitir salvar alterações e refletir os resultados nos indicadores correspondentes.

Para registros sincronizados com Asaas ou outras fontes externas:

- Preservar a origem dos dados.
- Diferenciar ajustes internos de alterações realizadas na plataforma original.
- Evitar divergência de conciliação.
- Registrar histórico de alterações.

Não permitir edição silenciosa de informações financeiras já conciliadas.

### CORREÇÃO 13 — Categorias de cobranças vinculadas aos serviços

Substituir a lista atual de categorias de cobranças por:

1. Obras.
2. Regularizações.
3. Comissões.
4. Projetos.
5. Avaliações.
6. Imóveis.
7. Incorporação.
8. Financiamentos.

Ao selecionar uma categoria, consultar o módulo operacional correspondente.

Exemplo: Categoria: Obras · Registro vinculado: obra já cadastrada · Cliente: carregado do registro · Cobrança: associada ao serviço original.

Regras:

- Utilizar registros reais.
- Preencher dados disponíveis automaticamente.
- Guardar vínculos por identificador persistente.
- Permitir múltiplas parcelas e recebimentos parciais.
- Impedir duplicação de cobranças.
- Atualizar indicadores financeiros.
- Permitir navegação entre serviço e financeiro.
- Preservar os dados operacionais quando uma conta bancária for excluída.
- Permitir conciliação de recebimentos importados com serviços existentes.

Os módulos operacionais não devem criar receitas duplicadas.

Distinguir corretamente receita da empresa, repasses, valores financiados, movimentações transitórias e outros ingressos.

### CORREÇÃO 14 — Importação automática dos clientes do CRM

Reestruturar o formulário Novo Cliente BPO.

Clientes provenientes do CRM: eliminar o fluxo manual de seleção individual de leads e os campos redundantes correspondentes. Apresentar um botão: IMPORTAR CLIENTES

Funcionamento:

1. Buscar os clientes do CRM da empresa correspondente.
2. Comparar com os clientes já importados ao BPO.
3. Na primeira sincronização, importar os elegíveis.
4. Nas próximas, inserir somente os clientes novos.
5. Atualizar dados cadastrais modificados sem sobrescrever informações financeiras.
6. Não criar duplicidades.
7. Preservar vínculos anteriores.
8. Exibir resumo dos resultados.

Utilizar identificadores estáveis do CRM, com validação complementar de documentos.

Importação idempotente: executar novamente não pode duplicar registros.

Cadastro livre: preservar o formulário de cadastro livre para clientes BPO avulsos, fornecedores e terceiros. Manter os campos existentes, mas remover completamente a seção Serviços Contratados com as opções: Contas a pagar; Contas a receber; Folha; Fiscal; Conciliação. Esse campo não deverá ser obrigatório nem afetar o salvamento.

### CORREÇÃO 15 — Nova estrutura de categorias de despesas

Substituir a classificação atual por categorias vinculadas aos módulos operacionais.

Categoria principal: 1. Obras. 2. Tarefas e Agenda. 3. Regularizações. 4. Comissões. 5. Incorporação.

Quando a categoria for Obras: exibir o campo Obra Vinculada, com seleção de obra já cadastrada. Exibir a subcategoria Tipo de Despesa: Empreiteiro; Terreno; Comissão; Fornecedor; Outros; Mão de obra; Material. Exibir outra subcategoria chamada Etapa: utilizar a mesma lista completa de etapas cadastrada no módulo Obras, incluindo serviços preliminares, infraestrutura, supraestrutura, paredes, esquadrias, revestimentos, cobertura, pintura e demais etapas existentes. Não criar uma lista independente que possa ficar desatualizada.

Quando a categoria for Incorporação: exibir a subcategoria Empreendimento Vinculado. Carregar automaticamente as incorporações existentes no módulo Incorporação. Permitir busca e seleção. Salvar referência ao empreendimento correto.

Quando a categoria for Comissões: exibir a subcategoria Imóvel Vinculado. Carregar os imóveis já cadastrados no módulo Imóveis. Permitir selecionar o imóvel correspondente à despesa de comissão.

Outras categorias: para Regularizações e Tarefas e Agenda, permitir vinculação ao registro operacional existente, quando aplicável.

Regras gerais:

- Não duplicar despesas.
- Não duplicar pagamentos de obras.
- Permitir edição posterior.
- Preservar origem e rastreabilidade.
- Atualizar relatórios e indicadores.
- Preservar classificação contábil adequada, separada da categoria operacional.
- Validar impactos no DRE.
- Utilizar dados reais dos módulos, sem criar cadastros paralelos.

## 4. CORREÇÕES DO MÓDULO PROJETOS

### CORREÇÃO 16 — Revisões, prioridades e organização dos arquivos

Revisão prioritária — quando uma revisão de projeto for solicitada:

1. Alterar imediatamente o status para Revisão ou Em revisão, utilizando uma nomenclatura consistente.
2. Destacar visualmente todo o quadro ou linha do projeto.
3. Utilizar cor de destaque com contraste e legibilidade adequados.
4. Posicionar o projeto no primeiro grupo da lista, independentemente da data.
5. Manter projetos em revisão prioritários enquanto a revisão estiver pendente.
6. Retornar à ordenação normal após a conclusão da revisão.

O destaque deverá funcionar em desktop e dispositivos móveis.

Renomeação automática dos arquivos — ao receber um PDF ou arquivo editável enviado pelo engenheiro:

- Identificar projeto e cliente.
- Identificar tipo de arquivo.
- Identificar versão.
- Renomear automaticamente segundo padrão definido.
- Preservar a extensão original compatível.
- Guardar o nome original no histórico.
- Evitar sobrescrita acidental de versões.

Padrão de referência: PROJETO_CLIENTE_TIPO_V01.pdf · PROJETO_CLIENTE_TIPO_V01.dwg. Adaptar o padrão aos tipos de projetos e arquivos existentes.

Atualização automática do checklist — sempre que um arquivo válido for anexado:

- Identificar a qual campo do checklist pertence.
- Marcar automaticamente o campo correspondente.
- Atualizar imediatamente o contador.
- Evitar dupla contagem.
- Manter vínculo entre arquivo e checklist.
- Considerar substituições, exclusões e revisões de versões.

Exemplo: PDF adicionado → campo PDF marcado. Editável adicionado → campo Editável marcado.

Não marcar como concluído um item sem documento válido e acessível.

## 5. ARQUITETURA E INTEGRAÇÕES

### 5.1. Paridade entre sistemas

Prospecta e Grupo Santa Fé deverão possuir as mesmas funcionalidades previstas neste escopo, respeitando diferenças de marca, dados, configurações e arquitetura.

Não compartilhar bancos de dados ou informações de clientes entre empresas sem autorização.

### 5.2. Banco de dados

Antes de modificar esquemas: inspecionar tabelas e relacionamentos; identificar referências e restrições; planejar migrações reversíveis quando possível; criar backups apropriados; preservar dados reais; testar migrações em ambiente seguro; evitar registros órfãos; garantir integridade referencial.

### 5.3. Integrações

Preservar e validar: WhatsApp e provedor utilizado; CRM; Asaas; Pluggy; importadores bancários; módulo Obras; módulo Projetos; módulo Incorporação; módulo Imóveis; BPO Financeiro.

Não presumir funcionamento de integrações sem testes.

## 6. ORQUESTRAÇÃO AIOX

Organizar a execução com funções especializadas:

- Auditoria e arquitetura: identificar estrutura, riscos, dependências e trabalhos existentes.
- Backend e banco de dados: implementar regras de negócio, vínculos, migrações e integrações.
- Frontend e UX: implementar formulários, componentes, responsividade e navegação.
- Integrações: validar WhatsApp, Asaas, Pluggy, Cora e sincronizações operacionais.
- QA e testes: validar casos normais, erros, regressões e integridade dos dados.
- Revisão e entrega: controlar PRs, documentação, Handoffs, merge e deploy.

Utilizar agentes e recursos AIOX realmente disponíveis. Caso a infraestrutura AIOX não esteja instalada, adotar a metodologia de organização sem simular agentes inexistentes.

## 7. ORDEM DE EXECUÇÃO

FASE 1 — Auditoria e proteção: confirmar repositórios e estado remoto; identificar trabalhos existentes; conferir Handoffs; fazer inventário de dependências; verificar riscos de migração; estabelecer checkpoints; preparar plano detalhado de execução. Nenhum código deverá ser alterado antes da autorização correspondente.

FASE 2 — BPO Financeiro: 09 Exclusão de contas e lançamentos · 10 Pluggy · 11 Extratos Cora · 12 Edição de cobranças e despesas · 13 Categorias de receitas · 14 Importação de clientes · 15 Categorias de despesas e vínculos. Priorizar integridade financeira e prevenção de perda de dados.

FASE 3 — WhatsApp e Projetos: 01 Mover quadros de conexão · 02 Identificação de contatos · 03 Navegação de documentos · 04 Reformulação de templates · 05 Seleção de serviços · 06 Campos de agendamento · 07 Gerenciamento de templates · 08 Remoção da aba Histórico · 16 Revisões, arquivos e checklist dos projetos.

FASE 4 — Testes, paridade e entrega: executar testes automatizados disponíveis; validar operações críticas manualmente quando necessário; testar dispositivos móveis e desktop; conferir permissões de usuário; conferir integridade financeira; conferir ausência de duplicidades; verificar consistência entre sistemas; executar build e demais verificações; revisar PRs; atualizar Handoffs finais; preparar entrega controlada.

Ajustar a ordem interna quando dependências técnicas justificarem, documentando a decisão.

## 8. CRITÉRIOS GLOBAIS DE ACEITE

Uma correção somente poderá ser considerada concluída quando:

1. O código estiver implementado.
2. Os testes relevantes passarem.
3. Não houver regressão conhecida não documentada.
4. Os dados existentes estiverem preservados.
5. As permissões forem respeitadas.
6. O comportamento funcionar nos dois sistemas quando aplicável.
7. O Handoff estiver atualizado.
8. Existir commit ou PR identificável.
9. As limitações e pendências estiverem claramente registradas.

Não confundir alteração de código, deploy realizado e funcionalidade efetivamente validada em produção.

## 9. POLÍTICA DE MERGE E DEPLOY

A implementação, o merge e o deploy devem respeitar as autorizações explícitas do proprietário.

Antes de cada entrega: confirmar branch de destino; confirmar atualizações remotas; verificar conflitos; verificar testes; conferir migrações; confirmar estratégia de recuperação; registrar o estado anterior; atualizar Handoff.

Não declarar deploy realizado sem evidência verificável.

Quando houver falha de CI, build, migração ou integração, registrar o bloqueio e as ações necessárias.

Nunca ocultar erros para apresentar a execução como concluída.

## 10. FORMATO DO RELATÓRIO DE PROGRESSO

A cada etapa relevante, apresentar: Repositório; Correção (número e descrição); Situação (pendente, em andamento, implementada, testada, bloqueada ou entregue); Arquivos; Commit/PR; Testes; Handoff (caminho atualizado e commit publicado); Pendências; Próxima ação.

Ao finalizar, entregar uma matriz das 16 correções com o estado individual em ambos os repositórios.

## 11. REGRA FINAL DE CONTINUIDADE

A continuidade do trabalho é prioridade absoluta.

Antes de qualquer possível interrupção:

1. Salvar o código produzido.
2. Atualizar o Handoff.
3. Registrar tarefas pendentes.
4. Registrar erros e decisões.
5. Criar checkpoint versionado.
6. Publicar no remoto quando autorizado e tecnicamente possível.
7. Informar o commit e a branch para retomada.

Se não for possível publicar no GitHub, informar explicitamente que o progresso ainda não está protegido remotamente.

Não depender do histórico do chat, de arquivos temporários ou da memória de um agente.

O próximo agente deve conseguir retomar o projeto consultando apenas o repositório, os Handoffs e as referências de commits/PRs.

## INSTRUÇÃO DE PARTIDA

Após receber a autorização de execução:

1. Acessar os dois repositórios.
2. Auditar o estado atual.
3. Ler as instruções e Handoffs existentes.
4. Identificar correções já realizadas.
5. Preparar plano de implementação sem duplicar trabalho.
6. Registrar checkpoint inicial.
7. Executar as correções por etapas.
8. Testar cada etapa.
9. Atualizar e versionar os Handoffs continuamente.
10. Apresentar evidências reais do que foi executado.

PRIORIDADE MÁXIMA: preservar o trabalho existente, garantir integridade dos dados, manter paridade entre os sistemas e possibilitar continuidade por qualquer agente.
