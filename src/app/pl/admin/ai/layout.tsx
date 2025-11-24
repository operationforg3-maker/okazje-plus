import { Suspense } from 'react';
import Link from 'next/link';

export default function AiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-4">Panel AI (Gemini)</h1>
      <nav className="mb-6 flex gap-4">
        <Link href="./">Konsola poleceń</Link>
        <Link href="./history">Historia</Link>
        <Link href="./spec">Specyfikacja API</Link>
      </nav>
      <Suspense fallback={<div>Ładowanie...</div>}>
        {children}
      </Suspense>
    </div>
  );
}
