import { Metadata } from 'next';
import HarvesterPresetsPanel from '@/components/admin/harvester-presets-panel';

export const metadata: Metadata = {
  title: 'Presety Harvestera - Admin',
  description: 'Zarządzaj presetami keywords dla automatycznego importu produktów',
};

export default function HarvesterPresetsPage() {
  return <HarvesterPresetsPanel />;
}
