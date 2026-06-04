import Link from "next/link";
import { Phone, Mail, MapPin, MessageSquare } from "lucide-react";

const footerLinks = {
  imoveis: [
    { label: "Imóveis Prontos", href: "/imoveis/prontos" },
    { label: "Lotes e Terrenos", href: "/imoveis/lotes" },
    { label: "Lançamentos", href: "/imoveis/lancamentos" },
  ],
  servicos: [
    { label: "Corretagem", href: "/servicos/corretagem" },
    { label: "Financiamento Habitacional", href: "/servicos/financiamento" },
    { label: "Obras e Reformas", href: "/servicos/obras" },
    { label: "Projetos de Engenharia", href: "/servicos/projetos" },
    { label: "Regularização Imobiliária", href: "/servicos/regularizacao" },
  ],
  empresa: [
    { label: "Sobre o Grupo", href: "/sobre" },
    { label: "Blog", href: "/blog" },
    { label: "Trabalhe Conosco", href: "/carreiras" },
    { label: "Política de Privacidade", href: "/privacidade" },
  ],
};

export function Footer() {
  return (
    <footer className="bg-[var(--brand-dark)] text-gray-300">
      {/* CTA Strip */}
      <div className="bg-[var(--brand-yellow)]">
        <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-[var(--brand-dark)] font-black text-xl uppercase tracking-wide">
              Pronto para realizar seu sonho?
            </p>
            <p className="text-[var(--brand-dark-secondary)] text-sm mt-1">
              Fale com um especialista agora mesmo.
            </p>
          </div>
          <a
            href="https://wa.me/5594992448612"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-[var(--brand-dark)] text-[var(--brand-yellow)] px-6 py-3 font-bold text-sm uppercase tracking-wider hover:bg-[var(--brand-dark-secondary)] transition-colors"
          >
            <MessageSquare size={18} />
            Chamar no WhatsApp
          </a>
        </div>
      </div>

      {/* Main footer */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="mb-4">
              <span className="text-[var(--brand-yellow)] font-black text-2xl tracking-wider uppercase block">
                Grupo Santa Fé
              </span>
              <span className="text-gray-500 text-xs tracking-[0.3em] uppercase">
                Construindo Negócios
              </span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              Há anos transformando sonhos em realidade. Especialistas em
              imóveis, construção, financiamento e engenharia com atendimento
              personalizado e compromisso com qualidade.
            </p>
            {/* Contact */}
            <div className="space-y-2">
              <a
                href="tel:+5594993044689"
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-[var(--brand-yellow)] transition-colors"
              >
                <Phone size={14} className="text-[var(--brand-yellow)]" />
                (94) 99304-4689 — Escritório
              </a>
              <a
                href="tel:+5594992448612"
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-[var(--brand-yellow)] transition-colors"
              >
                <Phone size={14} className="text-[var(--brand-yellow)]" />
                (94) 99244-8612 — Cleidson (CEO)
              </a>
              <a
                href="mailto:comercial@gruposantafee.com.br"
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-[var(--brand-yellow)] transition-colors"
              >
                <Mail size={14} className="text-[var(--brand-yellow)]" />
                comercial@gruposantafee.com.br
              </a>
              <div className="flex items-start gap-2 text-sm text-gray-400">
                <MapPin
                  size={14}
                  className="text-[var(--brand-yellow)] mt-0.5 shrink-0"
                />
                <span>Av. JK N° 103 — Vale Dourado/Centro<br />Em frente ao SINE · Canaã dos Carajás-PA</span>
              </div>
            </div>
            {/* Social */}
            <div className="flex gap-3 mt-5">
              {[
                {
                  href: "#",
                  label: "Instagram",
                  svg: (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                    </svg>
                  ),
                },
                {
                  href: "#",
                  label: "Facebook",
                  svg: (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  ),
                },
                {
                  href: "#",
                  label: "YouTube",
                  svg: (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" />
                    </svg>
                  ),
                },
              ].map(({ href, label, svg }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-9 h-9 bg-gray-800 hover:bg-[var(--brand-yellow)] hover:text-[var(--brand-dark)] text-gray-400 flex items-center justify-center transition-all duration-200"
                >
                  {svg}
                </a>
              ))}
            </div>
          </div>

          {/* Imóveis */}
          <div>
            <h4 className="text-[var(--brand-yellow)] font-bold text-xs uppercase tracking-widest mb-4">
              Imóveis
            </h4>
            <ul className="space-y-2">
              {footerLinks.imoveis.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-400 hover:text-[var(--brand-yellow)] transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Serviços */}
          <div>
            <h4 className="text-[var(--brand-yellow)] font-bold text-xs uppercase tracking-widest mb-4">
              Serviços
            </h4>
            <ul className="space-y-2">
              {footerLinks.servicos.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-400 hover:text-[var(--brand-yellow)] transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Empresa */}
          <div>
            <h4 className="text-[var(--brand-yellow)] font-bold text-xs uppercase tracking-widest mb-4">
              Empresa
            </h4>
            <ul className="space-y-2">
              {footerLinks.empresa.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-400 hover:text-[var(--brand-yellow)] transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-2">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} Grupo Santa Fé. Todos os direitos reservados.
          </p>
          <p className="text-xs text-gray-600">Canaã dos Carajás — PA · CRECI-PA</p>
        </div>
      </div>
    </footer>
  );
}
