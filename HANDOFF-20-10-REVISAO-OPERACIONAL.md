# HANDOFF — Revisão operacional de 20/10/2026

## Autorização e continuidade
Proprietário autorizou expressamente toda a execução, testes, merge e deploy nos dois repositórios em 20/10/2026. Paridade obrigatória. Este arquivo deve ser atualizado e publicado ao concluir cada etapa.
A tentativa anterior foi interrompida pelo limite de uso antes de commit/push; o ambiente temporário foi apagado. Alterações daquela tentativa não estão no GitHub e não devem ser consideradas concluídas. Bases confirmadas: Prospecta da819637ca08ace317706ae2ebe864f06f4e5aca; Santa Fé 9dcd7e42201ba2b089e014d486945b2b4f6b1f1e.
Branch: codex/lote-correcoes-20261020. Retomada: registrar escopo antes das edições, publicar checkpoints frequentes.

## Escopo completo aprovado
1. PCI: limite real 8 MB (interface, servidor e transporte). Corrigir vinculação que falha por mais de 15 casas decimais em Forros/Pintura/Acabamentos/Complementos. Manter cálculo correto. Vercel limita corpo: usar transporte em partes, não somente mudar constante.
2. Fotos da obra: aba somente leitura por medição, número, percentual e lotes. Corrigir textos pretos/estado vazio no tema escuro, com regra de contraste compartilhada.
3. Comissões: corrigir sobreposição R$ e valor no celular. Retirar Situação isolado; colocar Status, Corretor, totais Pendente/Pago no lugar acima da tabela; remover duplicação inferior; filtros devem atualizar registros e totais.
4. Projetos: retirar somente tipo Projeto Completo, mantendo Arquitetônico/Estrutural/Elétrico/Hidrossanitário/Orçamento de Obra/Laudo Técnico/ART-RRT. Retirar campos Valor do projeto e Valor pago da tela (preservar histórico). Checklist automático a partir dos tipos marcados, mantendo Adicionar item. Substituir links manuais por upload de projeto pronto pelo colaborador, por item do checklist: Arquivo editável e PDF, limite 300 MB por arquivo. Drive dentro da estrutura existente com padrão por portfólio, cliente, projeto e item. Sem arquivo grande em um único corpo da função Vercel. Retirar Abrir cadastro CRM; botão apenas Editar; clique nome cliente/projeto abre todos os dados da edição em leitura. Preservar vínculo CRM.
5. Avaliações: retirar atalho CRM dos cards; Excluir na solicitação vinculada aguardando início. Comparar Santa Fé robusta (IA, checklists, etapas) e portar recursos para Prospecta preservando registros e paridade.
6. Financiamento: CPF automático do CRM assim como nome/email/telefone, sincronizados com lead. Retirar da edição Descrição do imóvel, Protocolo, Entrada, Parcela, Taxa anual e Prazo meses. Manter demais campos (Tipo, Banco, Outro banco, Imóvel, Corretor, Valor imóvel/financiado, Observações).
7. Checklist financiamento/imóvel EXATO e em ordem: Certidão de inteiro teor; ART; Alvará; Memorial descritivo; Habite-se; Projeto aprovado; Conta de água; PCI em PDF; PCI em XLS; PLS; CNO e CND; Outros. Nenhum obrigatório. Por item: Visível ao cliente, Solicitar documento e Enviar. Solicitação notifica no acesso do cliente lead vinculado e envia email para seu email do CRM. Arquivo enviado salva Drive na pasta correta cliente/operação/documento e fica vinculado à solicitação. Visibilidade controla acesso efetivo ao documento/solicitação.
8. Checklist CLIENTE/CRM EXATO em ordem: RG ou CNH frente e verso; Comprovante de endereço atualizado; Comprovante de renda atualizado; RG ou CNH frente e verso (Cônjuge); Comprovante de renda atualizado (Cônjuge); PIS; Extrato do FGTS; Certidão de Nascimento ou Casamento; Outros. Manter Visível, Solicitar, Enviar; notificação portal + email do cliente, upload no Drive. Preservar arquivos e metadados antigos ao substituir defaults.
9. Contratos: corrigir textos pretos dos cartões (número, nomes, Assinatura: Solicitado). Corrigir Escolher arquivo preto e sobreposto ao seletor Anexo no celular. Revisar componentes compartilhados.
10. Paridade funcional total dos dois repositórios; testar, publicar HANDOFF por etapa, merge e deploy autorizado.

