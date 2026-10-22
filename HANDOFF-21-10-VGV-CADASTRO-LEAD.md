# Handoff — VGV simulado no cadastro do lead — 21/10/2026

## Escopo autorizado
Incluir VGV simulado (R$) no cadastro inicial, ao lado do estágio e antes dos serviços. Preservar edição/leitura do mesmo valor. Valor financiado aprovado preenchido somente na edição. Paridade Prospecta e Grupo Santa Fé, merge e deploy autorizados.

## Implementação
- Prospecta: AdminCRM inclui CurrencyInput, estado inicial e envio de simulationValue; leads.create valida valor não negativo dentro de decimal(15,2) e persiste string com duas casas no mesmo campo do detalhe/edição.
- Santa Fé: NovoLeadForm renomeia Budget e posiciona CurrencyInput orcamento ao lado do estágio. Action existente já persiste esse campo; financiamento aprovado continua fora do cadastro.
- Testes verificam persistência do VGV, centavos e recusa/ausência do financiamento aprovado na criação; Prospecta verifica ausência de simulação e valores inválidos.
- Sem migration e sem alterações nos valores dos clientes existentes.

## Validação
(a) Automática: sintaxe dos arquivos alterados aprovada; diff --check aprovado. Santa Fé: 7 testes do fluxo de criação/edição aprovados localmente. Prospecta: teste de regressão adicionado; execução completa e build pendentes do pipeline Vercel (dependências locais indisponíveis).
(b) Manual: revisão do fluxo de envio, campo persistido e compatibilidade com edição/leitura.
(c) Produção: ainda verificar build e deploy. Tela autenticada com criação real não exercitada.

## Próximo passo exato
Publicar branch codex/vgv-cadastro-lead-20261021 nos dois repositórios, abrir PRs e aguardar os checks. Com checks aprovados, merge e confirmar produção READY. Registrar commits, PRs e deployments neste handoff.
