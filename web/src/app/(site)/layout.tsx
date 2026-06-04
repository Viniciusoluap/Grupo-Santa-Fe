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
    </>
  );
}
