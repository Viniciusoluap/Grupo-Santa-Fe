# Lote 3 — publicação concluída (30/10/2026 ~01:30 UTC)

- PRs mesclados: Prospecta #180 (main f9767be) e Santa Fé #242 (main 45d5c18).
- Migrações em produção (aplicadas antes do merge): Neon 0094, 0095, 0096; Supabase 20261029110000, 20261029111000, 20261029112000.
- Deploys de produção READY: Prospecta dpl_93yik4Dw7adT94R9B38KAAG8g73B; Santa Fé dpl_47dpkQUkBWWwZAndkJJvKWBzEm8R.
- Erros de runtime na Vercel desde 01:15 UTC: nenhum nos dois projetos.
- Revisão automática: 6 achados (3 por PR) corrigidos com paridade e threads resolvidas (ver seção L11 do MASTER_STATUS).

## Testes
- (a) Automáticos: Prospecta 173 arquivos / 1393 testes OK, check e build OK. Santa Fé tsc OK; vitest com banco 1212 OK + 11 falhas pré-existentes na main (exclusao-definitiva, projeto-engenheiro, medicao-drive, bancos-sync Asaas, obra-pagamento-etapa); next build OK. Layout Chromium 9/9 nos dois. Migrações testadas em banco limpo.
- (b) Manuais: capturas no Chromium.
- (c) Pendente em produção: Safari real (iPhone/iPad); Pluggy com credencial real; PCI com modelo .xlsm real (regra de listas iguais); fluxos com dados reais (combinar/excluir em lote, vínculo CRM, DRE, relatórios).

## Próximo
Lote 4 em `claude/lote4-ajustes-20261030` (docs/handoffs/lote4/STATUS.md).

## Correção 30/10 ~01:50 UTC — domínios não estavam na versão nova
- O dono abriu os sistemas e nada novo aparecia. Causa: os domínios oficiais (www.prospectaconstrucoes.com e www.gruposantafee.com.br) continuavam presos a um deploy antigo — a atribuição automática de domínio para produção estava desligada (efeito de um rollback anterior). Os deploys "READY" de produção ficavam só na URL própria.
- Ação: promovidos manualmente (Vercel promote) Prospecta dpl_93yik4Dw7adT94R9B38KAAG8g73B e Santa Fé dpl_47dpkQUkBWWwZAndkJJvKWBzEm8R. Conferido: o domínio da Prospecta passou a servir o bundle novo (index-C9GVgwxP.js) e o domínio do SF aparece como alias do deploy novo.
- Regra daqui em diante: após cada merge, conferir que o domínio oficial serve o deploy novo (alias/bundle) antes de dizer "em produção".
- Botão "Organizar Drive agora" fica em **Admin › Configurações** (cartão Google Drive), nos dois sistemas — não em Integrações.
