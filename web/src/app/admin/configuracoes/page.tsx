import { Settings } from "lucide-react";

const sections = [
  {
    title: "Dados da Empresa",
    fields: [
      { label: "Razão Social", placeholder: "Grupo Santa Fé Ltda", type: "text" },
      { label: "CNPJ", placeholder: "00.000.000/0001-00", type: "text" },
      { label: "CRECI", placeholder: "GO-12345", type: "text" },
      { label: "Telefone Principal", placeholder: "(62) 9 9999-9999", type: "tel" },
      { label: "E-mail", placeholder: "contato@gruposantafe.com.br", type: "email" },
      { label: "Site", placeholder: "https://gruposantafe.com.br", type: "url" },
    ],
  },
  {
    title: "Endereço",
    fields: [
      { label: "Rua / Avenida", placeholder: "Av. Goiás, 1234", type: "text" },
      { label: "Bairro", placeholder: "Setor Central", type: "text" },
      { label: "Cidade", placeholder: "Goiânia", type: "text" },
      { label: "Estado", placeholder: "GO", type: "text" },
      { label: "CEP", placeholder: "74000-000", type: "text" },
    ],
  },
  {
    title: "Notificações",
    fields: [
      { label: "E-mail para novos leads", placeholder: "leads@gruposantafe.com.br", type: "email" },
      { label: "E-mail para visitas agendadas", placeholder: "agenda@gruposantafe.com.br", type: "email" },
    ],
  },
];

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <Settings size={22} className="text-[var(--brand-dark)]" />
        <div>
          <h1 className="font-black text-[var(--brand-dark)] text-2xl uppercase tracking-wide">Configurações</h1>
          <p className="text-gray-400 text-sm mt-0.5">Dados da empresa e preferências do sistema</p>
        </div>
      </div>

      {sections.map((section) => (
        <div key={section.title} className="bg-white border border-gray-100 p-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">{section.title}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {section.fields.map((f) => (
              <div key={f.label}>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">{f.label}</label>
                <input
                  type={f.type}
                  placeholder={f.placeholder}
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex gap-3 pt-2">
        <button className="bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-xs uppercase tracking-wider px-6 py-2.5 transition-colors">
          Salvar Configurações
        </button>
      </div>
    </div>
  );
}
