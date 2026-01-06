"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Navbar } from "./navbar";
import { Footer } from "./footer";

export function ConditionalNav({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  
  console.log('[ConditionalNav] Rendering with auth state:', { user: !!user, loading, pathname });
  
  // Show navbar/footer EVERYWHERE now - coming soon page removed
  // TODO: Restore conditional logic if coming soon page is re-enabled
  return (
    <div className="relative flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
