import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { FileText, MessageSquare } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";

export default async function PortalDocumentosPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const leadId = (session.user as { leadId?: string }).leadId;

  return (
    <div className="space-y-5">
      <div>
        <BackButton className="mb-1" />
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Documentos</h1>
        <p className="text-gray-400 text-sm mt-0.5">Documentos do seu processo</p>
      </div>

      {!leadId ? (
        <div className="bg-white border border-gray-100 p-10 text-center">
          <FileText size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Perfil não vinculado</p>
          <p className="text-gray-400 text-sm mt-1">Entre em contato com seu corretor para configurar o acesso.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-white border border-gray-100 p-10 text-center">
            <FileText size={28} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Nenhum documento enviado ainda</p>
            <p className="text-gray-400 text-sm mt-1">
              Sua equipe enviará documentos para você assinar ou visualizar aqui.
            </p>
            <a
              href="/portal/chat"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--brand-dark)] underline"
            >
              <MessageSquare size={14} /> Envie uma mensagem pelo chat
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
