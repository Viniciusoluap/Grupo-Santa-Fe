# HANDOFF 17/11 — Termo de consentimento + endereço da Avaliação (Grupo Santa Fé, paridade bloco 4)

Branch: `claude/paridade17-b4-termo`. Gêmeo na Prospecta: `claude/paridade17-termo` (mesmo handoff na raiz).
Porta o EPIC-024 S-12 da Prospecta (commit `2b7f064`) já com o texto definitivo e a retirada registrada, e aplica a
regra única do endereço da Avaliação. Sem merge, sem PR, sem deploy e **sem migração aplicada**.

## Texto final do termo (resumo dos pontos decididos)
Mesma estrutura nos dois sistemas (8 seções). Nada de "texto provisório", colchetes ou pendências do jurídico.

| Item | Decisão |
|---|---|
| 1. Controlador | Prospecta: PROSPECTA CONSTRUÇÕES E AVALIAÇÃO IMOBILIÁRIA LTDA, CNPJ 41.865.900/0001-89, R. Gonçalves Dias, 1993 - Juçara, Imperatriz - MA, 65900-545 (`shared/empresa.ts`). Santa Fé: "Grupo Santa Fé" (nome comercial), Rua B, Nº 40 - Ouro Preto, Canaã dos Carajás - PA, 68350-307 (igual ao rodapé do site, `web/src/lib/empresa.ts`). |
| Encarregado (art. 41) | Canal de atendimento ao titular, sem nome de pessoa (nenhum responsável nomeado nos repositórios). Prospecta: atendimento@prospectaconstrucoes.com / (99) 98139-2210. Santa Fé: comercial@gruposantafee.com.br / (94) 99304-4689. |
| 6. Guarda | Enquanto durar a relação; depois, só o que a lei manda/permite, pelos prazos legais (ex.: 5 anos para documentos fiscais e contábeis; prescrição para defesa de direitos); então eliminação ou anonimização. O titular pode pedir a eliminação antes. Registro do aceite/retirada guardado como prova. Não promete apagamento automático. |
| 7. Prazo de resposta | Confirmação simples ao receber o pedido; declaração completa em até 15 dias (art. 19, II). |
| 7. Direitos | Lista do art. 18 (confirmação, acesso, correção, anonimização/bloqueio/eliminação, portabilidade, eliminação dos dados consentidos, compartilhamento, possibilidade de não consentir, revogação) + ANPD. |
| 7. Retirada | Pelo botão (Prospecta: Meu perfil; Santa Fé: fim da página do termo, logado) ou pelos contatos, e a equipe registra. Fica registrada com data, hora e quem registrou. Vale dali em diante, não desfaz o passado; o sistema volta a pedir o aceite ao entrar. |
| 4. IA | Prospecta: inalterada (atendimento WhatsApp, leitura de documentos/projetos, apoio à equipe; Anthropic, fora do Brasil). Santa Fé: só Central de Vendas no WhatsApp (entra desligada; mensagens, o que a pessoa informa e nome/tipo dos arquivos vão à Anthropic) e análise de mercado/imóveis (dados do imóvel, sem nome, CPF, telefone ou e-mail). Sem maquete nem assistente da equipe. |

## Como funciona a retirada
- Registro = linha NOVA na tabela só de inclusão `consentimentos`, `tipo = 'revogacao'`, com quem registrou
  (`registrado_por`/`registradoPor`) e quando; canal `admin` (pelo admin) ou `conta` (pelo próprio titular). O banco
  recusa retirada sem autor ou com canal de aceite; UPDATE/DELETE/TRUNCATE continuam recusados.
- Só contam os aceites DEPOIS da última retirada. Quem retirou: a consulta do admin mostra "retirado em … (registrado
  por …)"; ao entrar, o modal do termo volta (aceitar de novo ou sair), conta nova ou antiga. O aceite novo funciona.
- Retirar sem consentimento ativo (ou duas vezes) é recusado com "Não há consentimento ativo para retirar.".
- Admin: Prospecta "Usuários e acesso" › Termo de consentimento; Santa Fé Configurações › Termo de consentimento
  (aceites por papel e por usuário). Só admin ativo (por papel).

## Regra do endereço da Avaliação (igual nos dois)
- Criar ou vincular (ou trocar, no Santa Fé): o endereço vem do lead (campos que o lead tem preenchidos).
- O endereço é editável na avaliação; o que foi salvo nela nunca é sobrescrito pelo lead ao salvar a avaliação.
- Mudar o endereço do lead: campo a campo, a avaliação só muda onde o valor ainda é igual ao antigo do lead, ou está
  vazio / "A definir". Cidade e UF também seguem quando o endereço da avaliação está pendente. Comparação ignora
  espaços e maiúsculas. Lead que apaga um campo não apaga o da avaliação.

## Dados da empresa usados e o que faltou
- Usado (rodapé `src/components/layout/footer.tsx` e página Contato): nome comercial "Grupo Santa Fé"; Rua B, Nº 40 -
  Ouro Preto, Canaã dos Carajás - PA, CEP 68350-307; comercial@gruposantafee.com.br; (94) 99304-4689 (escritório).
- **Faltou**: razão social e CNPJ (não existem no repositório — só o campo em Configurações › Dados da Empresa, no
  banco). Quando o dono informar, pôr em `web/src/lib/empresa.ts` e subir `VERSAO_DO_TERMO`.

