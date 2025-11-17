import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wkrótce - Okazje+",
  description: "Polska platforma okazji i produktów sprawdzonych przez społeczność. Beta Release: 20 listopada 2025.",
};

export default function ComingSoonLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Ukryty navbar - czysta strona landing page
  return <>{children}</>;
}
