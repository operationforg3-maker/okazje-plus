import dynamic from 'next/dynamic';
const AiCommandConsole = dynamic(() => import('./console'), { ssr: false });

export default function AiPanelPage() {
  return <AiCommandConsole />;
}
