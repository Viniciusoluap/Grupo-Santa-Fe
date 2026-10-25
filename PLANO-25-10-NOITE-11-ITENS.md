# PLANO 25/10 (noite) — 11 pedidos do dono (Prospecta + Grupo Santa Fé)

Status: **aguardando autorização do dono**. Paridade: tudo nos dois sistemas (Santa Fé = Next/Prisma).
Regras: testes sem serviços externos reais; nada de segredo em log; relatório (a)/(b)/(c); handoff + push a cada lote.

## Diagnóstico feito (somente leitura)
- Extrato Cora: 379 movimentações com só 8 descrições ("Transf Pix enviada" 254, "Pgto QR Code Pix" 57…). O leitor do arquivo
  descartou a coluna do titular/descrição — os nomes **não estão no banco**; é preciso reimportar o mesmo arquivo após a correção.
- Saldo R$ 0,00: soma de entradas − saídas desde 01/01/2026 = exatamente 0 (o arquivo não trazia saldo). Dono confere no app da Cora.
- Clientes BPO: **0 no banco** — o cadastro está falhando (formulário exige campos como honorários/responsável). A diagnosticar e corrigir.
- Integrações hoje só guarda as chaves da Pluggy; o botão "Conectar banco (Meu Pluggy)" existe **só** no quadro do BPO.
- Regularização: "Valor contratado" = soma do previsto dos itens de receita própria (Projetos, PCI, Água, Despachante, CND/CNO)
  dos processos não cancelados; "Valor já recebido" = soma dos recebimentos confirmados desses itens.
- WhatsApp: 16 mensagens recebidas guardadas; mídia chega só como "[mensagem]"/"[imagem]" (o arquivo não é guardado).

## Lote 1 — WhatsApp
1. Excluir conversa (botão na lista; apaga as mensagens daquele número no sistema; não apaga no celular). Confirmação antes.
2. Campos de dados faltantes no envio: digitar livremente (sem validar a cada letra; valida ao enviar).
   - {{imovel}}: lista dos imóveis cadastrados **ou** texto livre.
   - {{documentos}}: lista de documentos do cliente (checklist do lead: RG/CNH, comprovantes, PIS, FGTS…) com marcação múltipla;
     sem lead, texto livre. Preenchido automaticamente com os pendentes quando o lead tem checklist.
4. Imagem e áudio nas conversas: guardar a mídia recebida (e enviada) no próprio banco, servida por rota autenticada; miniatura que
   abre grande; player de áudio; documento com link para baixar. Limite 10 MB por arquivo.
   Extra: o botão verde flutuante do WhatsApp cobre o botão de enviar — esconder/mover nessa tela.

## Lote 2 — Imóveis
3. Lista de Imóveis mostra **endereço** (do imóvel ou da obra) e **valor = VGV** (mesma fonte da tabela do Mapa Operacional).
   Imóveis criados a partir de obra passam a guardar endereço e VGV e acompanham a obra; os 16 criados hoje são atualizados.

## Lote 3 — Usuários
5. Remover referências à ex-funcionária **Sarah**: "(antigo: Sarah)" vira só "Sem usuário" nos leads e demais telas.
   A **corretora Sara** não é tocada. Antes de gravar: prévia com a contagem de registros afetados.

## Lote 4 — Regularização
6. Fórmula embaixo de "Valor já recebido" e "Valor contratado" (texto acima, igual Valores da Operação).
7. Valor de cada processo na lista = **Total geral** do financeiro do processo (hoje aparece R$ 0,00).

## Lote 5 — BPO Financeiro
8. Sai o quadro "Pluggy — contas conectadas" de BPO › Bancos. O botão "Conectar banco (Meu Pluggy)" + data inicial vão para
   Configurações › Integrações (bloco Pluggy) — para não perder a forma de conectar o C6.
9. Extrato: guardar **titular** (nome de quem pagou/recebeu) e **descrição**; reimportar o mesmo arquivo completa as 379 existentes
   sem duplicar. Classificar cada movimentação (categoria + cliente BPO); **regra por titular** (classificou uma vez, as próximas
   saem classificadas). Cobranças, Despesas e DRE (por categoria) usam a classificação.
10. Cliente BPO: corrigir o cadastro; **vínculo com o lead do CRM** (escolher o lead; nome/CPF/telefone vêm dele) ou cadastro livre
    (fornecedor). Sugestão automática lead ↔ titular do Pix. Aba Clientes com total pago e em aberto por cliente; lead no CRM
    mostra quanto já pagou.
11. "+ Lançamento": Tipo só **Cobrança** ou **Despesa** + **Categoria** (as 11 aprovadas). Honorário/Reembolso saem da lista
    (hoje não há nenhum lançamento antigo desses tipos).

## Lote 6 — Publicação
Testes (unitários + banco real no SF), build, PRs, merge, deploy. Migrações aditivas previstas:
- `whatsapp_messages`: tipo de mídia, mime, nome e conteúdo (bytea) — SF `mensagens_whatsapp` igual.
- `bank_transactions`: `titular`, `descricao_original`; tabela `bpo_regras_titular` (titular → categoria/cliente).
- `bpo_clients`: `lead_id` (FK leads, opcional).
Dados: atualização dos 16 imóveis (endereço/VGV) e limpeza de "Sarah" só após prévia.

## Ordem sugerida
Lote 5 (BPO, maior impacto) → Lote 1 (WhatsApp) → Lotes 2, 3, 4 → Lote 6. Cada lote: commit + push + handoff.

## O que dependerá do dono depois
- Reimportar o extrato da Cora (mesmo arquivo) para trazer os nomes.
- Classificar os titulares mais frequentes uma vez (o resto sai automático).
- Conferir saldo da Cora no app.