## Como o primeiro acesso do Santa Fé se encaixa
- Link `/definir-senha/[token]`: só existe para conta NOVA (`criarUsuario` sem senha, `vincularUsuarioCorretor`). A
  caixa aparece desmarcada; sem marcar, o servidor recusa e a senha não é gravada; senha + aceite na mesma transação
  (`updateMany` com o token ainda válido). Já aceitou a versão vigente: sem caixa. Versão anterior: caixa opcional.
- Conta criada já com senha (`criarUsuario` com senha, `/admin/corretores/novo`): a partir de 17/11/2026 00:00 UTC, aceita
  no primeiro login — modal (`ConsentimentoNoLogin`) nas áreas admin, portal, corretor e empreiteiro; não fecha sem
  aceitar, dá para "Sair".
- Redefinição de senha (feita pelo admin, sem link) não pede de novo. "Pedir no próximo login" a todos: pronto e
  DESLIGADO (`CONSENTIMENTO_PEDIR_NO_LOGIN=1` liga).
- Página pública: `/termo-de-consentimento` (logado com consentimento ativo: botão "Retirar consentimento" no fim).
- Admin: Configurações › Termo de consentimento — aceites por papel, por usuário, retiradas, botão "Registrar retirada".

## Arquivos
- `web/prisma/schema.prisma` (bloco `// ── Paridade 17/11 bloco 4 ──`, model `Consentimento`) e
  `web/prisma/migrations/20261117400000_consentimentos/migration.sql` (nova; aditiva, idempotente, só inclusão por
  gatilho, CHECKs, RLS ligado, REVOKE anon/authenticated; **NÃO aplicada**).
- `web/src/lib/termo-consentimento.ts`, `web/src/lib/empresa.ts`, `web/src/lib/consentimento.ts` (regras),
  `web/src/lib/actions/consentimento.ts` (aceitar no login, retirar, retirada pelo admin), `web/src/lib/actions/primeiro-acesso.ts`.
- Telas: `web/src/components/consentimento/*`, `web/src/app/(site)/termo-de-consentimento/page.tsx`,
  `web/src/app/definir-senha/[token]/*`, layouts `admin`, `portal`, `corretor`, `empreiteiro`,
  `web/src/app/admin/configuracoes/{page.tsx,_components/termo-consentimento-admin.tsx}`.
- Endereço: `web/src/lib/crm/servicos-lead.ts` (`enderecoDaAvaliacaoAposLead`, `enderecoAoVincular`),
  `web/src/lib/crm/vinculo-lead.ts` (propagação campo a campo com o endereço anterior), `web/src/lib/actions/leads.ts`
  (passa o endereço anterior), `web/src/lib/actions/avaliacoes.ts` (vincular/trocar lead copia o endereço; UF ausente
  no formulário é mantida — antes voltava para "PA" a cada salvamento).

## Testes
(a) Automáticos (comandos reais, nesta branch):
- `npx tsc --noEmit -p .` — ok.
- `npx eslint` nos arquivos alterados — 0 erros (1 aviso antigo: `_formData` em `actions/avaliacoes.ts`).
- `npx vitest run --maxWorkers=3` — 183 arquivos ok, 29 pulados (precisam de TEST_DATABASE_URL), **3 arquivos / 4 testes
  com "Test timed out in 5000ms"** (`anexos-qualquer-tipo`, `bpo-paridade-migracao`, `central-vendas-migracao.db` — PGlite,
  máquina com carga ~10 em 4 núcleos por outras frentes). Rodados sozinhos: **8/8, 1/1, 2/2 ok**. Não tocam este código.
  Novos: `consentimento.db.test.ts` (14, Prisma real sobre PGlite + migração 2x), `termo-consentimento.test.ts` (8),
  `avaliacao-endereco.test.ts` (6), +1 em `lead-endereco-paridade.test.ts`. Ajustes (nada apagado/pulado): mock
  `findMany` em `lead-endereco-paridade`, 3º argumento do `propagar` em `leads-falha-servicos`.
- `npx next build` — compilou e passou o TypeScript; falhou só na geração estática de "/" sem banco (esperado).
(b) Manuais: nenhum nesta sessão.
(c) Pendente em produção: aplicar a migração; criar conta sem senha e definir pelo link; criar conta com senha e
entrar (modal); retirar (admin e página do termo); endereço de avaliação vinculada.

## Riscos
- **Aplicar a migração antes de publicar**: sem a tabela, o link de primeiro acesso mostra "Não foi possível verificar
  agora" no lugar do formulário (o modal e a tela do admin degradam sem derrubar a página).
- Contas criadas com senha a partir de 17/11 e antes da publicação verão o modal uma vez no próximo acesso.
- O servidor não bloqueia as rotas de quem não aceitou (a trava é o modal) — igual à Prospecta.
- `criadoEm` é `timestamp` sem fuso gravado pelo Prisma em UTC; a borda de 17/11 00:00 UTC assume isso.

## Próximo passo exato
1. QA (@qa). 2. Aplicar `web/prisma/migrations/20261117400000_consentimentos/migration.sql` no Supabase.
3. PR → main e conferir a Vercel. 4. Validar (c). 5. Informar razão social e CNPJ e subir a versão do termo.
