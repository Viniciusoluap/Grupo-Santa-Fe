import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { prisma } from "@/lib/db";
import { usuarioAtual } from "@/lib/auth/modulos";
import { alertasCalculados } from "@/lib/notificacoes-calculadas";
import { ListaNotificacoes } from "./lista-notificacoes";

export const dynamic = "force-dynamic";

/** Pedido de 23/10 (H4): página "Ver todas" (paridade com /notificacoes da Prospecta). */
export default async function NotificacoesPage() {
  const usuario = await usuarioAtual();
  if (!usuario?.ativo) redirect("/login");
  const notificacoes = await prisma.notificacao.findMany({
    where: { usuarioId: usuario.id }, orderBy: { criadoEm: "desc" }, take: 100,
    select: { id: true, tipo: true, titulo: true, mensagem: true, link: true, lida: true, criadoEm: true },
  });
  // Mesmos alertas calculados do sino (cobranças e prazos de obra próximos).
  const alertas = usuario.perfil === "admin" || usuario.perfil === "colaborador" ? await alertasCalculados() : [];
  const naoLidas = notificacoes.filter((n) => !n.lida).length;
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase flex items-center gap-2"><Bell size={22} /> Notificações</h1>
        <p className="text-sm text-gray-600 mt-1">{naoLidas + alertas.length > 0 && naoLidas === 0 ? `${alertas.length} alerta(s) atual(is)` : naoLidas > 0 ? `${naoLidas} não lida(s)` : "Você está em dia com suas notificações."}</p>
      </div>
      <ListaNotificacoes naoLidas={naoLidas} notificacoes={[
        ...alertas.map((a) => ({ id: a.id, tipo: a.tipo, titulo: a.titulo, mensagem: a.mensagem, link: a.link, lida: false, calculada: true, quando: "Alerta atual" })),
        ...notificacoes.map((n) => ({
        ...n,
        quando: n.criadoEm.toLocaleString("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        criadoEm: undefined,
      }))]} />
    </div>
  );
}
