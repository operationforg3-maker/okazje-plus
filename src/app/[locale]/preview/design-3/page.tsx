import Link from 'next/link';
import { DesignThreePreview } from '@/components/preview/preview-components';

export const metadata = {
  title: 'Design 3 — Speedboard | Okazje+',
  robots: {
    index: false,
    follow: false,
  },
};

export default function DesignThreePage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10 sm:px-8 lg:px-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Ukryty prototyp</p>
          <h1 className="mt-2 text-4xl font-semibold text-slate-950 sm:text-5xl">Speedboard</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Dashboard oferty z szybkim filtrowaniem i wskaźnikami, które ułatwiają wybór.</p>
        </div>
        <Link href=".." className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
          Powrót do listy projektów
        </Link>
      </div>
      <DesignThreePreview />
    </main>
  );
}
