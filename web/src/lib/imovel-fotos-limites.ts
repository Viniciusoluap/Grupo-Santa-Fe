// Compartilhado pelo formulário e pelo servidor; limite ajustável no ambiente.
const configurado = Number(process.env.NEXT_PUBLIC_MAX_FOTOS_IMOVEL);
export const MAX_FOTOS_IMOVEL = Number.isInteger(configurado) && configurado >= 16 && configurado <= 100 ? configurado : 40;
