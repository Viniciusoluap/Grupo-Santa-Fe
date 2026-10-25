# PLANO / PROMPT — BPO Financeiro + WhatsApp (25/10)

> Prompt pronto para Claude ou Codex executar. Vale para **Prospecta e Grupo Santa Fé** (paridade obrigatória).
> Antes de começar, ler `HANDOFF-25-10-BANCOS-WHATSAPP.md` (o que já está em produção) e o `CLAUDE.md`.
> Regras: autorização do dono antes de merge/deploy/migração em produção; nada de segredo em log/commit;
> testes nunca chamam Asaas/Pluggy/Evolution reais (tudo simulado); handoff + commit + push a cada etapa;
> relatório final separando (a) automático, (b) manual, (c) pendente em produção.

## Situação em 25/10 (prints do dono)
- WhatsApp: **conectado pelo QR** (Prospecta, número 559981392210) e envio funcionando, mas:
  1. o template é enviado **com as variáveis cruas** (`{{nome}}`, `{{servico}}`…) — nada é substituído;
  2. **não existe tela de conversas**: não dá para ver respostas do cliente nem continuar a conversa;
  3. "Taxa de leitura" fica 0% (status de entregue/lida não volta da Evolution).
- BPO Financeiro: extrato da Cora importado (379 movimentações, corretas) **mas não aparece** em Cobranças, Despesas,
  DRE, Contabilidade e Relatórios (essas telas leem `bpo_lancamentos`; o extrato fica em `bank_transactions`, sem ligação).
  Saldo da conta mostra R$ 0,00. Gráfico do DRE em Relatórios aparece como bloco cinza.
- Chaves cadastradas em vários lugares (Pagamento, BPO, WhatsApp); telas parecem "não configuradas" porque nunca
  mostram a chave salva. Asaas: "recusou a chave" (provável restrição de IP ou chave regenerada). Pluggy: "recusou
  Client ID/Secret" (secret transcrito de print, ou trial vencido bloqueando a API).
- O dono **não quer** renomear o BPO Financeiro nem esconder abas: tudo deve continuar e funcionar.

## LOTE A — WhatsApp (prioridade 1)
A1. **Variáveis do template preenchidas por destinatário** (servidor, no momento do envio):
- `{{nome}}` → primeiro nome do lead; `{{servico}}` → serviços do lead em texto legível (rótulos, não códigos);
  `{{corretor}}` → corretor responsável do lead (ou nome de quem envia); `{{imovel}}`, `{{banco}}`, `{{horario}}`,
  `{{endereco}}`, `{{documentos}}` → dados do lead/financiamento/agenda quando existirem.
- Variável sem dado → a tela pede para preencher antes de enviar; **bloquear envio** se sobrar `{{…}}` sem valor.
- **Prévia por destinatário** antes de enviar (mostra a mensagem final de cada lead).
- Histórico grava a mensagem **já preenchida**.
A2. **Conversas (receber e responder)**:
- Ao criar/conectar a instância, registrar sozinho o webhook da Evolution (`/webhook/set/{instancia}`) apontando para
  `https://<site>/api/whatsapp/evolution-webhook` com cabeçalho secreto (HMAC do segredo do servidor), eventos
  `MESSAGES_UPSERT`, `MESSAGES_UPDATE`, `CONNECTION_UPDATE`.
- Gravar mensagens recebidas e enviadas (direção, número, texto, tipo de mídia, horário, id externo) e vincular ao lead
  pelo telefone (normalizado com DDI 55); número sem lead → "Contato novo" com botão "Criar lead".
- Atualizar status entregue/lida das mensagens enviadas (alimenta "Taxa de leitura") e o status da conexão.
- Nova aba **Conversas** na Central WhatsApp: lista de chats (nome/número, última mensagem, não lidas, filtro),
  tela do chat com histórico e caixa de resposta (texto; anexos numa etapa seguinte); atualização a cada poucos segundos.
