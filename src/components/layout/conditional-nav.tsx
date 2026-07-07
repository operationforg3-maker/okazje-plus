"use client";

import { Navbar } from "./navbar";
import { Footer } from "./footer";
import { BottomTabBar } from "./bottom-tab-bar";
import { SubNavbar } from "./sub-navbar";
import { Category } from "@/lib/types";

export function ConditionalNav({ children, categories = [] }: { children: React.ReactNode; categories?: Category[] }) {
  // Always render navbar and footer - no conditional logic based on auth
  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Skip to main content link for keyboard accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-0 focus:left-0 focus:z-[100] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:underline"
      >
        Przejdź do głównej zawartości
      </a>
      <Navbar />
      <SubNavbar categories={categories} />
      <main id="main-content" className="flex-1 pb-20 md:pb-0 overflow-x-hidden" role="main">
        {children}
      </main>
      <Footer />
      <BottomTabBar />
    </div>
  );
}
