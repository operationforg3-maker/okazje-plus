"use client";
import dynamic from 'next/dynamic';
const AiCommandConsole = dynamic(() => import('./console'), { ssr: false });

export default function AiCommandConsoleWrapper() {
  return <AiCommandConsole />;
}
