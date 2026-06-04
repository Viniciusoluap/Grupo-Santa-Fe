"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, Phone, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navLinks = [
  {
    label: "Imóveis",
    href: "/imoveis",
    children: [
      { label: "Todos os Imóveis", href: "/imoveis" },
      { label: "Casas e Apartamentos", href: "/imoveis?type=casa" },
      { label: "Lotes e Terrenos", href: "/imoveis?type=lote" },
      { label: "Comercial", href: "/imoveis?type=comercial" },
    ],
  },
  {
    label: "Serviços",
    href: "/servicos",
    children: [
      { label: "Todos os Serviços", href: "/servicos" },
      { label: "Simulador de Financiamento", href: "/simulador" },
    ],
  },
  { label: "Mercado", href: "/mercado" },
  { label: "Sobre", href: "/sobre" },
  { label: "Contato", href: "/contato" },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-[var(--brand-dark)] shadow-xl"
          : "bg-[var(--brand-dark)]/95"
      )}
    >
      {/* Top bar */}
      <div className="bg-[var(--brand-yellow)] px-4 py-1.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs font-medium text-[var(--brand-dark)]">
          <span>Rua B N° 40 — Ouro Preto · Canaã dos Carajás-PA · CEP 68350-307</span>
          <a
            href="tel:+5594993044689"
            className="flex items-center gap-1.5 hover:opacity-75 transition-opacity"
          >
            <Phone size={12} />
            (94) 99304-4689
          </a>
        </div>
      </div>

      {/* Main nav */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="flex flex-col leading-none">
              <span className="text-[var(--brand-yellow)] font-black text-xl tracking-wider uppercase">
                Grupo Santa Fé
              </span>
              <span className="text-gray-400 text-[9px] tracking-[0.3em] uppercase">
                Construindo Negócios
              </span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) =>
              link.children ? (
                <div key={link.label} className="relative group">
                  <button
                    className="flex items-center gap-1 text-gray-300 hover:text-[var(--brand-yellow)] px-3 py-2 text-sm font-medium transition-colors uppercase tracking-wide"
                    onMouseEnter={() => setOpenDropdown(link.label)}
                    onMouseLeave={() => setOpenDropdown(null)}
                  >
                    {link.label}
                    <ChevronDown size={14} />
                  </button>
                  <div
                    className={cn(
                      "absolute top-full left-0 w-56 bg-white shadow-xl border-t-2 border-[var(--brand-yellow)] transition-all duration-200",
                      openDropdown === link.label
                        ? "opacity-100 translate-y-0 pointer-events-auto"
                        : "opacity-0 -translate-y-2 pointer-events-none"
                    )}
                    onMouseEnter={() => setOpenDropdown(link.label)}
                    onMouseLeave={() => setOpenDropdown(null)}
                  >
                    {link.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className="block px-4 py-3 text-sm text-gray-700 hover:bg-[var(--brand-yellow)] hover:text-[var(--brand-dark)] transition-colors font-medium"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-gray-300 hover:text-[var(--brand-yellow)] px-3 py-2 text-sm font-medium transition-colors uppercase tracking-wide"
                >
                  {link.label}
                </Link>
              )
            )}
          </nav>

          {/* CTA */}
          <div className="hidden lg:flex items-center gap-3">
            <Link href="/portal" className="text-gray-400 hover:text-[var(--brand-yellow)] text-xs font-bold uppercase tracking-wider transition-colors">
              Portal do Cliente
            </Link>
            <Button variant="primary" size="sm" asChild>
              <Link href="/contato">Fale Conosco</Link>
            </Button>
          </div>

          {/* Mobile toggle */}
          <button
            className="lg:hidden text-gray-300 hover:text-[var(--brand-yellow)] p-2"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Menu"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="lg:hidden bg-[var(--brand-dark-secondary)] border-t border-gray-700">
          <nav className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-1">
            {navLinks.map((link) => (
              <div key={link.label}>
                <Link
                  href={link.href ?? "#"}
                  className="block py-3 text-gray-300 hover:text-[var(--brand-yellow)] font-medium transition-colors text-sm uppercase tracking-wide border-b border-gray-700"
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </Link>
                {link.children && (
                  <div className="pl-4 py-1">
                    {link.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className="block py-2 text-gray-400 hover:text-[var(--brand-yellow)] text-sm transition-colors"
                        onClick={() => setIsOpen(false)}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <Button variant="primary" className="mt-4 w-full" asChild>
              <Link href="/contato" onClick={() => setIsOpen(false)}>
                Fale Conosco
              </Link>
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
}
