import { FileText } from "lucide-react";

export default function ContratosPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Contratos</h1>
        <p className="text-gray-400 text-sm mt-0.5">Gestão de contratos de compra, venda e locação</p>
      </div>
      <div className="bg-gray-50 border border-dashed border-gray-200 p-12 text-center">
        <FileText size={32} className="text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">Módulo em desenvolvimento</p>
        <p className="text-gray-400 text-sm mt-1">Os contratos serão gerenciados aqui em breve.</p>
      </div>
    </div>
  );
}
