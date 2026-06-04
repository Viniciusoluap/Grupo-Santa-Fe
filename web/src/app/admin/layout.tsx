"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Menu, Bell } from "lucide-react";
import { Sidebar } from "@/components/admin/sidebar";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/auth";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const userName = session?.user?.name ?? "Usuário";
  const userRole = ((session?.user as { role?: UserRole })?.role) ?? "admin";

  return (
    <div className="min-h-screen flex bg-[var(--brand-gray-light)]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixed on desktop, drawer on mobile */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar
          userName={userName}
          userRole={userRole}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-100 px-4 md:px-6 h-14 flex items-center justify-between sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-500 hover:text-[var(--brand-dark)] p-1"
          >
            <Menu size={20} />
          </button>
          <div className="hidden lg:block" />

          <div className="flex items-center gap-3">
            <button className="relative text-gray-400 hover:text-[var(--brand-dark)] p-1">
              <Bell size={18} />
              <span className="absolute top-0 right-0 w-2 h-2 bg-[var(--brand-yellow)] rounded-full" />
            </button>
            <div className="w-8 h-8 bg-[var(--brand-yellow)] rounded-full flex items-center justify-center">
              <span className="text-[var(--brand-dark)] font-black text-xs">
                {userName?.[0]?.toUpperCase()}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