- Botão **"Conversa no WhatsApp"** no card do lead (CRM) abrindo o chat daquele lead.
- Notificação no sistema quando chega mensagem nova. Corretor vê só as conversas dos próprios leads/da própria conexão;
  admin/colaborador com módulo veem a conexão da empresa.
A3. Endereço da Evolution sempre normalizado (`https`, sem `/manager`); teste do servidor exige resposta JSON da API;
    erros mostram a mensagem real da Evolution.
- Aceite: template enviado sem `{{ }}`; resposta do cliente aparece na aba Conversas em segundos; responder pelo sistema
  chega no celular do cliente; taxa de leitura muda.

## LOTE B — Tela única de Integrações (Configurações › Integrações)
- Um bloco por serviço: **Asaas** (chave de API + token do webhook), **Pluggy** (Client ID + Secret),
  **WhatsApp/Evolution** (endereço + chave). Cada bloco: status ✅/❌ com a **mensagem real** do serviço,
  "chave salva terminando em …", botões **Testar** e **Trocar**. Segredos criptografados no banco.
- Remover campos de chave duplicados: Configurações › Pagamento, BPO › Bancos (conta Asaas passa a pedir só a data
  inicial e usa a chave central), quadro Pluggy do BPO (fica só "Conectar banco"/"Buscar contas"), WhatsApp (servidor).
- Migrar o que já está salvo para a tela nova (sem pedir de novo ao dono).
- Aceite: cada chave existe em um único lugar; a tela mostra o que está salvo e se funciona.

## LOTE C — Extrato bancário alimentando todo o BPO Financeiro (sem renomear, sem esconder abas)
- Cada movimentação bancária (importada ou sincronizada) gera **automaticamente** um lançamento pago em
  `bpo_lancamentos` (vínculo 1:1, sem duplicar): **entrada → Cobranças (receita)**, **saída → Despesas**; data e
  competência = data do banco.
- Cada movimentação/lançamento tem **categoria** (lista padrão editável: Recebimento de cliente, Financiamento/CAIXA,
  Material, Mão de obra, Projetos e taxas, Impostos, Tarifas bancárias, Pró-labore, Administrativo,
  Transferência interna, Outros) e pode ser **vinculada a um Cliente BPO** (aba Clientes continua e passa a ter uso).
- **Transferência interna** (entre contas da empresa) não conta como receita/despesa.
- Reprocessar as **379 movimentações da Cora** já importadas.
- **Saldo da conta**: usar o saldo do extrato quando o arquivo trouxer; senão calcular pelas movimentações.
- DRE, Contabilidade (receita realizada/tributos estimados) e Relatórios passam a refletir esses lançamentos;
  corrigir o **gráfico do DRE** (bloco cinza) em Relatórios.
- Aceite: após importar o extrato, Cobranças/Despesas/DRE/Relatórios mostram os valores; saldo ≠ 0; reimportar não duplica.

## LOTE D — Asaas e Pluggy
- Mostrar a mensagem exata do Asaas/Pluggy nos erros (status + descrição).
- Dono: desativar restrição de IP da chave no Asaas (se houver) e colar as chaves na tela de Integrações (copiar/colar).
- Pluggy: se após colar o Secret continuar recusado → trial vencido bloqueia a API; o C6 passa a entrar por
  importação de extrato (OFX/CSV), como a Cora.

## LOTE E — Paridade, testes e entrega
- Tudo igual no Santa Fé (Next/Prisma). Testes automáticos com serviços simulados; build/tsc/eslint/vitest nos dois.
- Handoff + commit + push a cada lote; PR por repositório; deploy e migrações só com autorização do dono.

## Pendências do dono
1. Autorizar os lotes A–E (e o deploy ao final).
2. Confirmar a lista de categorias (ou ajustar).
3. Railway: descartar a alteração pendente em `SERVER_URL` e apagar o token criado em Project Settings › Tokens.

## Ordem sugerida
A1 → A3 → A2 → C → B → D → E (WhatsApp primeiro porque já está em uso; depois o financeiro).
