interface CadastroFormalFieldsProps {
  matriculaImovel?: string | null;
  carRegistro?: string | null;
  zoneamentoOficial?: string | null;
  zoneamentoFonte?: string | null;
}

export function CadastroFormalFields(props: CadastroFormalFieldsProps) {
  const fields = [
    { name: "matriculaImovel", label: "Matrícula do imóvel", value: props.matriculaImovel, hint: "Número e cartório, conforme documento oficial" },
    { name: "carRegistro", label: "Registro CAR", value: props.carRegistro, hint: "Informe se aplicável ao imóvel rural" },
    { name: "zoneamentoOficial", label: "Zoneamento oficial", value: props.zoneamentoOficial, hint: "Classificação na lei municipal vigente" },
    { name: "zoneamentoFonte", label: "Fonte do zoneamento", value: props.zoneamentoFonte, hint: "Lei, data ou documento oficial de referência" },
  ];
  return (
    <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-gray-100 pt-4">
      <legend className="text-xs font-bold text-[var(--brand-dark)]">Cadastro formal (somente dados verificados)</legend>
      {fields.map(({ name, label, value, hint }) => (
        <label key={name} className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
          {label}
          <input name={name} defaultValue={value ?? ""} placeholder={hint} maxLength={500}
            className="mt-1 w-full text-sm border border-gray-200 px-3 py-2 focus:outline-none focus:border-[var(--brand-yellow)]" />
        </label>
      ))}
    </fieldset>
  );
}
