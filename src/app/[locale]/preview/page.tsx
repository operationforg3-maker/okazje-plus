import { PreviewListIndex } from '@/components/preview/preview-components';

export const metadata = {
  title: 'Ukryty podgląd UX — Okazje+',
  robots: {
    index: false,
    follow: false,
  },
};

export default function PreviewPage() {
  return <PreviewListIndex />;
}
