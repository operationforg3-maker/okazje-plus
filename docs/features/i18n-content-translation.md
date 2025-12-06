# Multi-Language Support (i18n) - Content Translation

## Overview

Platforma Okazje Plus wspiera wielojęzyczność treści (produkty, kategorie) w trzech językach:
- **Polski (PL)** - język główny
- **English (EN)** - język międzynarodowy
- **Deutsch (DE)** - rynek niemiecki

## Architektura

### 1. Struktura Danych

#### Product Interface
```typescript
interface Product {
  name: string;              // Polish (primary)
  description: string;       // Polish
  longDescription: string;   // Polish
  
  translations?: {
    en?: {
      name: string;
      description: string;
      longDescription?: string;
      seoKeywords?: string[];
      metaTitle?: string;
      metaDescription?: string;
    };
    de?: {
      name: string;
      description: string;
      longDescription?: string;
      seoKeywords?: string[];
      metaTitle?: string;
      metaDescription?: string;
    };
  };
}
```

#### Category Interface
```typescript
interface Category {
  name: string;         // Polish (primary)
  description?: string; // Polish
  
  translations?: {
    en?: { name: string; description?: string };
    de?: { name: string; description?: string };
  };
}
```

### 2. AI Translation Flows

#### aiTranslateProduct
- **Input**: Polish product content
- **Output**: EN + DE translations
- **Features**:
  - Natural localization (not literal translation)
  - E-commerce best practices
  - SEO optimization per language
  - Cultural adaptation
  - Technical term handling

#### aiTranslateCategory
- **Input**: Polish category names/descriptions
- **Output**: EN + DE translations
- **Features**:
  - Standard e-commerce terminology
  - Market-appropriate naming
  - SEO-friendly slugs

### 3. Bulk Import Pipeline

**Stage 5: Translation** (after SEO generation)
```
1. Quality Score (PL)
2. Title Normalization (PL)
3. Category Mapping (PL)
4. SEO Description (PL)
5. Translation (PL → EN, DE) ← NEW
```

## Usage

### Backend: Get Translations

```typescript
import { getProductName, getProductDescription } from '@/lib/i18n-content';

// Get translated product name
const name = getProductName(product, 'en'); // Returns EN translation or fallback to PL

// Get translated description
const desc = getProductDescription(product, 'de'); // Returns DE translation or fallback to PL
```

### Frontend: Language Detection

```typescript
'use client';
import { useContentLanguage } from '@/hooks/use-content-language';

function MyComponent() {
  const { language, setLanguage, isLoading } = useContentLanguage();
  
  // Current language: 'pl' | 'en' | 'de'
  // Auto-detected from: 1. localStorage, 2. browser, 3. default (pl)
  
  return <div>Current language: {language}</div>;
}
```

### Component: Language Switcher

```typescript
import { LanguageSwitcher } from '@/components/language-switcher';

function Header() {
  return (
    <nav>
      <LanguageSwitcher />
    </nav>
  );
}
```

## API Endpoints

### Bulk Import Preview
```bash
POST /api/admin/bulk-import/preview
```
Automatically translates products during preview generation.

Response includes:
```json
{
  "products": [{
    "_aiMetadata": {
      "translations": {
        "en": { "name": "...", "description": "..." },
        "de": { "name": "...", "description": "..." }
      }
    }
  }]
}
```

### Bulk Import Commit
```bash
POST /api/admin/bulk-import/commit
```
Saves translations to Firestore:
```json
{
  "name": "Słuchawki bezprzewodowe",
  "translations": {
    "en": { "name": "Wireless Headphones", ... },
    "de": { "name": "Kabellose Kopfhörer", ... }
  }
}
```

## Translation Quality

### AI Prompt Guidelines

1. **Natural Localization**: Not word-for-word, culturally adapted
2. **E-commerce Focus**: Benefit-driven, conversion-optimized
3. **SEO Best Practices**: Keywords, meta tags optimized per language
4. **Technical Terms**: Keep English terms where standard (USB-C, LED, 5G)
5. **Measurements**: Adapt units (inches for EN, cm for DE)

### Fallback Strategy

If AI translation fails:
- Returns placeholder: `[EN] Polish Title`
- Logged for manual review
- Primary Polish content always available

## Firestore Schema

### products/{productId}
```json
{
  "name": "Polski Tytuł",
  "description": "Polski opis...",
  "translations": {
    "en": {
      "name": "English Title",
      "description": "English description...",
      "seoKeywords": ["keyword1", "keyword2"],
      "metaTitle": "SEO Title",
      "metaDescription": "SEO Description"
    },
    "de": { ... }
  }
}
```

### categories/{categoryId}
```json
{
  "name": "Elektronika",
  "translations": {
    "en": { "name": "Electronics", "description": "..." },
    "de": { "name": "Elektronik", "description": "..." }
  },
  "subcategories": [
    {
      "name": "Smartfony",
      "translations": {
        "en": { "name": "Smartphones" },
        "de": { "name": "Smartphones" }
      }
    }
  ]
}
```

## Future Enhancements

### Phase 2: URL Routing
```
/pl/produkty/...  ← Polish
/en/products/...  ← English
/de/produkte/...  ← German
```

### Phase 3: Interface Translation
- next-intl integration
- Static UI translations (buttons, labels, etc.)
- Dynamic routing per language

### Phase 4: Additional Languages
- French (FR)
- Spanish (ES)
- Italian (IT)

## Testing

### Manual Testing
1. Bulk import products
2. Check Firestore: `products/{id}.translations`
3. Verify EN and DE fields populated
4. Quality check: natural language, no "[EN]" placeholders

### Automated Testing
```bash
npm run test -- i18n-content.test.ts
```

## Troubleshooting

### Translations Missing
- Check AI logs: `[Bulk Preview] 🌍 Translating product...`
- Verify Gemini API key valid
- Check fallback placeholders: `[EN]` prefix

### Incorrect Translations
- Review AI prompt in `src/ai/flows/aiTranslateProduct.ts`
- Adjust guidelines for specific issues
- Report edge cases for prompt refinement

## Related Files

- `src/lib/types.ts` - Type definitions
- `src/lib/i18n-content.ts` - Translation utilities
- `src/hooks/use-content-language.ts` - React hook
- `src/ai/flows/aiTranslateProduct.ts` - AI translation flow
- `src/ai/flows/aiTranslateCategory.ts` - Category translation
- `src/components/language-switcher.tsx` - UI component
- `src/app/api/admin/bulk-import/preview/route.ts` - Integration point

## Contact

Questions? See `.github/copilot-instructions.md` or check main `README.md`.
