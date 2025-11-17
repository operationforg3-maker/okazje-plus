"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "./navbar";
import { Footer } from "./footer";

export function ConditionalNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Ukryj navbar i footer tylko na stronie głównej (/)
  const hideNav = pathname === "/";

  if (hideNav) {
    // Strona główna - tylko children (ma własny footer wbudowany)
    return <>{children}</>;
  }

  // Wszystkie inne strony - normalny layout z navbarem i footerem
  return (
    <div className="relative flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
