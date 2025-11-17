export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';

export default async function Home() {
  // Przekierowanie na countdown page do czasu beta release
  redirect('/coming-soon');
}

