import { redirect } from "next/navigation";
import { FileCheck2, Download } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { STATUS_CONFIG, type FinanciamentoStatus } from "@/lib/types/financiamento";
import { rotulo } from "@/lib/rotulos";
import { EnviarDocumento } from "./enviar-documento";

// Pedido de 18/10 (item 15): o cliente acompanha o financiamento — etapas (só
// leitura, a atual em destaque), banco, modalidade e valores — e envia ou
// substitui os documentos do checklist. A consulta é presa ao lead da sessão.
const ETAPAS: FinanciamentoStatus[] = (Object.keys(STATUS_CONFIG) as FinanciamentoStatus[])
  .filter((s) => s !== "aguardando_configuracao" && s !== "cancelado")
  .sort((a, b) => STATUS_CONFIG[a].order - STATUS_CONFIG[b].order);

export default async function FinanciamentoDoClientePage() {
  const session = await auth();
  if (!session) redirect("/login");
  const leadId = (session.user as { leadId?: string }).leadId;
  const financiamentos = leadId
    ? await prisma.financiamento.findMany({
        where: { leadId },
        orderBy: { criadoEm: "desc" },
        include: { checklist: { orderBy: [{ grupo: "asc" }, { item: "asc" }], include: { arquivo: { select: { id: true, nome: true } } } } },
      })
    : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black uppercase tracking-wide text-[var(--brand-dark)]">Financiamento</h1>
        <p className="mt-1 text-sm text-gray-600">Acompanhe as etapas e envie os documentos pedidos pela equipe.</p>
      </div>
      {financiamentos.length === 0 && <div className="border border-gray-100 bg-white p-8 text-gray-700">Nenhum financiamento vinculado ao seu cadastro.</div>}
      {financiamentos.map((f) => {
        const atual = (ETAPAS as string[]).indexOf(f.status);
        return (
          <section key={f.id} className="space-y-4 border border-gray-100 bg-white p-5">
            <h2 className="break-words text-lg font-bold text-[var(--brand-dark)]">{f.imovel || "Financiamento imobiliário"}</h2>
            {f.status === "cancelado" ? (
              <p className="text-sm font-semibold text-red-700">Financiamento cancelado.</p>
            ) : (
              <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="Etapas do financiamento">
                {ETAPAS.map((etapa, i) => {
                  const feita = atual >= 0 && i < atual;
                  const corrente = i === atual;
                  return (
                    <li key={etapa} aria-current={corrente ? "step" : undefined}
                      className={`flex items-center gap-2 border px-3 py-2 text-sm ${corrente ? "border-[var(--brand-yellow)] bg-[var(--brand-dark)] font-bold text-[var(--brand-yellow)]" : feita ? "border-green-200 bg-green-50 text-green-800" : "border-gray-200 text-gray-700"}`}>
                      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs ${corrente ? "bg-[var(--brand-yellow)] text-[var(--brand-dark)]" : feita ? "bg-green-600 text-white" : "bg-gray-200 text-gray-700"}`}>{feita ? "✓" : i + 1}</span>
                      {STATUS_CONFIG[etapa].label}
                    </li>
                  );
                })}
              </ol>
            )}
            <dl className="grid gap-3 text-sm sm:grid-cols-2 md:grid-cols-3">
              <div><dt className="text-xs uppercase text-gray-600">Etapa atual</dt><dd className="font-semibold text-[var(--brand-dark)]">{rotulo(f.status)}</dd></div>
              <div><dt className="text-xs uppercase text-gray-600">Banco</dt><dd className="font-semibold text-[var(--brand-dark)]">{f.banco ? rotulo(f.banco) : "Em definição"}</dd></div>
              <div><dt className="text-xs uppercase text-gray-600">Modalidade</dt><dd className="font-semibold text-[var(--brand-dark)]">{rotulo(f.tipo)}</dd></div>
              <div><dt className="text-xs uppercase text-gray-600">Valor do imóvel</dt><dd className="font-semibold text-[var(--brand-dark)]">{f.valorImovel != null ? formatCurrency(f.valorImovel) : "—"}</dd></div>
              <div><dt className="text-xs uppercase text-gray-600">Valor financiado</dt><dd className="font-semibold text-[var(--brand-dark)]">{f.valorFinanciado != null ? formatCurrency(f.valorFinanciado) : "—"}</dd></div>
            </dl>
            <div>
              <h3 className="mb-2 font-bold text-[var(--brand-dark)]">Documentos</h3>
              {f.checklist.length === 0 && <p className="text-sm text-gray-700">A equipe ainda não liberou documentos para você enviar.</p>}
              <ul className="divide-y divide-gray-100">
                {f.checklist.map((item) => (
                  <li key={item.id} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--brand-dark)]">
                        <FileCheck2 size={16} className={item.concluido ? "text-green-700" : "text-gray-500"} />
                        {item.item}
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase ${item.concluido ? "bg-green-100 text-green-800" : item.arquivo ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-900"}`}>
                          {item.concluido ? "Aprovado" : item.arquivo ? "Enviado — em análise" : "Pendente"}
                        </span>
                      </p>
                      <p className="text-xs text-gray-600">{item.grupo}</p>
                      {item.arquivo && (
                        <a href={`/api/arquivo/${item.arquivo.id}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--brand-dark)] underline">
                          <Download size={12} /> {item.arquivo.nome}
                        </a>
                      )}
                    </div>
                    {!item.concluido && <EnviarDocumento itemId={item.id} temArquivo={!!item.arquivo} />}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        );
      })}
    </div>
  );
}
