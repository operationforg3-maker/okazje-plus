import { redirect } from 'next/navigation';

type LegacyAdminCatchAllProps = {
  params: Promise<{
    slug?: string[];
  }>;
};

export default async function LegacyAdminCatchAllRedirect({ params }: LegacyAdminCatchAllProps) {
  const { slug = [] } = await params;
  const path = slug.length > 0 ? `/${slug.join('/')}` : '';
  redirect(`/pl/admin${path}`);
}