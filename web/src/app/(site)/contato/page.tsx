import { Phone, Mail, MapPin, Clock, MessageSquare } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contato",
  description: "Entre em contato com o Grupo Santa Fé. Atendimento personalizado para corretagem, financiamento e engenharia.",
};

const services = [
  "Compra e Venda de Imóveis",
  "Financiamento Habitacional (MCMV / FGTS)",
  "Obras e Reformas",
  "Projetos de Engenharia",
  "Regularização Imobiliária",
  "Avaliação de Imóvel",
  "Lotes e Terrenos",
  "Outro",
];

export default function ContatoPage() {
  return (
    <>
      {/* Header */}
      <section className="bg-[var(--brand-dark)] py-16">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-[var(--brand-yellow)] font-bold text-xs tracking-widest uppercase mb-3">
            Fale conosco
          </p>
          <h1 className="text-white font-black text-4xl md:text-6xl uppercase leading-tight">
            Como podemos <span className="text-[var(--brand-yellow)]">ajudar?</span>
          </h1>
          <p className="text-gray-400 mt-3 max-w-lg">
            Nossa equipe está pronta para atender você de segunda a sexta, das
            8h às 18h, e aos sábados das 8h às 13h.
          </p>
        </div>
      </section>

      <section className="py-14 bg-[var(--brand-gray-light)]">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-2 bg-white p-8">
            <h2 className="font-black text-[var(--brand-dark)] text-2xl uppercase mb-6 pb-4 border-b border-gray-100">
              Envie sua mensagem
            </h2>

            <form className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                    Nome completo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Seu nome"
                    className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                    Telefone / WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="(62) 9 9999-9999"
                    className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  placeholder="seu@email.com"
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                  Serviço de interesse *
                </label>
                <select
                  required
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 appearance-none cursor-pointer"
                >
                  <option value="">Selecione um serviço</option>
                  {services.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                  Mensagem
                </label>
                <textarea
                  rows={5}
                  placeholder="Conte-nos mais sobre o que você precisa..."
                  className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50 resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[var(--brand-yellow)] hover:bg-[var(--brand-yellow-dark)] text-[var(--brand-dark)] font-bold text-sm uppercase tracking-wider py-3 transition-colors"
              >
                Enviar Mensagem
              </button>

              <p className="text-xs text-gray-400 text-center">
                Respondemos em até 2 horas no horário comercial.
              </p>
            </form>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Contact info */}
            <div className="bg-[var(--brand-dark)] p-6">
              <h3 className="text-[var(--brand-yellow)] font-bold uppercase tracking-wide text-sm mb-5">
                Informações de Contato
              </h3>

              <div className="space-y-4">
                <a
                  href="tel:+5594993044689"
                  className="flex items-start gap-3 text-gray-300 hover:text-[var(--brand-yellow)] transition-colors group"
                >
                  <div className="w-9 h-9 bg-[var(--brand-yellow)] group-hover:bg-white flex items-center justify-center shrink-0 transition-colors">
                    <Phone size={16} className="text-[var(--brand-dark)]" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">(94) 99304-4689</p>
                    <p className="text-xs text-gray-500">Escritório</p>
                  </div>
                </a>

                <a
                  href="tel:+5594992448612"
                  className="flex items-start gap-3 text-gray-300 hover:text-[var(--brand-yellow)] transition-colors group"
                >
                  <div className="w-9 h-9 bg-[var(--brand-yellow)] group-hover:bg-white flex items-center justify-center shrink-0 transition-colors">
                    <Phone size={16} className="text-[var(--brand-dark)]" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">(94) 99244-8612</p>
                    <p className="text-xs text-gray-500">Cleidson — CEO</p>
                  </div>
                </a>

                <a
                  href="mailto:comercial@gruposantafee.com.br"
                  className="flex items-start gap-3 text-gray-300 hover:text-[var(--brand-yellow)] transition-colors group"
                >
                  <div className="w-9 h-9 bg-[var(--brand-yellow)] group-hover:bg-white flex items-center justify-center shrink-0 transition-colors">
                    <Mail size={16} className="text-[var(--brand-dark)]" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">comercial@gruposantafee.com.br</p>
                    <p className="text-xs text-gray-500">E-mail</p>
                  </div>
                </a>

                <div className="flex items-start gap-3 text-gray-300">
                  <div className="w-9 h-9 bg-[var(--brand-yellow)] flex items-center justify-center shrink-0">
                    <MapPin size={16} className="text-[var(--brand-dark)]" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">Rua B N° 40 — Ouro Preto</p>
                    <p className="text-xs text-gray-500">CEP 68350-307 · Canaã dos Carajás-PA</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 text-gray-300">
                  <div className="w-9 h-9 bg-[var(--brand-yellow)] flex items-center justify-center shrink-0">
                    <Clock size={16} className="text-[var(--brand-dark)]" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">Seg–Sex: 8h às 18h</p>
                    <p className="text-xs text-gray-500">Sábado: 8h às 13h</p>
                  </div>
                </div>
              </div>
            </div>

            {/* WhatsApp */}
            <a
              href="https://wa.me/5594993044689"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 w-full bg-green-500 hover:bg-green-600 text-white font-bold text-sm uppercase tracking-wider py-4 transition-colors"
            >
              <MessageSquare size={18} />
              Chamar no WhatsApp
            </a>

            {/* Note */}
            <div className="bg-[var(--brand-yellow)]/10 border border-[var(--brand-yellow)]/30 p-4">
              <p className="text-xs text-gray-600 leading-relaxed">
                <strong className="text-[var(--brand-dark)]">Avaliação gratuita:</strong> Solicite
                uma avaliação sem compromisso do seu imóvel ou projeto. Nossa
                equipe entra em contato em até 24h.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
