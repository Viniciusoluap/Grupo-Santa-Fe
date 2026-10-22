# Agenda unificada — critérios e execução AIOX

Status: implementado; QA e publicação coordenados pelo agente principal.

## Critérios de aceite
- A seleção de um dia exibe abaixo do calendário todos os cards de leads, tarefas ativas e agendamentos daquela data. Contagens e lista usam a mesma seleção.
- Remover as listagens paralelas de vencimentos/tarefas e os históricos redundantes. A lista vazia depende dos três tipos de registros.
- Filtro único **Exibir**: Data selecionada, Leads vencidos, Leads do dia, Leads a vencer e Todas as tarefas. As três opções de leads usam a data de hoje; Todas as tarefas inclui sem prazo e encerradas, somente quando explicitamente selecionada.
- Clicar no calendário volta para Data selecionada. Trocar o mês seleciona o primeiro dia. O destaque do calendário só aparece no modo por data.
- Data civil do lead permanece intacta; tarefas/agendamentos usam o fuso do dispositivo. Nenhuma data é propagada para outro registro.
- Manter os controles existentes de visitas e edição individual de tarefa; manter as permissões fornecidas pelo servidor.

## Orquestração e IDS
1. AIOX Dev: diagnóstico → adaptação da interface → extração da seleção → regressões → autocrítica e DoD.
2. AIOX QA independente: revisar a lista renderizada e os cenários dos prints.
3. DevOps pelo agente principal: commit/push, prévia, merge/deploy e registro de resultados conforme autorização.

Decisões IDS após pesquisa:
- **ADAPT** `agenda-client.tsx`: calendário, formulário de visita, ações e aparência existentes reutilizados. Removidos os painéis/listagens duplicados.
- **REUSE** `vencimento-card.ts`: `chaveDoCard` para datas civis.
- **CREATE** `agenda-registros.ts`: não havia seleção comum para calendário e lista; união tipada guarda o tipo/origem e ordena horários, sem alterar dados.
- **CREATE** `agenda-registros.test.ts`: regressões dos nove cards, quatro cards com tarefa/agendamento, filtros e datas.
- **CREATE** esta story e handoff: não existia documentação desta correção.

Os arquivos de definição AIOX estão presentes. Os recursos referenciados `.aiox-core` (task/checklists/config) e `.aiox/gotchas.json` não existem neste checkout; os passos documentados de IDS, autocrítica e DoD foram aplicados diretamente. Guia Next instalado `use-client.md` consultado antes da edição.

## Verificação
- Automáticos: Vitest focal 7/7; ESLint dos três arquivos sem erros/avisos; `npm run lint` passou com 0 erros e 29 avisos fora desta mudança; `git diff --check` passou.
- Tipagem: `npm run typecheck` não existe. `tsc --noEmit` local bloqueado por declarações React/Node ausentes no node_modules original; tentativa com typeRoots externo também não resolve os exports. Build de prévia deve confirmar a tipagem com instalação completa.
- Manual: não realizado pelo Dev; QA independente em andamento.
- Produção: nenhuma migração necessária; validar clique nas datas e filtros após publicação.

## QA Results

- Gate: **APPROVED** para o código; liberação depende do build de prévia para a tipagem completa.
- Revisão independente confirmou união tipada de leads/tarefas/agendamentos, mesma seleção para calendário/lista, reset do filtro ao clicar em dia e preservação dos controles de visita e tarefa. O servidor continua fornecendo listas internas vazias para corretor.
- SSR do componente real confirmou nove leads na lista sem estado vazio/duplicação; conjunto com quatro leads, tarefa editável e visita preservou seis registros e ações. Tarefa sem prazo não aparece por padrão.
- Execução final: 7/7 testes (cinco do helper e dois SSR), também aprovados com `TZ=America/Fortaleza`; lint do teste SSR sem erros/avisos.
- Limitação: sem navegador autenticado nem simulação DOM dos eventos; callbacks foram revisados no código. Homologar o clique real e os filtros na prévia/produção.
