import Link from "next/link";
import { Calendar, Clock, MapPin, User, CheckCircle2, XCircle } from "lucide-react";
import { getUpcomingVisits, leads } from "@/lib/data/leads";

const allVisits = leads.flatMap((l) => l.visits.map((v) => ({ ...v, lead: l })));
const byDate = allVisits.reduce((acc, v) => {
  const d = new Date(v.scheduledAt).toLocaleDateString("pt-BR");
  if (!acc[d]) acc[d] = [];
  acc[d].push(v);
  return acc;
}, {} as Record<string, typeof allVisits>);

const upcomingVisits = getUpcomingVisits();

export default function AgendaPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Agenda de Visitas</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {upcomingVisits.length} visita{upcomingVisits.length !== 1 ? "s" : ""} agendada{upcomingVisits.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Upcoming */}
        <div className="lg:col-span-2 space-y-4">
          {upcomingVisits.length === 0 ? (
            <div className="bg-white border border-gray-100 p-10 text-center">
              <Calendar size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400">Nenhuma visita agendada.</p>
            </div>
          ) : (
            upcomingVisits.map(({ lead, visit }) => (
              <div key={visit.id} className="bg-white border border-gray-100 p-5 flex gap-4">
                <div className="w-14 h-14 bg-[var(--brand-yellow)] flex flex-col items-center justify-center shrink-0">
                  <span className="font-black text-xl text-[var(--brand-dark)] leading-none">
                    {new Date(visit.scheduledAt).getDate()}
                  </span>
                  <span className="text-[9px] font-bold uppercase text-[var(--brand-dark)]">
                    {new Date(visit.scheduledAt).toLocaleString("pt-BR", { month: "short" })}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-[var(--brand-dark)]">{lead.name}</p>
                      <p className="text-gray-400 text-sm">{visit.propertyTitle}</p>
                    </div>
                    <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 uppercase shrink-0">
                      {visit.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {new Date(visit.scheduledAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="flex items-center gap-1">
                      <User size={11} />
                      {lead.assignedTo}
                    </span>
                  </div>
                  {visit.notes && <p className="text-xs text-gray-400 mt-1 italic">{visit.notes}</p>}
                  <div className="flex gap-2 mt-3">
                    <Link href={`/admin/leads/${lead.id}`} className="text-xs bg-[var(--brand-dark)] hover:bg-[var(--brand-dark-secondary)] text-[var(--brand-yellow)] font-bold uppercase tracking-wider px-3 py-1.5 transition-colors">
                      Ver Lead
                    </Link>
                    <button className="text-xs bg-green-50 hover:bg-green-100 text-green-600 font-bold uppercase tracking-wider px-3 py-1.5 transition-colors flex items-center gap-1">
                      <CheckCircle2 size={11} /> Realizada
                    </button>
                    <button className="text-xs bg-red-50 hover:bg-red-100 text-red-500 font-bold uppercase tracking-wider px-3 py-1.5 transition-colors flex items-center gap-1">
                      <XCircle size={11} /> Cancelar
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* All visits history */}
          <div className="bg-white border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-[var(--brand-dark)] text-sm uppercase tracking-wide">Histórico Completo</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {allVisits.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()).map((v) => (
                <div key={v.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-[var(--brand-dark)] text-sm">{v.lead.name}</p>
                    <p className="text-gray-400 text-xs">{v.propertyTitle} · {new Date(v.scheduledAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 uppercase shrink-0 ${v.status === "realizada" ? "bg-green-100 text-green-700" : v.status === "cancelada" ? "bg-red-100 text-red-500" : "bg-purple-100 text-purple-700"}`}>
                    {v.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar stats */}
        <div className="space-y-4">
          <div className="bg-[var(--brand-dark)] p-5">
            <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-4">Resumo</p>
            {[
              { label: "Agendadas", value: allVisits.filter((v) => v.status === "agendada").length, color: "text-purple-400" },
              { label: "Realizadas", value: allVisits.filter((v) => v.status === "realizada").length, color: "text-green-400" },
              { label: "Canceladas", value: allVisits.filter((v) => v.status === "cancelada").length, color: "text-red-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-gray-400 text-sm">{label}</span>
                <span className={`font-black text-xl ${color}`}>{value}</span>
              </div>
            ))}
          </div>

          <div className="bg-white border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Nova Visita Rápida</p>
            <div className="space-y-2">
              <select className="w-full border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none">
                {leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <input type="datetime-local" className="w-full border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:border-[var(--brand-yellow)]" />
              <input type="text" placeholder="Imóvel..." className="w-full border border-gray-200 px-3 py-2 text-xs focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50" />
              <button className="w-full bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider py-2 transition-colors">
                Agendar Visita
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
