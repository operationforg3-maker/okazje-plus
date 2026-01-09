import { notFound } from "next/navigation";
import { getSecretPageBySlug, recordSecretPageView } from "@/lib/data";
import { WheelOfFortuneClient } from "@/components/wheel-of-fortune-client";
import { headers } from "next/headers";

interface SecretPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function SecretPage({ params }: SecretPageProps) {
  const { slug } = await params;

  // Fetch secret page
  const page = await getSecretPageBySlug(slug);

  if (!page || !page.isActive) {
    notFound();
  }

  // Record view
  const headersList = await headers();
  const ipAddress = headersList.get("x-forwarded-for") || "unknown";
  await recordSecretPageView(page.id, ipAddress);

  return (
    <div
      className="min-h-screen py-12 px-4"
      style={{
        backgroundColor: page.backgroundColor || "#f9fafb",
        color: page.textColor || "#111827",
      }}
    >
      <div className="max-w-4xl mx-auto">
        {/* Hero Section */}
        {page.heroImage && (
          <div className="mb-8 rounded-xl overflow-hidden shadow-2xl">
            <img
              src={page.heroImage}
              alt={page.title}
              className="w-full h-64 object-cover"
            />
          </div>
        )}

        {/* Title */}
        <h1 className="text-5xl font-bold text-center mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          {page.title}
        </h1>

        {/* Hero Text */}
        {page.heroText && (
          <p className="text-xl text-center mb-8 text-gray-700">
            {page.heroText}
          </p>
        )}

        {/* Description */}
        {page.description && (
          <div className="mb-12 text-center max-w-2xl mx-auto">
            <p className="text-lg text-gray-600">{page.description}</p>
          </div>
        )}

        {/* Wheel of Fortune */}
        {page.wheelEnabled && page.wheelPrizes.length > 0 && (
          <div className="mb-12">
            {page.wheelTitle && (
              <h2 className="text-3xl font-bold text-center mb-6">
                {page.wheelTitle}
              </h2>
            )}
            <WheelOfFortuneClient
              prizes={page.wheelPrizes}
              pageId={page.id}
              requiresAuth={page.requiresAuth || false}
            />
          </div>
        )}

        {/* Additional Content */}
        {page.content && (
          <div
            className="prose prose-lg max-w-none"
            dangerouslySetInnerHTML={{ __html: page.content }}
          />
        )}

        {/* Stats (admin only, or hidden) */}
        {page.stats && (
          <div className="mt-12 grid grid-cols-3 gap-4 text-center opacity-50">
            <div>
              <p className="text-3xl font-bold">{page.stats.totalViews}</p>
              <p className="text-sm text-gray-600">Wyświetleń</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{page.stats.totalSpins}</p>
              <p className="text-sm text-gray-600">Zakręceń</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{page.stats.uniqueVisitors}</p>
              <p className="text-sm text-gray-600">Unikalnych</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
