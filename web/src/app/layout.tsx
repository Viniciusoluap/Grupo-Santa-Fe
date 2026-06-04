import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Grupo Santa Fé | Construindo Negócios",
    template: "%s | Grupo Santa Fé",
  },
  description:
    "Especialistas em corretagem, construção, reforma, financiamento habitacional, lotes, regularização imobiliária e engenharia.",
  keywords: [
    "imóveis",
    "corretagem",
    "financiamento habitacional",
    "lotes",
    "construção",
    "reforma",
    "regularização imobiliária",
    "engenharia",
    "Grupo Santa Fé",
  ],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Grupo Santa Fé",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
