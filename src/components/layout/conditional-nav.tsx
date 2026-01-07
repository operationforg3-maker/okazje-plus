"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Navbar } from "./navbar";
import { Footer } from "./footer";

export function ConditionalNav({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  
  console.log('[ConditionalNav] Rendering with auth state:', { user: !!user, loading, pathname });
  
  // Coming soon page logic: hide navbar/footer for guests on home page
  const isHomePage = pathname === '/' || pathname === '/pl' || pathname === '/en' || pathname === '/de';
  const shouldHideNav = isHomePage && !user && !loading;
  
  if (shouldHideNav) {
    console.log('[ConditionalNav] Hiding navbar for guest on home page');
    return <main className="flex-1">{children}</main>;
  }
  
  return (
    <div className="relative flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
