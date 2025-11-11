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

## Testing and Validation

### Test Infrastructure
The project uses multiple testing frameworks:
- **Jest**: Unit tests for business logic and utilities
- **Playwright**: E2E tests for UI flows and user interactions

### Running Tests
```bash
# Unit tests with Jest
npm run test              # Run all unit tests
npm run test:watch        # Watch mode for development

# E2E tests with Playwright
npm run test:e2e          # Run end-to-end tests
```

### Test Conventions
- Unit test files: `*.test.ts` or `*.spec.ts` in `src/` subdirectories
- E2E test files: `*.spec.ts` in `tests/` directory
- Always write tests for new features and bug fixes
- Maintain test coverage for critical paths (auth, data operations, voting)
- Mock Firebase services in unit tests to avoid network calls

### Before Committing
Always run these commands to validate your changes:
```bash
npm run typecheck         # Ensure no TypeScript errors
npm run lint              # Check code style (will auto-fix some issues)
npm run test              # Verify unit tests pass
```

## Build and Development

### Development Server
```bash
npm run dev               # Starts Next.js dev server on port 9002
                          # Uses Turbopack for faster builds
```

### Production Build
```bash
npm run build             # Creates optimized production build
npm start                 # Runs production server
```

### Build Requirements
- Build must complete without TypeScript errors
- All ESLint rules must pass
- No console errors or warnings in production build

## Code Quality Standards

### TypeScript
- **Strict mode enabled**: All code must be properly typed
- **No `any` types**: Use proper TypeScript types from `src/lib/types.ts`
- **No type assertions** unless absolutely necessary and documented
- Import types from the single source of truth: `src/lib/types.ts`

### Code Style
- **ESLint**: Follow Next.js recommended rules
- **Formatting**: Consistent with project's ESLint config
- **Polish language**: Use Polish for UI text, variable names in Polish context
- **Comments**: Polish for business logic, English for technical implementation details

### Security Best Practices
- **Never commit secrets**: Use environment variables for all sensitive data
- **Firebase Security Rules**: Always validate changes against `firestore.rules`
- **Input validation**: Use Zod schemas for all user inputs
- **Authentication checks**: Always verify user auth state before sensitive operations
- **SQL injection prevention**: Use Firestore's parameterized queries (handled by SDK)

## Deployment

### Firebase App Hosting
The app is deployed to Firebase App Hosting in the `europe-west1` region:

```bash
firebase login            # Authenticate with Firebase
firebase deploy           # Deploy entire project
firebase deploy --only hosting     # Deploy only hosting
firebase deploy --only functions   # Deploy only cloud functions
```

### Pre-deployment Checklist
- [ ] All tests pass (`npm run test` and `npm run test:e2e`)
- [ ] TypeScript validation passes (`npm run typecheck`)
- [ ] Linting passes (`npm run lint`)
- [ ] Production build succeeds (`npm run build`)
- [ ] Environment variables configured in Firebase console
- [ ] Security rules reviewed and updated if needed

### Environment Configuration
- **Development**: Use `.env.local` (not committed)
- **Production**: Configure in Firebase App Hosting settings
- **Required variables**: See README.md for complete list

## Working with Issues

### Issue Guidelines
When working on an issue:
1. **Understand the scope**: Read the issue description and all comments carefully
2. **Minimal changes**: Make the smallest possible changes to fix the issue
3. **Test coverage**: Add tests if the issue involves new functionality
4. **Polish language**: Maintain Polish language consistency in UI
5. **Documentation**: Update docs if changing public APIs or behaviors

### Issue Types Best Suited for AI
- Bug fixes with clear reproduction steps
- Adding tests for existing functionality
- Documentation improvements
- Code refactoring within a single file or component
- Accessibility improvements
- TypeScript type improvements

### Issues Requiring Human Review
- Major architectural changes
- Security-sensitive code
- Complex business logic requiring domain knowledge
- Changes affecting multiple interdependent systems
- Performance optimizations requiring profiling

## Common Tasks

### Adding a New Deal/Product Field
1. Update types in `src/lib/types.ts`
2. Update Firestore security rules in `firestore.rules`
3. Add UI components in relevant pages
4. Update data fetching in `src/lib/data.ts`
5. Add validation with Zod schemas
6. Write tests for the new field

### Creating a New Admin Feature
1. Create page in `src/app/admin/`
2. Implement server actions for data operations
3. Add role-based auth checks using `withAuth()` HOC
4. Update admin navigation if needed
5. Test with different user roles

### Integrating New AI Flow
1. Create flow in `src/ai/flows/`
2. Register in `src/ai/genkit.ts`
3. Add server action wrapper
4. Create admin UI in `src/app/admin/`
5. Test with `npm run genkit:dev`

## Troubleshooting

### Common Development Issues

**Build fails with Firebase config error**
- Ensure `.env.local` exists with all required variables
- Check `FIREBASE_WEBAPP_CONFIG` for server-side config

**Genkit AI not working**
- Verify `GOOGLE_GENAI_API_KEY` is set
- Run `npm run genkit:dev` to start Genkit development server
- Check `src/ai/genkit.ts` configuration

**Tests failing**
- For Firebase tests: Ensure Firebase emulators are running
- For E2E tests: Check if dev server is running on port 9002
- Clear test cache: `npm run test -- --clearCache`

**TypeScript errors in scripts**
- Scripts use `ts-node` which requires `@types/node`
- These errors can be ignored if not working on scripts
- To fix: Ensure proper TypeScript configuration for Node.js scripts