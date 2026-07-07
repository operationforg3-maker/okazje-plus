"use client";

/**
 * /admin/forum/moderation — redirects to the unified moderation panel (Forum tab).
 * The old direct Firestore client SDK implementation has been replaced by
 * ForumModerationPanel component using Admin SDK via /api/admin/forum/moderate.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";

export default function ForumModerationRedirectPage() {
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    router.replace(`/${locale}/admin/moderation#forum`);
  }, [router, locale]);

  return (
    <div className="flex items-center justify-center min-h-[200px] text-muted-foreground text-sm">
      Przekierowuję do panelu moderacji...
    </div>
  );
}
