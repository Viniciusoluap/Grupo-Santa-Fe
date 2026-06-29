import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Clock, MessageSquare } from "lucide-react";
import { getPortalInteracoes } from "@/lib/data/portal-real";
import { BackButton } from "@/components/ui/back-button";

const TIPO_INTERACAO: Record<string, string> = {
  ligacao:     "Ligação",
  whatsapp:    "WhatsApp",
  email:       "E-mail",
  visita:      "Visita",
  reuniao:     "Reunião",
  atualizacao: "Atualização",
  nota:        "Nota interna",
};

export default async function PortalAcompanhamentoPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const leadId = (session.user as { leadId?: string }).leadId;
  const interacoes = leadId ? await getPortalInteracoes(leadId) : [];

  return (
    <div className="space-y-5">
      <div>
        <BackButton className="mb-1" />
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Acompanhamento</h1>
        <p className="text-gray-400 text-sm mt-0.5">Histórico completo do seu processo</p>
      </div>

      {interacoes.length === 0 ? (
        <div className="bg-white border border-gray-100 p-10 text-center">
          <Clock size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhuma atualização registrada</p>
          <p className="text-gray-400 text-sm mt-1">As atualizações do seu processo aparecerão aqui.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 divide-y divide-gray-50">
          {interacoes.map((interacao, i) => (
            <div key={interacao.id} className="flex gap-4 p-5">
              {/* Timeline dot */}
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full border-2 shrink-0 mt-0.5 ${
                  i === 0 ? "border-[var(--brand-yellow)] bg-[var(--brand-yellow)]" : "border-gray-300 bg-white"
                }`} />
                {i < interacoes.length - 1 && (
                  <div className="w-px flex-1 bg-gray-100 mt-1" />
                )}
              </div>
              {/* Content */}
              <div className="flex-1 pb-4">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 uppercase tracking-wide">
                    {TIPO_INTERACAO[interacao.tipo] ?? interacao.tipo}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(interacao.criadoEm).toLocaleDateString("pt-BR", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </span>
                  <span className="text-xs text-gray-400">por {interacao.criadoPor}</span>
                </div>
                <p className="text-sm text-[var(--brand-dark)] leading-relaxed">{interacao.descricao}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border border-dashed border-gray-200 p-5 text-center">
        <MessageSquare size={20} className="text-gray-300 mx-auto mb-2" />
        <p className="text-gray-400 text-sm">Tem dúvidas? Use o <a href="/portal/chat" className="text-[var(--brand-dark)] font-bold underline">chat</a> para falar com seu corretor.</p>
      </div>
    </div>
  );
}