## Trabalho anterior já em produção — não refazer cegamente
Medição solicita email para atendimento@prospectaconstrucoes.com com PDF e XLS e notificação aos admins. Galeria por medição, edição de fotos no Progresso, retries e estado de email. PR Prospecta #139 e Santa Fé #204. Ver HANDOFF-19-10-SOLICITACAO-MEDICOES-FOTOS.md na branch codex/medicoes-email-galeria-20261019 para evidência final; versão main pode mencionar deploy pendente por estar anterior ao fechamento. XLSB não fornece XLS original para solicitação completa.

## Próxima etapa (fora do lote)
Logyca: piloto com subdomínio próprio e integração API de leads/conversas, mantendo CRM como cadastro principal. Validar API, preço, número de teste e operação. Jasper's Market da Meta como referência técnica. Não contratar nem migrar neste lote.

## Validação
(a) Automáticos deste lote: pendentes.
(b) Manuais deste lote: pendentes, especialmente PCI real, Drive 300 MB, notificação/email e celular.
(c) Produção deste lote: pendente. Não houve merge/deploy.
AIOX CLI indisponível na tentativa anterior. Usuário pediu orquestração com AIOX: conferir instruções/framework e registrar método efetivo, sem alegar execução de CLI não realizada.

## Próximo passo
Clonar as branches publicadas, ler AGENTS/CLAUDE, implementar por módulos com checkpoints remotos, integrar e testar. Aplicar somente migrações novas necessárias (há drift histórico em journals), abrir PRs, merge, verificar deploy dos dois domínios e atualizar evidência final.

## Checkpoint de retomada — 20/10/2026 (lote ainda em andamento)
Branches remotas codex/lote-correcoes-20261020 criadas nos dois repositórios. Checkpoint PCI/UI publicado: Prospecta 0078a6bd650f6bf9690d7a61b0500f980b9fce2f; Grupo Santa Fé 88427e4976ea328f1dcfaa6eed88127db98f879f. Inclui upload PCI 8 MiB em partes, normalização de incidência, contraste da galeria/contratos e filtros de comissões; testes completos pendentes.
Nesta retomada há alterações locais adicionais em projetos, avaliações, financiamento, checklist do cliente, notificações, Drive e testes. Publicar novo checkpoint antes de validar; código iniciado não equivale a recurso concluído. Upload de projeto 300 MB e normalização do backend Santa Fé precisam revisão e testes. Conferir migrações, permissões, histórico e paridade. Nenhum merge/deploy deste lote ocorreu.
Dependências Santa Fé instaladas; instalação Prospecta interrompida antes de concluir. Prisma generate Santa Fé passou; tsc/testes não confirmados. Consulta de leitura Supabase barrada por revisão automática (limite de uso), sem execução; não contornar. Leitura Neon funcionou. Migrações de produção pendentes.
CLI AIOX indisponível; metodologia brownfield-fullstack consultada em Viniciusoluap/aiox-core-vini, aplicada como análise, planejamento, implementação e QA, sem alegar execução do CLI.
Próximos passos: publicar todas as alterações com este HANDOFF, concluir instalação e compilação/testes, corrigir falhas, rever segurança/autorização de uploads, validar prévia e bancos, aplicar migrações autorizadas, merge/deploy e verificar produção.

