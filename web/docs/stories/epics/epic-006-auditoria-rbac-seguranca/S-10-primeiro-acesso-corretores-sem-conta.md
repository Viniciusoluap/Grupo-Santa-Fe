# S-10 — Fecha a pendência de corretores sem conta vinculada (S-01)

## Contexto

A S-01 corrigiu o ciclo de identidade quebrado corretor↔usuário, mas os 3 corretores já
cadastrados em produção antes da correção ficaram sem `usuarioId` vinculado — nenhum conseguia
logar. Não havia como inferir credenciais retroativamente.

O sistema não tem nenhum mecanismo de envio de e-mail (nem SMTP, nem provedor como Resend) nem
uma conexão WhatsApp Business ativa em produção — então um fluxo "cria conta e manda e-mail
automático" não é possível sem adicionar uma dependência externa nova (conta em provedor,
credenciais, possivelmente configuração de domínio).

## Solução aplicada

- `Usuario` ganhou `tokenPrimeiroAcesso String? @unique` e `tokenPrimeiroAcessoExpira
  DateTime?` (migration aditiva).
- Nova action `vincularUsuarioCorretor(corretorId)` (`src/lib/actions/usuarios.ts`): cria o
  `Usuario` com uma senha placeholder aleatória inutilizável (nunca entregue a ninguém) e um
  token de 32 bytes com validade de 7 dias, e vincula `Corretor.usuarioId`.
- Nova página pública `/definir-senha/[token]` + action `definirSenhaPrimeiroAcesso`: o próprio
  corretor define sua senha real a partir do link — a senha nunca passa pelo admin nem pelo
  código desta sessão.
- Botão "Vincular conta" adicionado em `/admin/corretores` para qualquer corretor sem
  `usuarioId` (fica reutilizável para casos futuros, não só para os 3 atuais) — ao clicar,
  mostra o link gerado para o admin copiar e entregar ao corretor pelo canal que preferir
  (WhatsApp pessoal, ligação, etc.).

## O que ficou genuinamente manual

Como não há e-mail nem WhatsApp Business configurado em produção, a entrega do link ao
corretor não pôde ser automatizada — esse é o único passo que realmente não tinha como evitar
(este sistema não tem nenhum canal de comunicação automatizado com usuários externos hoje).

## Aplicado em produção (autorizado explicitamente pelo usuário)

Os 3 corretores confirmados como reais (Marcos Pereira dos Santos, Lucimar, Dione) já têm conta
criada e vinculada em produção, com link de primeiro acesso válido por 7 dias.

## Gates executados

- `npx tsc --noEmit` → limpo.
- `npx vitest run` → 299/299 testes passando.
- `npx eslint .` → 39 problemas, idêntico ao baseline.

## Paridade obrigatória — pendência registrada, não portada ainda

O Prospecta tem exatamente a mesma lacuna: `resetPassword` (`server/configuracoes-router.ts`)
deixa o admin digitar a senha diretamente, sem fluxo de token/link de primeiro acesso. Como
esta é uma funcionalidade nova (não uma correção de bug isolado), fica registrada como pendência
de port explícita — não implementada nesta sessão por decisão de foco (ver conversa).
