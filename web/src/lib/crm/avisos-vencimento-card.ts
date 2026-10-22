import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { chaveDoCard, diaEmImperatriz } from "@/lib/crm/vencimento-card";

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[c] || c);

export async function enviarAvisosVencimentoCards(now = new Date()) {
  const today = diaEmImperatriz(now);
  const todayDate = new Date(`${today}T00:00:00Z`);
  const [recipients, cards] = await Promise.all([
    prisma.usuario.findMany({ where: { ativo: true, papel: { in: ["admin", "colaborador"] } },
      select: { id: true, email: true, papel: true } }),
    prisma.lead.findMany({ where: { excluidoEm: null, arquivadoEm: null,
      vencimentoCard: { lte: todayDate }, NOT: { etapaOperacional: "finalizado" } },
      select: { id: true, nome: true, responsavelId: true, vencimentoCard: true } }),
  ]);
  let emailSent = 0;
  let notifications = 0;
  for (const recipient of recipients) {
    const assigned = cards.filter(card => recipient.papel === "admin" || card.responsavelId === recipient.id);
    if (!assigned.length) continue;
    const previous = await prisma.avisoVencimentoCard.findMany({ where: { usuarioId: recipient.id },
      select: { leadId: true, vencimento: true, canal: true } });
    const sent = new Set(previous.map(p => `${p.leadId}:${chaveDoCard(p.vencimento)}:${p.canal}`));
    const pending = (channel: string) => assigned.filter(card => !sent.has(`${card.id}:${chaveDoCard(card.vencimentoCard)}:${channel}`));
    const notice = pending("notice");
    const email = pending("email");
    if (!notice.length && !email.length) continue;
    try { await prisma.resumoVencimentoCard.create({ data: { usuarioId: recipient.id, dia: todayDate } }); }
    catch { continue; } // outro cron já reivindicou este destinatário neste dia
    let mailOk = false;
    try {
      if (notice.length) {
        const count = notice.length;
        await prisma.notificacao.create({ data: {
          usuarioId: recipient.id, tipo: "vencimento_card",
          titulo: `${count} card${count === 1 ? "" : "s"} precisam da sua atenção hoje`,
          mensagem: notice.map(card => `${card.nome} (${chaveDoCard(card.vencimentoCard)})`).join("; "),
          link: "/admin/leads",
        } });
        await prisma.avisoVencimentoCard.createMany({ skipDuplicates: true, data: notice.map(card => ({
          usuarioId: recipient.id, leadId: card.id, vencimento: card.vencimentoCard!, canal: "notice",
        })) });
        notifications++;
      }
      if (email.length) {
        const origin = process.env.SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
        const lines = email.map(card => `<li>${escapeHtml(card.nome)} — ${chaveDoCard(card.vencimentoCard)} — ${origin ? `<a href="${escapeHtml(origin)}/admin/leads/${card.id}">Abrir lead</a>` : "Abra o CRM"}</li>`).join("");
        mailOk = await sendEmail({ to: recipient.email,
          subject: `[CRM] ${email.length} card${email.length === 1 ? "" : "s"} precisam da sua atenção hoje`,
          html: `<p>Estes cards precisam da sua atenção hoje:</p><ul>${lines}</ul>`,
        });
        if (mailOk) {
          await prisma.avisoVencimentoCard.createMany({ skipDuplicates: true, data: email.map(card => ({
            usuarioId: recipient.id, leadId: card.id, vencimento: card.vencimentoCard!, canal: "email",
          })) });
          emailSent++;
        }
      }
    } finally {
      if (email.length && !mailOk) await prisma.resumoVencimentoCard.delete({
        where: { usuarioId_dia: { usuarioId: recipient.id, dia: todayDate } },
      });
    }
  }
  return { emailSent, notifications };
}
