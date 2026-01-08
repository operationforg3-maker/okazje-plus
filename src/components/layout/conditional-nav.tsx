"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Navbar } from "./navbar";
import { Footer } from "./footer";
import { useEffect, useState } from "react";

export function ConditionalNav({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
    console.log('[ConditionalNav] Rendering with auth state:', { user: !!user, loading, pathname, mounted });
  }
  
  // Coming soon page logic: hide navbar/footer for guests on home page
  // IMPORTANT: Only apply conditional rendering AFTER hydration (mounted === true)
  // to avoid hydration mismatch
  if (mounted) {
    const isHomePage = pathname === '/' || pathname === '/pl' || pathname === '/en' || pathname === '/de';
    const shouldHideNav = isHomePage && !user && !loading;
    
    if (shouldHideNav) {
      if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
        console.log('[ConditionalNav] Hiding navbar for guest on home page');
      }
      return <main className="flex-1">{children}</main>;
    }
  }
  
  // Default: render with navbar (safe for both server and client initial render)
  return (
    <div className="relative flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
