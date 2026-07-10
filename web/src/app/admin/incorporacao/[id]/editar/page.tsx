import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { requirePageRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { editarEstudo } from "@/lib/actions/incorporacao";
import { BackButton } from "@/components/ui/back-button";
import { SeletorLocalizacao } from "../../_components/seletor-localizacao";

export default async function EditarEstudoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  requirePageRole(session, "admin");

  const { id } = await params;
  const estudo = await prisma.estudoIncorporacao.findUnique({ where: { id } });
  if (!estudo) notFound();

  return (
    <div className="space-y-5 max-w-xl">
      <div>
        <BackButton className="mb-1" />
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Editar estudo</h1>
        <p className="text-gray-400 text-sm mt-0.5">Atualize a identificação e a localização do empreendimento.</p>
      </div>

      <form action={editarEstudo} className="bg-white border border-gray-100 p-5 space-y-4">
        <input type="hidden" name="id" value={estudo.id} />
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Nome do estudo *</label>
          <input name="nome" required defaultValue={estudo.nome}
            className="w-full text-sm border border-gray-200 px-3 py-2 focus:outline-none focus:border-[var(--brand-yellow)]" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Município *</label>
            <input name="municipio" required defaultValue={estudo.municipio}
              className="w-full text-sm border border-gray-200 px-3 py-2 focus:outline-none focus:border-[var(--brand-yellow)]" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">UF</label>
            <input name="estado" defaultValue={estudo.estado} maxLength={2}
              className="w-full text-sm border border-gray-200 px-3 py-2 uppercase focus:outline-none focus:border-[var(--brand-yellow)]" />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Localização do terreno</label>
          <p className="text-[10px] text-gray-400 mb-2">
            Clique no mapa para marcar/ajustar o ponto — coordenadas e endereço são preenchidos automaticamente.
          </p>
          <SeletorLocalizacao
            latInicial={estudo.latitude}
            lngInicial={estudo.longitude}
            enderecoInicial={estudo.endereco ?? ""}
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Responsável</label>
          <input name="responsavel" defaultValue={estudo.responsavel ?? ""} placeholder="Opcional"
            className="w-full text-sm border border-gray-200 px-3 py-2 focus:outline-none focus:border-[var(--brand-yellow)]" />
        </div>
        <button type="submit"
          className="text-xs font-bold px-5 py-2.5 bg-[var(--brand-dark)] text-[var(--brand-yellow)] hover:opacity-90 transition-opacity">
          Salvar alterações
        </button>
      </form>
    </div>
  );
}
