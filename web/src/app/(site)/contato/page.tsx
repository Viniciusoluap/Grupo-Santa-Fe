import { Phone, Mail, MapPin, Clock, MessageSquare, CheckCircle2 } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { enviarContato } from "@/lib/actions/leads";
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

interface PageProps {
  searchParams: Promise<{ enviado?: string }>;
}

export default async function ContatoPage({ searchParams }: PageProps) {
  const { enviado } = await searchParams;
  return (
    <>
      {/* Header */}
      <section className="bg-[var(--brand-dark)] py-16">
        <div className="max-w-7xl mx-auto px-4 mb-8">
          <BackButton className="text-gray-500 hover:text-[var(--brand-yellow)]" />
        </div>
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

            {enviado === "1" ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                <CheckCircle2 size={48} className="text-green-500" />
                <h3 className="font-black text-[var(--brand-dark)] text-xl uppercase">Mensagem enviada!</h3>
                <p className="text-gray-500 text-sm max-w-sm">
                  Recebemos seu contato e entraremos em comunicação em até 2 horas no horário comercial.
                </p>
              </div>
            ) : (
              <form action={enviarContato} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                      Nome completo *
                    </label>
                    <input
                      name="nome"
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
                      name="telefone"
                      type="tel"
                      required
                      placeholder="(94) 9 9999-9999"
                      className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                    E-mail
                  </label>
                  <input
                    name="email"
                    type="email"
                    placeholder="seu@email.com"
                    className="w-full border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-yellow)] bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                    Serviços de interesse *
                    <span className="ml-2 text-[10px] text-gray-400 normal-case font-normal">(pode selecionar mais de um)</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {services.map((s) => (
                      <label key={s} className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          name="servicos"
                          value={s}
                          className="accent-[var(--brand-yellow)] w-4 h-4 cursor-pointer"
                        />
                        <span className="text-sm text-gray-700 group-hover:text-[var(--brand-dark)] transition-colors">{s}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                    Mensagem
                  </label>
                  <textarea
                    name="mensagem"
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
            )}
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
                  href="tel:+5594991888143"
                  className="flex items-start gap-3 text-gray-300 hover:text-[var(--brand-yellow)] transition-colors group"
                >
                  <div className="w-9 h-9 bg-[var(--brand-yellow)] group-hover:bg-white flex items-center justify-center shrink-0 transition-colors">
                    <Phone size={16} className="text-[var(--brand-dark)]" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">(94) 99188-8143</p>
                    <p className="text-xs text-gray-500">Administrativo</p>
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
