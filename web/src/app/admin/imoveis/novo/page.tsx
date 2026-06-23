import Link from "next/link";
import { BackButton } from "@/components/ui/back-button";
import { prisma } from "@/lib/db";
import { criarImovel } from "@/lib/actions/imoveis";
import { FotoUpload } from "../_components/foto-upload";
import { PrecoInput } from "../_components/preco-input";
import { LocalizacaoPicker } from "../_components/localizacao-picker";

const tipos = ["casa", "apartamento", "lote", "terreno", "comercial", "chacara"];
const tipoLabel: Record<string, string> = {
  casa: "Casa",
  apartamento: "Apartamento",
  lote: "Lote",
  terreno: "Terreno",
  comercial: "Comercial",
  chacara: "Chácara",
};
const bairros = [
  "Centro", "Ouro Preto", "Novo Horizonte", "Residencial Norte", "Vila dos Funcionários",
  "Jardim Primavera", "Setor Sul", "Setor Norte", "Bairro de Lourdes", "Outro",
];

export default async function NovoImovelPage() {
  const corretores = await prisma.corretor.findMany({
    where: { ativo: true },
    orderBy: { nome: "asc" },
  });

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <BackButton />
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">
          Novo Imóvel
        </h1>
      </div>

      <div className="bg-white border border-gray-100 p-6">
        <form action={criarImovel} className="space-y-6">
          {/* Dados básicos */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              Dados Básicos
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                  Título do Anúncio *
                </label>
                <input
                  type="text"
                  name="titulo"
                  required
                  placeholder="Ex.: Casa 3 Quartos — Centro"
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                  Tipo *
                </label>
                <select
                  name="tipo"
                  required
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none"
                >
                  <option value="">Selecione...</option>
                  {tipos.map((t) => (
                    <option key={t} value={t}>
                      {tipoLabel[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                  Situação *
                </label>
                <select
                  name="status"
                  required
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none"
                >
                  <option value="">Selecione...</option>
                  <option value="venda">Venda</option>
                  <option value="locacao">Locação</option>
                  <option value="lancamento">Lançamento</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                  Bairro *
                </label>
                <select
                  name="bairro"
                  required
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none"
                >
                  <option value="">Selecione...</option>
                  {bairros.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                  Cidade
                </label>
                <input
                  type="text"
                  name="cidade"
                  defaultValue="Canaã dos Carajás"
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
                />
              </div>
            </div>
          </div>

          {/* Valores */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              Valores
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                  Preço *
                </label>
                <PrecoInput name="preco" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                  Área (m²)
                </label>
                <input
                  type="number"
                  name="area"
                  min={0}
                  placeholder="0"
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
                />
              </div>
            </div>
          </div>

          {/* Características */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              Características
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Quartos", name: "quartos" },
                { label: "Banheiros", name: "banheiros" },
                { label: "Vagas", name: "vagas" },
                { label: "Suítes", name: "suites" },
              ].map(({ label, name }) => (
                <div key={name}>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                    {label}
                  </label>
                  <input
                    type="number"
                    name={name}
                    min={0}
                    defaultValue={0}
                    className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 text-center"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Fotos */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              Fotos
            </p>
            <FotoUpload name="imagens" />
          </div>

          {/* Localização Exata */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              Localização Exata
            </p>
            <LocalizacaoPicker nameLat="latitude" nameLng="longitude" />
          </div>

          {/* Responsável */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              Responsável
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                  Corretor Responsável
                </label>
                <select
                  name="corretorId"
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none"
                >
                  <option value="">Nenhum</option>
                  {corretores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
              Descrição
            </label>
            <textarea
              name="descricao"
              rows={4}
              placeholder="Descreva o imóvel, características, diferenciais..."
              className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button
              type="submit"
              className="bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors"
            >
              Cadastrar Imóvel
            </button>
            <Link
              href="/admin/imoveis"
              className="border border-gray-200 hover:border-gray-300 text-gray-500 font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
