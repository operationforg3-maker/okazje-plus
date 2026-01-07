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
  // BUT: on other pages, always show navbar (even during loading)
  const isHomePage = pathname === '/' || pathname === '/pl' || pathname === '/en' || pathname === '/de';
  
  // Hide nav only if: home page + no user + auth finished loading
  const shouldHideNav = isHomePage && !user && !loading;
  
  // Show minimal layout during auth loading on home page
  if (isHomePage && loading) {
    console.log('[ConditionalNav] Home page loading - showing minimal nav');
  }
  
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
