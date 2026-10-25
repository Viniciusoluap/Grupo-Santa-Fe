// Envio de texto pela API oficial do WhatsApp Business (Meta Cloud API). Extraído de
// src/app/api/whatsapp/enviar/route.ts para ser usado também pela resposta das Conversas (25/10).
export async function enviarWhatsappBusiness(token: string, phoneNumberId: string, numero: string, texto: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const num = numero.replace(/\D/g, "");
  const numFinal = num.startsWith("55") ? num : `55${num}`;
  const res = await fetchImpl(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messaging_product: "whatsapp", to: numFinal, type: "text", text: { body: texto } }),
  });
  if (!res.ok) return null;
  const data = await res.json() as { messages?: { id: string }[] };
  return data.messages?.[0]?.id ?? null;
}
