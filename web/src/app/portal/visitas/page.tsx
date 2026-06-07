import { Calendar, Clock, MapPin, Phone } from "lucide-react";
import { getClientProcess } from "@/lib/data/portal";

const scheduledVisits = [
  {
    id: "v1",
    date: "2026-06-15",
    time: "10:00",
    property: "Residencial Jardim Novo — Apto 204, Bloco B",
    address: "Rua das Flores, 123 — Jardim Novo, Goiânia-GO",
    corretor: "João Santos",
    phone: "(62) 9 9999-1111",
    status: "agendada" as const,
  },
];

const pastVisits = [
  {
    id: "pv1",
    date: "2026-01-25",
    time: "14:00",
    property: "Residencial Jardim Novo — Apto 204, Bloco B",
    address: "Rua das Flores, 123 — Jardim Novo, Goiânia-GO",
    corretor: "João Santos",
    phone: "(62) 9 9999-1111",
    status: "realizada" as const,
    notes: "Cliente aprovou o imóvel. Iniciado processo de financiamento.",
  },
];

export default function PortalVisitasPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Visitas</h1>
        <p className="text-gray-400 text-sm mt-0.5">{scheduledVisits.length} visita agendada</p>
      </div>

      {/* Próximas visitas */}
      <div>
        <h2 className="font-bold text-[var(--brand-dark)] text-sm uppercase tracking-widest mb-3">Próximas Visitas</h2>
        {scheduledVisits.length === 0 ? (
          <div className="bg-white border border-gray-100 p-8 text-center">
            <Calendar size={28} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Nenhuma visita agendada.</p>
            <p className="text-gray-400 text-xs mt-1">Entre em contato com seu corretor para agendar.</p>
          </div>
        ) : (
          scheduledVisits.map((v) => (
            <div key={v.id} className="bg-white border border-[var(--brand-yellow)] p-5">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-[var(--brand-yellow)] flex flex-col items-center justify-center shrink-0">
                  <span className="font-black text-xl text-[var(--brand-dark)] leading-none">
                    {new Date(v.date).getDate()}
                  </span>
                  <span className="text-[9px] font-bold uppercase text-[var(--brand-dark)]">
                    {new Date(v.date).toLocaleString("pt-BR", { month: "short" })}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-[var(--brand-dark)]">{v.property}</p>
                    </div>
                    <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 uppercase shrink-0">Agendada</span>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Clock size={11} /> {v.time}</span>
                    <span className="flex items-center gap-1"><MapPin size={11} /> {v.address}</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <a
                      href={`https://wa.me/55${v.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700 text-white font-bold uppercase tracking-wider px-3 py-1.5 transition-colors"
                    >
                      <Phone size={11} /> Confirmar com corretor
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Histórico */}
      {pastVisits.length > 0 && (
        <div>
          <h2 className="font-bold text-[var(--brand-dark)] text-sm uppercase tracking-widest mb-3">Histórico de Visitas</h2>
          {pastVisits.map((v) => (
            <div key={v.id} className="bg-white border border-gray-100 p-5 opacity-80">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-gray-100 flex flex-col items-center justify-center shrink-0">
                  <span className="font-black text-xl text-gray-500 leading-none">
                    {new Date(v.date).getDate()}
                  </span>
                  <span className="text-[9px] font-bold uppercase text-gray-400">
                    {new Date(v.date).toLocaleString("pt-BR", { month: "short" })}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-[var(--brand-dark)]">{v.property}</p>
                    <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 uppercase shrink-0">Realizada</span>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Clock size={11} /> {v.time}</span>
                  </div>
                  {v.notes && <p className="text-xs text-gray-500 mt-2 italic">"{v.notes}"</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Request new visit */}
      <div className="bg-white border border-gray-100 p-5">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Solicitar Nova Visita</p>
        <p className="text-sm text-gray-500 mb-4">Para agendar uma visita a outro imóvel, entre em contato com seu corretor pelo WhatsApp.</p>
        <a
          href="https://wa.me/5594993044689"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold text-xs uppercase tracking-wider px-5 py-2.5 transition-colors"
        >
          <Phone size={13} /> Solicitar via WhatsApp
        </a>
      </div>
    </div>
  );
}
