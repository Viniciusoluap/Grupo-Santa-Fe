import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { FileText, MessageSquare, Download } from "lucide-react";
import { getPortalDocumentos } from "@/lib/data/portal-real";
import { BackButton } from "@/components/ui/back-button";
import { AssinaturaGovBr } from "./_components/assinatura-govbr";

const TIPO_DOC: Record<string, string> = {
  contrato_gerado: "Contrato",
  assinado: "Assinado",
  anexo: "Anexo",
};

const ASSINATURA_BADGE: Record<string, { label: string; cls: string }> = {
  pendente:   { label: "Assinatura pendente", cls: "bg-yellow-50 text-yellow-700" },
  solicitado: { label: "Assinatura solicitada", cls: "bg-blue-50 text-blue-700" },
  assinado:   { label: "Assinado", cls: "bg-green-50 text-green-700" },
  rejeitado:  { label: "Rejeitado", cls: "bg-red-50 text-red-600" },
};

export default async function PortalDocumentosPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const leadId = (session.user as { leadId?: string }).leadId;
  const contratos = leadId ? await getPortalDocumentos(leadId) : [];
  const temDocumentos = contratos.some((c) => c.documentos.length > 0);

  return (
    <div className="space-y-5">
      <div>
        <BackButton className="mb-1" />
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Documentos</h1>
        <p className="text-gray-400 text-sm mt-0.5">Contratos e documentos do seu processo</p>
      </div>

      {!leadId ? (
        <div className="bg-white border border-gray-100 p-10 text-center">
          <FileText size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Perfil não vinculado</p>
          <p className="text-gray-400 text-sm mt-1">Entre em contato com seu corretor para configurar o acesso.</p>
        </div>
      ) : !temDocumentos ? (
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
      ) : (
        <div className="space-y-4">
          {contratos.filter((c) => c.documentos.length > 0).map((contrato) => {
            const badge = ASSINATURA_BADGE[contrato.assinaturaStatus] ?? ASSINATURA_BADGE.pendente;
            const pdfGerado = contrato.documentos.find((d) => d.tipo === "contrato_gerado");
            return (
              <div key={contrato.id} className="bg-white border border-gray-100">
                <div className="flex items-center justify-between gap-3 flex-wrap px-5 py-3 border-b border-gray-50">
                  <div>
                    <p className="text-sm font-bold text-[var(--brand-dark)]">
                      Contrato {contrato.numero}
                    </p>
                    <p className="text-xs text-gray-400 capitalize">{contrato.tipo}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 uppercase tracking-wide ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>
                <div className="divide-y divide-gray-50">
                  {contrato.documentos.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3 px-5 py-3">
                      <FileText size={16} className="text-gray-300 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[var(--brand-dark)] truncate">{doc.nome}</p>
                        <p className="text-xs text-gray-400">
                          {TIPO_DOC[doc.tipo] ?? doc.tipo} ·{" "}
                          {new Date(doc.criadoEm).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-bold text-[var(--brand-dark)] underline shrink-0"
                      >
                        <Download size={12} /> Baixar
                      </a>
                    </div>
                  ))}
                </div>
                {contrato.assinaturaStatus === "solicitado" && pdfGerado && (
                  <AssinaturaGovBr
                    contratoId={contrato.id}
                    numero={contrato.numero}
                    pdfUrl={pdfGerado.url}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
