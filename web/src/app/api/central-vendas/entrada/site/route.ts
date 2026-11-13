import { responderEntrada } from "@/lib/central-vendas/rotas";

// Central de Vendas (paridade com a Prospecta, 13/11): entrada de leads do formulário do site,
// com token próprio (Authorization: Bearer), payload validado e limitação de taxa.
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  return responderEntrada("site", req);
}
