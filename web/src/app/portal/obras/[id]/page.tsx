import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { carregarProgressoObra, calculoDoProgresso } from "@/lib/obras/progresso-dados";
import { etapasDoProgresso } from "@/lib/financeiro/detalhe-obra";
import { formatarPercentual, progressoDaObra } from "@/lib/financeiro/progresso";
import { rotulo } from "@/lib/rotulos";

// Pedido de 18/10 (item 14): o cliente acompanha, só leitura, as etapas por
// incidência e as medições salvas da própria obra — os mesmos números da tela
// da equipe, sem valores financeiros. A obra é conferida pelo lead da sessão.
const COR = { concluida: "bg-green-500", em_andamento: "bg-[var(--brand-yellow)]", pendente: "bg-gray-400" } as const;
const SITUACAO = { concluida: "Concluída", em_andamento: "Em andamento", pendente: "Não iniciada" } as const;

export default async function ObraDoClientePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  const leadId = (session.user as { leadId?: string }).leadId;
  const { id } = await params;
  if (!leadId) notFound();
  const obra = await prisma.obra.findFirst({
    where: { id, leadId },
    select: {
      id: true, nome: true, status: true, endereco: true, progresso: true, progressoMedido: true, dataPrevisaoFim: true,
      fotos: { orderBy: { tiradaEm: "desc" }, take: 24, select: { id: true, legenda: true, tiradaEm: true } },
    },
  });
  if (!obra) notFound();
  const dados = await carregarProgressoObra(obra.id);
  const etapas = dados ? etapasDoProgresso(calculoDoProgresso(dados)) : [];
  const medicoes = dados?.historico ?? [];
  const geral = progressoDaObra(obra.progressoMedido == null ? null : String(obra.progressoMedido), obra.progresso);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/portal/obras" className="text-sm font-medium text-gray-600 underline hover:text-[var(--brand-dark)]">Minhas obras</Link>
        <h1 className="mt-1 break-words text-2xl font-black uppercase tracking-wide text-[var(--brand-dark)]">{obra.nome}</h1>
      </div>
      <section className="space-y-3 border border-gray-100 bg-white p-5">
        <div className="flex flex-wrap gap-2">
          <span className="bg-[var(--brand-yellow)] px-2 py-1 text-xs font-bold text-[var(--brand-dark)]">{rotulo(obra.status)}</span>
          <span className="border border-gray-300 px-2 py-1 text-xs text-gray-700">Somente acompanhamento</span>
        </div>
        <div className="h-3 overflow-hidden rounded bg-gray-200"><div className="h-full bg-[var(--brand-yellow)]" style={{ width: `${Math.min(100, Math.max(0, geral))}%` }} /></div>
        <p className="font-semibold text-[var(--brand-dark)]">{formatarPercentual(geral)} concluído</p>
        {obra.dataPrevisaoFim && <p className="text-sm text-gray-600">Previsão: {obra.dataPrevisaoFim.toLocaleDateString("pt-BR")}</p>}
      </section>

      <section className="space-y-4 border border-gray-100 bg-white p-5">
        <h2 className="text-lg font-bold text-[var(--brand-dark)]">Etapas da obra</h2>
        {etapas.length === 0 && <p className="text-sm text-gray-600">As etapas aparecerão aqui assim que a equipe registrar a primeira medição.</p>}
        {etapas.map((etapa) => (
          <div key={etapa.chave} className="space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${COR[etapa.situacao]}`} aria-hidden />
                <b className="break-words text-[var(--brand-dark)]">{etapa.nome}</b>
              </div>
              <span className="shrink-0 text-sm font-semibold text-[var(--brand-dark)]">{formatarPercentual(etapa.execucao)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-gray-200"><div className="h-full bg-[var(--brand-yellow)]" style={{ width: `${Math.min(100, etapa.execucao)}%` }} /></div>
            <p className="text-xs text-gray-600">
              {SITUACAO[etapa.situacao]} · Incidência {formatarPercentual(etapa.incidencia)} · Representa {formatarPercentual(etapa.execucaoObra)} da obra
            </p>
          </div>
        ))}
      </section>

      <section className="border border-gray-100 bg-white p-5">
        <h2 className="mb-3 text-lg font-bold text-[var(--brand-dark)]">Medições salvas</h2>
        {medicoes.length === 0 ? (
          <p className="text-sm text-gray-600">Nenhuma medição registrada ainda.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {medicoes.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm text-[var(--brand-dark)]">
                <span>{new Date(m.criadoEm).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" })}</span>
                <b>{formatarPercentual(m.progresso)}</b>
              </li>
            ))}
          </ul>
        )}
      </section>

      {obra.fotos.length > 0 && (
        <section className="border border-gray-100 bg-white p-5">
          <h2 className="mb-3 text-lg font-bold text-[var(--brand-dark)]">Fotos da obra</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {obra.fotos.map((foto) => (
              <a key={foto.id} href={`/api/obras/fotos/${foto.id}`} target="_blank" rel="noopener noreferrer" className="block min-w-0">
                {/* O endpoint confere a sessão e o lead dono da obra em cada acesso. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/obras/fotos/${foto.id}`} alt={foto.legenda || "Foto da obra"} className="aspect-video w-full object-cover" />
                <span className="mt-1 block break-words text-xs text-gray-600">{foto.legenda || foto.tiradaEm.toLocaleDateString("pt-BR")}</span>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
