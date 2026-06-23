type TranslationEntry = {
  name?: string;
  description?: string;
};

export const CATEGORY_TRANSLATION_LOCALES = ['pl', 'en', 'de', 'fr', 'es', 'uk'] as const;

export type CategoryTranslationLocale = (typeof CATEGORY_TRANSLATION_LOCALES)[number];
export type CategoryTranslations = Record<string, TranslationEntry>;

const ORDERED_FALLBACK_LOCALES: string[] = ['pl', 'en', 'de', 'fr', 'es', 'uk', 'ua'];

const clean = (value: unknown): string => String(value || '').trim();

export function ensureCategoryTranslations(
  translationsInput: unknown,
  fallbackName: string,
  fallbackDescription?: string
): Record<CategoryTranslationLocale, { name: string; description?: string }> {
  const source: CategoryTranslations =
    translationsInput && typeof translationsInput === 'object' && !Array.isArray(translationsInput)
      ? ({ ...(translationsInput as CategoryTranslations) } as CategoryTranslations)
      : {};

  // Legacy compatibility: some sources may incorrectly use ua instead of uk.
  if (!source.uk && source.ua) {
    source.uk = source.ua;
  }

  const bestName =
    clean(source?.pl?.name) ||
    clean(fallbackName) ||
    ORDERED_FALLBACK_LOCALES.map((locale) => clean(source?.[locale]?.name)).find(Boolean) ||
    '';

  const bestDescription =
    clean(source?.pl?.description) ||
    clean(fallbackDescription) ||
    ORDERED_FALLBACK_LOCALES.map((locale) => clean(source?.[locale]?.description)).find(Boolean) ||
    '';

  const normalized = {} as Record<CategoryTranslationLocale, { name: string; description?: string }>;

  for (const locale of CATEGORY_TRANSLATION_LOCALES) {
    const currentName = clean(source?.[locale]?.name);
    const currentDescription = clean(source?.[locale]?.description);

    if (currentName || currentDescription || locale === 'pl' || locale === 'en') {
      normalized[locale] = {
        name: currentName || bestName,
        ...(currentDescription || bestDescription ? { description: currentDescription || bestDescription } : {}),
      };
    }
  }

  return normalized;
}
