import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Calendar, Clock, MapPin } from "lucide-react";
import { getPortalVisitas } from "@/lib/data/portal-real";
import { BackButton } from "@/components/ui/back-button";

const STATUS_VISITA: Record<string, { label: string; color: string }> = {
  agendada:   { label: "Agendada",   color: "bg-blue-100 text-blue-700" },
  realizada:  { label: "Realizada",  color: "bg-green-100 text-green-700" },
  cancelada:  { label: "Cancelada",  color: "bg-red-100 text-red-500" },
  reagendada: { label: "Reagendada", color: "bg-yellow-100 text-yellow-700" },
};

export default async function PortalVisitasPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const leadId = (session.user as { leadId?: string }).leadId;
  const visitas = leadId ? await getPortalVisitas(leadId) : [];

  return (
    <div className="space-y-5">
      <div>
        <BackButton className="mb-1" />
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Visitas</h1>
        <p className="text-gray-400 text-sm mt-0.5">{visitas.length} visita{visitas.length !== 1 ? "s" : ""} registrada{visitas.length !== 1 ? "s" : ""}</p>
      </div>

      {visitas.length === 0 ? (
        <div className="bg-white border border-gray-100 p-10 text-center">
          <Calendar size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhuma visita agendada</p>
          <p className="text-gray-400 text-sm mt-1">Entre em contato com seu corretor para agendar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visitas.map((v) => {
            const st = STATUS_VISITA[v.status] ?? STATUS_VISITA.agendada;
            return (
              <div key={v.id} className="bg-white border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-[var(--brand-yellow)]" />
                      <span className="font-bold text-[var(--brand-dark)] text-sm">
                        {new Date(v.agendadaPara).toLocaleDateString("pt-BR", {
                          weekday: "long", day: "2-digit", month: "long", year: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={12} className="text-gray-400" />
                      <span className="text-xs text-gray-500">
                        {new Date(v.agendadaPara).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {v.imovel && (
                      <div className="flex items-center gap-2">
                        <MapPin size={12} className="text-gray-400" />
                        <span className="text-xs text-gray-500">{v.imovel.titulo} — {v.imovel.bairro}</span>
                      </div>
                    )}
                    {v.corretor && (
                      <p className="text-xs text-gray-400">Corretor: {v.corretor.nome}</p>
                    )}
                    {v.notas && (
                      <p className="text-xs text-gray-400 italic">{v.notas}</p>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 uppercase ${st.color}`}>
                    {st.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
