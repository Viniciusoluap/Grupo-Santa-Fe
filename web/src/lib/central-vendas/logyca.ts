// Central de Vendas — paridade com a Prospecta (13/11/2026; gêmeo de Prospecta/server/central-vendas/logyca.ts).
// Adaptador opcional da Logyca, DESLIGADO por padrão (config.logyca.ativo).
// Só o que a documentação oficial confirma (https://logyca-tecnologia.gitbook.io/logyca-tecnologia/llms.txt):
//  - envio de texto: POST no endpoint copiado do menu "Mensagens API", Authorization: Bearer <token>,
//    corpo { "number", "message" };
//  - entrada: chamadas do bloco "HTTP Request" dos fluxos para um endpoint nosso, com token próprio.
// Webhooks, contatos, tags e pipeline da Logyca NÃO são confirmados pela documentação: não usamos.
type Fetch = typeof fetch;

export async function enviarLogyca(c: { endpoint: string; token: string }, numero: string, mensagem: string, fetchImpl: Fetch = fetch): Promise<{ ok: boolean; status: number; erro?: string }> {
  let url: URL;
  try { url = new URL(c.endpoint); } catch { return { ok: false, status: 0, erro: "Endpoint da Logyca inválido." }; }
  if (url.protocol !== "https:") return { ok: false, status: 0, erro: "O endpoint da Logyca precisa ser https." };
  const d = numero.replace(/\D/g, "");
  try {
    const res = await fetchImpl(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.token}` },
      body: JSON.stringify({ number: d.startsWith("55") ? d : `55${d}`, message: mensagem }),
      signal: AbortSignal.timeout(15_000),
    });
    return res.ok ? { ok: true, status: res.status } : { ok: false, status: res.status, erro: `A Logyca respondeu HTTP ${res.status}.` };
  } catch {
    return { ok: false, status: 0, erro: "Não consegui falar com a Logyca." };
  }
}
