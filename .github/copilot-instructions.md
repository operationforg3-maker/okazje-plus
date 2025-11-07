# Okazje Plus - AI Coding Assistant Guide

## Architecture Overview

This is a **Polish deals/offers platform** built with Next.js 15, Firebase, and Genkit AI. The app follows a deals aggregation pattern similar to Pepper/MyDealz, where users discover, vote on, and comment on deals.

### Core Tech Stack
- **Frontend**: Next.js 15 (App Router), React 18, Tailwind CSS, shadcn/ui components
- **Backend**: Firebase Firestore, Firebase Auth, Firebase Cloud Functions
- **AI**: Google Genkit for trending prediction (src/ai/)
- **Search**: Typesense for product/deal search
- **Deployment**: Firebase App Hosting (europe-west1)

## Key Architectural Patterns

### 1. Dual Environment Firebase Configuration
```typescript
// src/lib/firebase.ts - Server vs Client config pattern
const firebaseConfig = isServer
  ? JSON.parse(process.env.FIREBASE_WEBAPP_CONFIG || '{}')  // App Hosting
  : { /* client env vars */ };
```

### 2. Hierarchical Category System
All content uses `mainCategorySlug` + `subCategorySlug` structure:
```typescript
// src/lib/types.ts
interface Deal {
  mainCategorySlug: string; // e.g., "elektronika"
  subCategorySlug: string;  // e.g., "smartfony"
}
```

### 3. Temperature-Based Deal Ranking
Deals use a "temperature" system (like Pepper.com) for popularity ranking, not traditional upvotes.

## Development Workflows

### Essential Commands
```bash
npm run dev              # Development server on port 9002 with Turbopack
npm run genkit:dev       # Start Genkit AI development server
npm run genkit:watch     # Genkit with hot reload
npm run typecheck        # TypeScript validation
```

### AI Integration Pattern
- AI flows live in `src/ai/flows/` (TypeScript server actions)
- Genkit configuration in `src/ai/genkit.ts` 
- Admin forms call AI flows via server actions (see `src/app/admin/trending-prediction/`)

### Firebase Functions Structure
- Cloud Functions in `okazje-plus/src/index.ts` (separate package.json)
- Import types from main app: `import { Deal, Product } from "../src/lib/types"`
- CSV import functions for bulk data operations

## Project-Specific Conventions

### Authentication & Authorization
- Context-based auth in `src/lib/auth.tsx`
- HOC pattern: `withAuth()` wrapper for protected components
- Admin routes protected via user role checking

### Component Architecture
- UI components in `src/components/ui/` (shadcn/ui)
- Business components in `src/components/` with domain prefixes
- Server actions for form handling (especially admin operations)

### Data Patterns
- All data fetching in `src/lib/data.ts` using Firestore SDK
- Polish language throughout (UI text, variable names, comments)
- Status-based filtering (`status: "approved"`) for public content
- Optimistic updates for voting/interactions

### Styling Approach
- Tailwind with responsive-first design
- Polish typography with `font-headline` for headings
- Emoji-enhanced section headers (🎯 Gorące Okazje, 🛍️ Polecane Produkty)

## Integration Points

### External Services
- **Typesense**: Product/deal search with graceful degradation if not configured
- **Firebase**: Firestore for data, Auth for users, Functions for server logic
- **Google AI**: Gemini 2.5 Flash via Genkit for trending predictions

### Environment Variables
- Dual config pattern for Firebase (client `NEXT_PUBLIC_*` vs server `FIREBASE_WEBAPP_CONFIG`)
- Optional Typesense integration via `NEXT_PUBLIC_TYPESENSE_*` vars
- Genkit AI requires Google AI API configuration

## Critical File Locations
- **Types**: `src/lib/types.ts` (single source of truth)
- **Firebase**: `src/lib/firebase.ts` (dual config)
- **Data Layer**: `src/lib/data.ts` (all Firestore operations)
- **AI Integration**: `src/ai/genkit.ts` and `src/ai/flows/`
- **Auth Logic**: `src/lib/auth.tsx` (context + HOC)