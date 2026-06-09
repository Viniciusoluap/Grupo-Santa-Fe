import Script from "next/script";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main className="flex-1 pt-[88px]">{children}</main>
      <Footer />
      <Script id="bubble-chat" strategy="lazyOnload">{`
        import('https://agent-factory-chat.hostgator.io/scripts/start-chat.js')
          .then(function(m){var B=m.default||m;new B('8ea12bfc-0dfe-4ef5-9ace-28bc3d5f250d','prod').open();})
          .catch(function(e){console.error('[Chat]',e);});
      `}</Script>
    </>
  );
}
