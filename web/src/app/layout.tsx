import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AdminSessionProvider } from "@/components/admin/session-provider";
import { PwaRegister } from "@/components/pwa-register";
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
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Santa Fé",
  },
};

export const viewport: Viewport = {
  themeColor: "#1A1A1A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
          <AdminSessionProvider>{children}</AdminSessionProvider>
          <PwaRegister />
        </body>
    </html>
  );
}
