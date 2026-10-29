# HANDOFF — Organização completa do Google Drive (Grupo Santa Fé) — 29/10/2026

Branch: `claude/drive-organizacao-20261029` · Spec: `docs/handoffs/drive/SPEC-DRIVE-ORGANIZACAO.md`
Paridade: a Prospecta implementa a mesma spec em paralelo (mesmos nomes de pastas/etiquetas).

## Concluído
- Etapa 1 — `web/src/lib/drive-estrutura.ts`: caminhos e nomes dos novos tipos (Equipe, Modelos/PCI CAIXA,
  Obras/Fotos/Medição NN, Gerador de PCI, WhatsApp com/sem cliente, Incorporação/Orçamento) e `entidadeDaChave`
  (pastas de entidade para a varredura de órfãs). Testes: `web/src/lib/__tests__/drive-estrutura-organizacao.test.ts`.

## Pendências (ordem)
2. Migração `20261029100000_drive_organizacao` (colunas driveFileId) + schema.
3. Primitivas no `registro-drive.ts` + `drive-organizacao.ts` (cópia por tipo + sincronizador).
4. Gravação no Drive nos pontos de upload.
5. Exclusões → lixeira.
6. Cron + botão "Organizar Drive agora".

## Testes
(a) automáticos: vitest drive-estrutura(-organizacao) — 15 passando.
(b) manuais: nenhum.
(c) produção: tudo pendente (migração não aplicada).

## Próximo passo
Etapa 2 (migração).
