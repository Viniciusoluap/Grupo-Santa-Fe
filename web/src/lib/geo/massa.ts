// Estudo de massa — ponto de entrada histórico do Grupo Santa Fé.
//
// Paridade 17/11 (bloco 2): o Santa Fé passa a ter UM motor só, igual à Prospecta (`shared/incorporacao/massa.ts`,
// versão 3.0.0 — malha conectada, lotes recortados pela divisa, sobras com destino, várias áreas e APP com contorno).
// O motor fica em `./massa-parcelamento`; este arquivo só reexporta para não quebrar quem já importa daqui
// (estudos salvos, abas, testes). O motor antigo de grade/cul-de-sac que vivia aqui foi substituído pelo da Prospecta,
// que já era o usado pela tela (worker/executar-massa).
export * from "./massa-parcelamento";
