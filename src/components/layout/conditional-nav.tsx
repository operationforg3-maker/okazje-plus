"use client";

import { Navbar } from "./navbar";
import { Footer } from "./footer";

export function ConditionalNav({ children }: { children: React.ReactNode }) {
  // Always render navbar and footer - no conditional logic based on auth
  return (
    <div className="relative flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