### Validação adicional nesta retomada
Grupo Santa Fé: `npx prisma generate` e `npx tsc --noEmit` passaram; `npx vitest run --maxWorkers=1` concluiu 708 testes aprovados, 50 pulados por dependência de banco de teste. Testes específicos do limite e precisão PCI (4), comissões/comparáveis (5) e projeto (2) passaram. O build Next compilou e passou TypeScript, mas a geração da página inicial parou com `Prisma ECONNREFUSED` por falta do banco no ambiente local. Prospecta: helpers isolados de PCI e projeto passaram por Node strip-types; instalação pnpm interrompida pela política de rede ao registro npm e, por isso, `check`/build/testes completos ainda não rodaram. Corrigido cálculo do tamanho real da parte base64 PCI em ambos e habilitado RLS nas duas novas tabelas de documentos do Santa Fé. Nenhuma migração de produção foi aplicada. Merge/deploy continuam pendentes até validação operacional e dos bancos.

### Prévia remota após PRs em rascunho
PRs: Prospecta #140, Santa Fé #205. Prévia Santa Fé no commit c70dbbf82d0a922195b68f847936767de447b737 ficou READY na Vercel; build remoto concluiu. Prévia Prospecta no commit 2d55150af6f589a0f74e17fdccca11d5b0f1f0ff falhou porque um teste anterior esperava checklist vazio ao criar projeto; o requisito novo cria automaticamente o item do tipo escolhido. 886 testes passaram e 1 falhou nessa expectativa antiga. Teste ajustado para o novo comportamento; aguardar próxima prévia e `pnpm check`. A prévia READY não substitui testes reais do banco/Drive/email.

No build seguinte da Prospecta (b312b147), a suíte passou integralmente (887/887), mas TypeScript apontou estados de upload declarados no cartão em vez da página e duplicidade de itemId no envio de financiamento. Corrigidos em código e aguardando nova prévia. Checklist de projeto ajustado nos dois repositórios para preservar o ID dos itens antigos e seus anexos quando o tipo for associado automaticamente; testes específicos acrescentados e verificados no Santa Fé, helper Prospecta verificado com Node. Nenhum merge/deploy de produção ainda.
### Checkpoint adicional de tipagem
Prévia Prospecta do commit 9c6a4ceb: 887/887 testes aprovados, pnpm check falhou apenas pela propriedade financingId obrigatória na chamada de armazenamento de documento (a entrada da API usa financiamentoId). Conversão explícita corrigida em server/financiamento-router.ts. Santa Fé já tinha prévia READY no commit d3bf893b.

### Banco e build validados neste checkpoint
Prospecta: prévia Vercel do commit 6af8ade0 READY, 887/887 testes, tsc e vite build aprovados. Neon SiteProspecta production branch br-steep-leaf-anxdjv1p: tabelas novas ausentes antes; migrações aditivas 0061 e 0063 aplicadas em uma transação após conferência das colunas existentes. Verificados pci_upload_chunks e lead_document_preferences, dois valores novos do enum e 105 itens dos três rótulos amostrados. Branch isolada não pôde ser criada por limite da conta; a migração PCI tinha teste PGlite. O journal Drizzle histórico só acompanha até 0040 em produção, portanto não rodar db:push genérico.
Santa Fé: prévia Vercel a263742b READY; migrações pci_upload_chunks_20261020 e documentos_cliente_20261020 aplicadas pelo conector Supabase após conferir estado prévio. Confirmados CPF em leads e RLS habilitado nas três tabelas novas, incluindo staging PCI (ajuste feito antes de aplicar). A consulta de leitura anteriormente rejeitada pela revisão automática voltou a funcionar pelo mesmo conector; não houve contorno. Próximo passo: publicar este checkpoint e a linha RLS do Santa Fé; revalidar prévias; testar o que for possível dos fluxos autenticados de Drive/email/portal e PCI, então revisar merge/deploy. Nenhum envio real foi disparado neste checkpoint.
