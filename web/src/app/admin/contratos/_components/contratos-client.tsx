"use client";

import { useState, useTransition } from "react";
import { FileText, Plus, Pencil, Trash2, Eye, Upload, Download, Mail, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  criarContrato,
  editarContrato,
  excluirContrato,
  salvarContratoAssinado,
  alterarStatusContrato,
} from "@/lib/actions/contratos";

type ContratoData = {
  id: string;
  numero: string;
  tipo: string;
  status: string;
  parteA: string;
  parteADoc: string | null;
  parteB: string;
  parteBDoc: string | null;
  valor: number;
  vencimento: Date | string | null;
  descricao: string;
  clausulas: string;
  contratoAssinadoUrl: string | null;
  criadoEm: Date | string;
};

interface Props {
  contratos: ContratoData[];
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  rascunho:  { bg: "bg-gray-100",   text: "text-gray-600" },
  ativo:     { bg: "bg-green-100",  text: "text-green-700" },
  vencido:   { bg: "bg-red-100",    text: "text-red-600" },
  cancelado: { bg: "bg-red-50",     text: "text-red-400" },
  concluido: { bg: "bg-blue-100",   text: "text-blue-700" },
};

const STATUS_OPTIONS = [
  { value: "rascunho",  label: "Rascunho" },
  { value: "ativo",     label: "Ativo" },
  { value: "vencido",   label: "Vencido" },
  { value: "cancelado", label: "Cancelado" },
  { value: "concluido", label: "Concluído" },
];

const TIPO_LABELS: Record<string, string> = {
  compra_venda: "Compra e Venda",
  locacao:      "Locação",
  permuta:      "Permuta",
  comodato:     "Comodato",
  outro:        "Outro",
};

function formatVencimento(v: Date | string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("pt-BR");
}

