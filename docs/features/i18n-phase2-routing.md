# Phase 2: next-intl URL Routing & Interface Translation

## ✅ Status: IMPLEMENTED

Multi-language routing with next-intl is now active. Users can access the site in Polish (default), English, and German with automatic URL-based language switching.

## 🌍 URL Structure

- **Polish (default)**: `/` or `/pl/` 
- **English**: `/en/`
- **German**: `/de/`

Examples:
- `/` → Polish homepage
- `/en/` → English homepage
- `/de/produkty/123` → German product page

## 🔧 Implementation Details

### 1. Configuration Files

**`src/i18n.ts`**
```typescript
export const locales = ['pl', 'en', 'de'] as const;
export const defaultLocale: Locale = 'pl';
```

**`src/middleware.ts`**
- Automatic locale detection from `Accept-Language` header
- `localePrefix: 'as-needed'` - Polish has no prefix, EN/DE require `/en` and `/de`
- Excludes API routes, static files, Next.js internals

**`next.config.ts`**
- Integrated `next-intl/plugin`
- Wraps config with `withNextIntl()`

### 2. Translation Messages

Located in `messages/` directory:
- `pl.json` - Polski (primary)
- `en.json` - English
- `de.json` - Deutsch

**Structure**:
```json
{
  "common": { "loading": "Loading...", ... },
  "nav": { "home": "Home", ... },
  "product": { "price": "Price", ... },
  "search": { "placeholder": "Search...", ... },
  ...
}
```

### 3. Component Integration

**Using translations in components**:
```typescript
'use client';
import { useTranslations } from 'next-intl';

function MyComponent() {
  const t = useTranslations('search');
  
  return <input placeholder={t('placeholder')} />;
}
```

**Server components**:
```typescript
import {useTranslations} from 'next-intl';

export default function ServerComponent() {
  const t = useTranslations('common');
  return <h1>{t('loading')}</h1>;
}
```

### 4. Language Switcher

**Component**: `src/components/language-switcher.tsx`

- Dropdown menu with language flags (🇵🇱 🇬🇧 🇩🇪)
- Automatically switches URL path on language change
- Preserves current page context (e.g., `/produkty/123` → `/en/produkty/123`)
- Integrated in Navbar

**Usage**:
```typescript
import { LanguageSwitcher } from '@/components/language-switcher';

<LanguageSwitcher />
```

## 📦 Integrated Components

Currently using `useTranslations`:
- ✅ `search-bar.tsx` - Search placeholder and status messages
- ✅ `navbar.tsx` - LanguageSwitcher added to header
- 🔄 More components to be migrated progressively

## 🔄 Migration Strategy

### Priority 1 (High Visibility)
- [ ] Navbar navigation links (`nav.*`)
- [ ] Footer (`footer.*`)
- [ ] Homepage hero section
- [ ] Product cards (`product.*`)
- [ ] Deal cards (`deal.*`)

### Priority 2 (User Actions)
- [ ] Login/Auth forms
- [ ] Add Deal form
- [ ] Comment section
- [ ] User profile

### Priority 3 (Admin)
- [ ] Admin dashboard (`admin.*`)
- [ ] Bulk import wizard
- [ ] Moderation panel

## 🚀 How to Add Translations

1. **Add keys to messages files**:
   ```json
   // messages/pl.json
   {
     "mySection": {
       "title": "Mój tytuł"
     }
   }
   
   // messages/en.json
   {
     "mySection": {
       "title": "My title"
     }
   }
   ```

2. **Use in component**:
   ```typescript
   const t = useTranslations('mySection');
   <h1>{t('title')}</h1>
   ```

3. **For dynamic/rich text**:
   ```typescript
   t.rich('welcomeMessage', {
     b: (chunks) => <strong>{chunks}</strong>,
     name: user.name
   });
   ```

## 🌐 SEO Considerations

### Current Setup
- `<html lang={locale}>` dynamically set
- Middleware handles locale detection

### TODO (Future Enhancement)
- [ ] Add `<link rel="alternate" hreflang="x" />` tags
- [ ] Language-specific sitemaps
- [ ] Translated meta descriptions per page
- [ ] OpenGraph locale tags

## 🧪 Testing

### Manual Testing
1. Visit `/` → should see Polish
2. Click language switcher → select English
3. URL changes to `/en/` → interface in English
4. Navigate to product → `/en/produkty/123`
5. Switch to German → `/de/produkty/123`

### Browser Language Detection
- Set browser to German → first visit redirects to `/de/`
- Set to English → redirects to `/en/`
- Polish or unsupported → defaults to Polish

## 📊 Translation Coverage

**Interface (UI)**:
- ✅ Common terms (80+ strings)
- ✅ Navigation (10+ items)
- ✅ Product labels (15+ fields)
- ✅ Search UI (10+ messages)
- ✅ User/Admin sections

**Content (Database)**:
- ✅ Product names, descriptions (AI-translated)
- ✅ Category names (AI-translated)
- ✅ SEO metadata (AI-translated)

## 🔗 Related Documentation

- [Phase 1: Content Translation](./i18n-content-translation.md)
- [next-intl Official Docs](https://next-intl-docs.vercel.app/)
- Main README.md

## 🐛 Known Issues

None at this time. Report issues in GitHub.

## 📝 Notes

- **Content vs Interface**: Content translations are stored in Firestore (see Phase 1), interface translations are in `messages/` JSON files
- **Locale Cookie**: next-intl may set a `NEXT_LOCALE` cookie for preference persistence
- **SSR Compatible**: All translation functions work in both Server and Client Components

---

**Last Updated**: 2025-11-20  
**Status**: Phase 2 Complete ✅  
**Next**: Progressive migration of remaining components
