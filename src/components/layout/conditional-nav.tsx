"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Navbar } from "./navbar";
import { Footer } from "./footer";

export function ConditionalNav({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  
  // Hide navbar/footer for guests on home page (coming soon)
  // Only hide if auth is loaded and user is not logged in
  const isHomePage = pathname === '/' || pathname === '/pl' || pathname === '/en' || pathname === '/de';
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
