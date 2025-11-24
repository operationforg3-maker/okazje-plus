"use client";
import dynamic from 'next/dynamic';
const AiCommandHistory = dynamic(() => import('./history'), { ssr: false });

export default function AiHistoryPage() {
  return <AiCommandHistory />;
}