export default function ContratosClient({ contratos: initialContratos }: Props) {
  const [isPending, startTransition] = useTransition();

  // Modal state
  const [showNovoModal, setShowNovoModal] = useState(false);
  const [editContrato, setEditContrato] = useState<ContratoData | null>(null);
  const [viewContrato, setViewContrato] = useState<ContratoData | null>(null);
  const [uploadContrato, setUploadContrato] = useState<ContratoData | null>(null);
  const [uploadFile, setUploadFile] = useState<string | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string>("");

  function handleStatusChange(id: string, status: string) {
    startTransition(() => {
      alterarStatusContrato(id, status);
    });
  }

  function handleExcluir(c: ContratoData) {
    if (!confirm(`Confirmar exclusão do contrato ${c.numero}?`)) return;
    startTransition(() => {
      excluirContrato(c.id);
    });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setUploadFile(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  function handleUploadSubmit() {
    if (!uploadContrato || !uploadFile) return;
    startTransition(() => {
      salvarContratoAssinado(uploadContrato.id, uploadFile).then(() => {
        setUploadContrato(null);
        setUploadFile(null);
        setUploadFileName("");
      });
    });
  }

  async function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await editarContrato(formData);
      setEditContrato(null);
    });
  }

  async function handleNovoSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await criarContrato(formData);
      setShowNovoModal(false);
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">
            Contratos
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {initialContratos.length} contrato{initialContratos.length !== 1 ? "s" : ""} · Gestão de compra, venda e locação
          </p>
        </div>
        <button
          onClick={() => setShowNovoModal(true)}
          className="flex items-center gap-2 bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-5 py-2.5 transition-colors"
        >
          <Plus size={14} /> Novo Contrato
        </button>
      </div>

      {/* Contracts list */}
      {initialContratos.length === 0 ? (
        <div className="bg-gray-50 border border-dashed border-gray-200 p-12 text-center">
          <FileText size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhum contrato cadastrado</p>
          <p className="text-gray-400 text-sm mt-1">
            Clique em &quot;Novo Contrato&quot; para criar o primeiro contrato.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {["Número", "Tipo", "Parte A", "Parte B", "Valor", "Vencimento", "Status", "Ações"].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 py-3 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {initialContratos.map((c) => {
                const st = STATUS_COLORS[c.status] ?? STATUS_COLORS.rascunho;
                return (
                  <tr
                    key={c.id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                      {c.numero}
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {TIPO_LABELS[c.tipo] ?? c.tipo}
                    </td>
                    <td className="px-4 py-3 font-medium text-[var(--brand-dark)] max-w-[140px] truncate">
                      {c.parteA}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[140px] truncate">
                      {c.parteB}
                    </td>
                    <td className="px-4 py-3 font-bold text-[var(--brand-dark)] whitespace-nowrap">
                      {formatCurrency(c.valor)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {formatVencimento(c.vencimento)}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={c.status}
                        onChange={(e) => handleStatusChange(c.id, e.target.value)}
                        disabled={isPending}
                        className={`text-[10px] font-bold px-2 py-0.5 uppercase border-0 cursor-pointer focus:outline-none ${st.bg} ${st.text}`}
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {/* Edit */}
                        <button
                          onClick={() => setEditContrato(c)}
                          title="Editar"
                          className="p-1.5 text-gray-400 hover:text-[var(--brand-dark)] hover:bg-gray-100 transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        {/* View */}
                        <button
                          onClick={() => setViewContrato(c)}
                          title="Visualizar"
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Eye size={13} />
                        </button>
                        {/* Upload / Download */}
                        {c.contratoAssinadoUrl ? (
                          <a
                            href={c.contratoAssinadoUrl}
                            download
                            title="Baixar contrato assinado"
                            className="p-1.5 text-green-600 hover:bg-green-50 transition-colors"
                          >
                            <Download size={13} />
                          </a>
                        ) : (
                          <button
                            onClick={() => setUploadContrato(c)}
                            title="Enviar contrato assinado"
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Upload size={13} />
                          </button>
                        )}
                        {/* Email */}
                        <a
                          href={`mailto:?subject=Contrato ${c.numero}&body=Segue o contrato ${c.numero} referente a ${TIPO_LABELS[c.tipo] ?? c.tipo} entre ${c.parteA} e ${c.parteB}.`}
                          title="Enviar por e-mail"
                          className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                        >
                          <Mail size={13} />
                        </a>
                        {/* Delete */}
                        {!c.contratoAssinadoUrl && (
                          <button
                            onClick={() => handleExcluir(c)}
                            disabled={isPending}
                            title="Excluir"
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* === Novo Contrato Modal === */}
      {showNovoModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl p-6 space-y-4 relative">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-black text-[var(--brand-dark)] text-sm uppercase tracking-widest">
                Novo Contrato
              </h2>
              <button
                onClick={() => setShowNovoModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleNovoSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ContratoFormFields />
              <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNovoModal(false)}
                  className="text-xs font-bold uppercase tracking-wide text-gray-500 hover:text-gray-700 px-4 py-2"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors disabled:opacity-60"
                >
                  Criar Contrato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === Edit Modal === */}
      {editContrato && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl p-6 space-y-4 relative">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-black text-[var(--brand-dark)] text-sm uppercase tracking-widest">
                Editar Contrato — {editContrato.numero}
              </h2>
              <button
                onClick={() => setEditContrato(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input type="hidden" name="id" value={editContrato.id} />
              <ContratoFormFields contrato={editContrato} />
              <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditContrato(null)}
                  className="text-xs font-bold uppercase tracking-wide text-gray-500 hover:text-gray-700 px-4 py-2"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors disabled:opacity-60"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === View Modal === */}
      {viewContrato && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl p-6 space-y-4 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-black text-[var(--brand-dark)] text-sm uppercase tracking-widest">
                Contrato {viewContrato.numero}
              </h2>
              <button
                onClick={() => setViewContrato(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* Contract template */}
            <div className="border border-gray-200 p-5 bg-gray-50 text-sm space-y-3">
              <div className="text-center font-bold uppercase text-[var(--brand-dark)] text-base border-b border-gray-300 pb-3">
                CONTRATO DE {(TIPO_LABELS[viewContrato.tipo] ?? viewContrato.tipo).toUpperCase()}
              </div>
              <p className="text-gray-700">
                <span className="font-semibold">Número:</span> {viewContrato.numero}
              </p>
              <p className="text-gray-700">
                <span className="font-semibold">Parte A (Vendedor/Locador):</span>{" "}
                {viewContrato.parteA}
                {viewContrato.parteADoc ? ` — CPF/CNPJ: ${viewContrato.parteADoc}` : ""}
              </p>
              <p className="text-gray-700">
                <span className="font-semibold">Parte B (Comprador/Locatário):</span>{" "}
                {viewContrato.parteB}
                {viewContrato.parteBDoc ? ` — CPF/CNPJ: ${viewContrato.parteBDoc}` : ""}
              </p>
              <p className="text-gray-700">
                <span className="font-semibold">Valor:</span>{" "}
                {formatCurrency(viewContrato.valor)}
              </p>
              {viewContrato.vencimento && (
                <p className="text-gray-700">
                  <span className="font-semibold">Vencimento:</span>{" "}
                  {formatVencimento(viewContrato.vencimento)}
                </p>
              )}
              {viewContrato.descricao && (
                <p className="text-gray-700">
                  <span className="font-semibold">Descrição:</span> {viewContrato.descricao}
                </p>
              )}
            </div>

            {/* Cláusulas */}
            {viewContrato.clausulas ? (
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                  Cláusulas
                </p>
                <div className="border border-gray-200 p-4 bg-white text-sm text-gray-700 whitespace-pre-wrap font-mono text-xs leading-relaxed max-h-60 overflow-y-auto">
                  {viewContrato.clausulas}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Nenhuma cláusula registrada.</p>
            )}

            {viewContrato.contratoAssinadoUrl && (
              <div className="pt-2">
                <a
                  href={viewContrato.contratoAssinadoUrl}
                  download
                  className="inline-flex items-center gap-2 text-xs font-bold text-green-700 bg-green-50 px-4 py-2 hover:bg-green-100 transition-colors"
                >
                  <Download size={13} /> Baixar Contrato Assinado
                </a>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewContrato(null)}
                className="text-xs font-bold uppercase tracking-wide text-gray-500 hover:text-gray-700 px-4 py-2"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === Upload Modal === */}
      {uploadContrato && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md p-6 space-y-4 relative">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-black text-[var(--brand-dark)] text-sm uppercase tracking-widest">
                Enviar Contrato Assinado
              </h2>
              <button
                onClick={() => {
                  setUploadContrato(null);
                  setUploadFile(null);
                  setUploadFileName("");
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Contrato: <span className="font-bold">{uploadContrato.numero}</span>
            </p>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Arquivo (PDF ou imagem)
              </label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:border-0 file:text-xs file:font-bold file:uppercase file:bg-gray-100 file:text-gray-600 hover:file:bg-gray-200 cursor-pointer"
              />
              {uploadFileName && (
                <p className="text-xs text-gray-400 mt-1">{uploadFileName}</p>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setUploadContrato(null);
                  setUploadFile(null);
                  setUploadFileName("");
                }}
                className="text-xs font-bold uppercase tracking-wide text-gray-500 hover:text-gray-700 px-4 py-2"
              >
                Cancelar
              </button>
              <button
                onClick={handleUploadSubmit}
                disabled={!uploadFile || isPending}
                className="bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors disabled:opacity-60"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Reusable form fields for create/edit
function ContratoFormFields({ contrato }: { contrato?: ContratoData }) {
  return (
    <>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
          Tipo *
        </label>
        <select
          name="tipo"
          required
          defaultValue={contrato?.tipo ?? "compra_venda"}
          className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
        >
          <option value="compra_venda">Compra e Venda</option>
          <option value="locacao">Locação</option>
          <option value="permuta">Permuta</option>
          <option value="comodato">Comodato</option>
          <option value="outro">Outro</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
          Parte A (Vendedor) *
        </label>
        <input
          name="parteA"
          type="text"
          required
          defaultValue={contrato?.parteA ?? ""}
          placeholder="Nome do vendedor"
          className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
          CPF/CNPJ — Parte A
        </label>
        <input
          name="parteADoc"
          type="text"
          defaultValue={contrato?.parteADoc ?? ""}
          placeholder="000.000.000-00"
          className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
          Parte B (Comprador) *
        </label>
        <input
          name="parteB"
          type="text"
          required
          defaultValue={contrato?.parteB ?? ""}
          placeholder="Nome do comprador"
          className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
          CPF/CNPJ — Parte B
        </label>
        <input
          name="parteBDoc"
          type="text"
          defaultValue={contrato?.parteBDoc ?? ""}
          placeholder="000.000.000-00"
          className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
          Valor (R$) *
        </label>
        <input
          name="valor"
          type="number"
          step="0.01"
          required
          defaultValue={contrato?.valor ?? ""}
          placeholder="Ex: 350000"
          className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
          Vencimento
        </label>
        <input
          name="vencimento"
          type="date"
          defaultValue={
            contrato?.vencimento
              ? new Date(contrato.vencimento).toISOString().split("T")[0]
              : ""
          }
          className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
        />
      </div>
      {contrato && (
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
            Status
          </label>
          <select
            name="status"
            defaultValue={contrato.status}
            className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
          >
            <option value="rascunho">Rascunho</option>
            <option value="ativo">Ativo</option>
            <option value="vencido">Vencido</option>
            <option value="cancelado">Cancelado</option>
            <option value="concluido">Concluído</option>
          </select>
        </div>
      )}
      <div className="sm:col-span-2">
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
          Descrição
        </label>
        <input
          name="descricao"
          type="text"
          defaultValue={contrato?.descricao ?? ""}
          placeholder="Resumo do contrato..."
          className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
          Cláusulas
        </label>
        <textarea
          name="clausulas"
          rows={5}
          defaultValue={contrato?.clausulas ?? ""}
          placeholder="Insira as cláusulas contratuais..."
          className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 resize-none"
        />
      </div>
    </>
  );
}
