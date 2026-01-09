# Refactoring Plan: Unified Color System for Light/Dark Mode

## Problem
- Mieszanka hardcoded gray-X kolorów i CSS variables
- Brak spójności między light/dark mode
- Komponenty używają różnych odcieni gray (100, 200, 300, 400, 600, 700, 800, 900)
- Słaby kontrast w dark mode

## Solution: Semantic Color System

### 1. Nowe CSS Variables (globals.css)

```css
:root {
  /* Semantic Background Levels */
  --bg-base: 0 0% 100%;           /* Tło strony - white */
  --bg-subtle: 210 20% 98%;       /* Subtelne tło - very light gray */
  --bg-muted: 210 15% 96%;        /* Wyciszone tło - light gray */
  
  /* Semantic Surface Levels */
  --surface-default: 0 0% 100%;   /* Karty - white */
  --surface-hover: 210 20% 98%;   /* Hover state */
  --surface-active: 210 15% 96%;  /* Active/pressed */
  
  /* Semantic Text Levels */
  --text-primary: 0 0% 9%;        /* Główny tekst - near black */
  --text-secondary: 0 0% 40%;     /* Drugorzędny tekst */
  --text-tertiary: 0 0% 60%;      /* Wyciszony tekst */
  --text-disabled: 0 0% 75%;      /* Nieaktywny tekst */
  
  /* Semantic Border Levels */
  --border-subtle: 210 20% 92%;   /* Subtelne obramowanie */
  --border-default: 210 20% 85%;  /* Standardowe obramowanie */
  --border-strong: 210 20% 75%;   /* Mocne obramowanie */
}

.dark {
  /* Semantic Background Levels */
  --bg-base: 0 0% 8%;             /* Tło strony - very dark gray */
  --bg-subtle: 0 0% 10%;          /* Subtelne tło */
  --bg-muted: 0 0% 12%;           /* Wyciszone tło */
  
  /* Semantic Surface Levels */
  --surface-default: 0 0% 10%;    /* Karty - dark gray */
  --surface-hover: 0 0% 12%;      /* Hover state */
  --surface-active: 0 0% 14%;     /* Active/pressed */
  
  /* Semantic Text Levels */
  --text-primary: 0 0% 98%;       /* Główny tekst - near white */
  --text-secondary: 0 0% 75%;     /* Drugorzędny tekst */
  --text-tertiary: 0 0% 60%;      /* Wyciszony tekst */
  --text-disabled: 0 0% 40%;      /* Nieaktywny tekst */
  
  /* Semantic Border Levels */
  --border-subtle: 0 0% 18%;      /* Subtelne obramowanie */
  --border-default: 0 0% 25%;     /* Standardowe obramowanie */
  --border-strong: 0 0% 35%;      /* Mocne obramowanie */
}
```

### 2. Mapping Guidelines

#### Obecne → Nowe
- `bg-white dark:bg-gray-900` → `bg-surface-default`
- `bg-gray-100 dark:bg-gray-800` → `bg-surface-hover`
- `bg-gray-200 dark:bg-gray-700` → `bg-surface-active`
- `text-gray-900 dark:text-gray-100` → `text-text-primary`
- `text-gray-600 dark:text-gray-400` → `text-text-secondary`
- `text-gray-500 dark:text-gray-500` → `text-text-tertiary`
- `border-gray-200 dark:border-gray-700` → `border-border-default`
- `border-gray-300 dark:border-gray-600` → `border-border-strong`

### 3. Components to Refactor

#### Priority 1 (High Impact)
- [ ] product-card.tsx (42 dark: usages)
- [ ] deal-card.tsx
- [ ] navbar.tsx
- [ ] Button component
- [ ] Badge component

#### Priority 2 (Medium Impact)
- [ ] deals/page.tsx
- [ ] products/page.tsx
- [ ] Card wrappers
- [ ] Modal components

#### Priority 3 (Low Impact)
- [ ] Admin components
- [ ] Form components
- [ ] Utility components

### 4. Implementation Steps

1. **Add new CSS variables to globals.css**
   - Define semantic color system
   - Add utility classes in @layer utilities

2. **Create semantic utility classes**
   ```css
   @layer utilities {
     .bg-surface-default { background-color: hsl(var(--surface-default)); }
     .bg-surface-hover { background-color: hsl(var(--surface-hover)); }
     .text-text-primary { color: hsl(var(--text-primary)); }
     .text-text-secondary { color: hsl(var(--text-secondary)); }
     .border-border-default { border-color: hsl(var(--border-default)); }
     /* ... more utilities */
   }
   ```

3. **Refactor product-card.tsx** (example)
   ```tsx
   // Before:
   className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
   
   // After:
   className="bg-surface-default border-border-default"
   ```

4. **Test in both modes**
   - Verify contrast ratios (WCAG AA)
   - Check hover/active states
   - Validate focus rings

5. **Document new system**
   - Update component docs
   - Add examples to Storybook (if exists)
   - Create visual guide

### 5. Benefits

✅ **Single source of truth** - tylko CSS variables, zero hardcoded colors  
✅ **Automatic dark mode** - nie trzeba pisać dark: dla każdego elementu  
✅ **Łatwiejsze maintenance** - zmiana w jednym miejscu  
✅ **Lepsza spójność** - semantic naming zapewnia consistent usage  
✅ **Lepszy kontrast** - przemyślane wartości dla accessibility  

### 6. Migration Checklist

- [ ] Backup current globals.css
- [ ] Add new semantic variables
- [ ] Create utility classes
- [ ] Refactor product-card.tsx
- [ ] Test thoroughly
- [ ] Commit and deploy
- [ ] Refactor remaining components
- [ ] Remove old dark: classes
- [ ] Update documentation

## Timeline
- Phase 1: CSS variables + utilities (30 min)
- Phase 2: product-card.tsx refactor (20 min)
- Phase 3: Testing (15 min)
- Phase 4: Remaining components (1-2h)

**Total estimated: 2-3 hours**
