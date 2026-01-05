"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Navbar } from "./navbar";
import { Footer } from "./footer";

export function ConditionalNav({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  
  // Hide navbar/footer ONLY for guests on home page (coming soon)
  // Keep navbar visible if: user is logged in OR still loading OR not on home page
  const isHomePage = pathname === '/pl' || pathname === '/en' || pathname === '/de' || pathname === '/';
  const shouldHideNav = !loading && !user && isHomePage;

  if (shouldHideNav) {
    return (
      <div className="relative flex min-h-screen flex-col">
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
