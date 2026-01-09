/**
 * Persona Generator Service
 * 
 * Generates realistic AI-powered user profiles (personas) for imported deals.
 * Instead of using hardcoded bot names (TechHunter_99, DealMaster_47),
 * uses Vertex AI (Gemini) to create unique, contextual personas based on deal content.
 * 
 * Features:
 * - Generate realistic Polish/international usernames
 * - Create avatar descriptions (emoji or text-based)
 * - Match persona to deal category/content for authenticity
 * - Cache personas to ensure consistency across deals from same batch
 * - Support for multiple languages
 */

import { generateText } from "../vertex";
import { logger } from "@/lib/logging";

export interface GeneratedPersona {
  id: string;
  displayName: string;
  username: string;
  avatar?: string;
  bio?: string;
  category?: string; // Category this persona is associated with
  language: string; // 'pl', 'en', 'de', etc.
  generatedAt: string;
}

const personaCache = new Map<string, GeneratedPersona>();

/**
 * Generate a unique, contextual persona for a deal
 * @param dealTitle - Title of the deal to contextualize the persona
 * @param dealCategory - Category of the deal (e.g., "electronics", "fashion")
 * @param language - Language for persona generation (default: 'pl')
 * @returns Generated persona with username, display name, and avatar
 */
export async function generatePersona(
  dealTitle: string,
  dealCategory?: string,
  language: string = "pl"
): Promise<GeneratedPersona> {
  try {
    // Create cache key from title + category
    const cacheKey = `${dealTitle}:${dealCategory}:${language}`;
    if (personaCache.has(cacheKey)) {
      logger.debug("Returning cached persona", { cacheKey });
      return personaCache.get(cacheKey)!;
    }

    // Prepare prompt based on language
    const prompt = getPersonaGenerationPrompt(dealTitle, dealCategory, language);

    // Call Vertex AI to generate persona
    const response = await generateText(prompt, {
      temperature: 0.8, // Higher creativity for personas
      maxTokens: 300,
      model: "gemini-1.5-flash",
    });

    // Parse the generated persona from response
    const persona = parsePersonaResponse(response, language);

    // Cache it
    personaCache.set(cacheKey, persona);

    logger.debug("Generated new persona", {
      username: persona.username,
      displayName: persona.displayName,
      category: dealCategory,
    });

    return persona;
  } catch (error) {
    logger.error("Failed to generate persona, using fallback", {
      dealTitle,
      dealCategory,
      error: error instanceof Error ? error.message : String(error),
    });

    // Fallback to simple generated persona if AI fails
    return generateFallbackPersona(dealTitle, dealCategory, language);
  }
}

/**
 * Generate a batch of personas for multiple deals
 * Useful for bulk imports to ensure diverse personas
 */
export async function generatePersonaBatch(
  deals: Array<{ title: string; category?: string }>,
  language: string = "pl"
): Promise<GeneratedPersona[]> {
  const personas: GeneratedPersona[] = [];

  for (const deal of deals) {
    const persona = await generatePersona(deal.title, deal.category, language);
    personas.push(persona);

    // Rate limiting to avoid API throttling
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return personas;
}

/**
 * Clear persona cache (for testing or maintenance)
 */
export function clearPersonaCache(): void {
  personaCache.clear();
  logger.info("Persona cache cleared");
}

/**
 * Get cache statistics
 */
export function getPersonaCacheStats(): { size: number; keys: string[] } {
  return {
    size: personaCache.size,
    keys: Array.from(personaCache.keys()),
  };
}

// ===== Internal Helpers =====

/**
 * Generate appropriate prompt for persona generation
 */
function getPersonaGenerationPrompt(
  dealTitle: string,
  dealCategory?: string,
  language: string = "pl"
): string {
  if (language === "pl") {
    return `Jesteś kreatywnym asystentem do generowania realistycznych profili użytkowników.
Wygeneruj unikalną, autentyczną polską osobę (personę) dla użytkownika, który mógłby być zainteresowany następującą okazją:

Tytuł oferty: "${dealTitle}"
${dealCategory ? `Kategoria: ${dealCategory}` : ""}

Wygeneruj w formacie JSON (bez znaczników markdown) z następującymi polami:
- "username": unikalna nazwa użytkownika (bez spacji, pl znaki diakrytyczne dozwolone, np. "Anna_K", "TechGuru_PL", "DealHunter2025")
- "displayName": wyświetlana nazwa (może zawierać spacje, emotikonki opcjonalnie, np. "Anna K", "🔧 TechGuru")
- "avatar": emoji lub opis emoji reprezentujący interesy (np. "🛍️", "💻", "🏠")
- "bio": krótka biografia (1-2 zdania, polska, autentyczna, odnoszące się do kategorii produktu)

Upewnij się, że persona jest realistyczna i odpowiadająca kategorii produktu. Zwróć TYLKO JSON bez komentarzy.`;
  } else if (language === "en") {
    return `You are a creative assistant for generating realistic user profiles.
Generate a unique, authentic English-speaking persona for a user who might be interested in the following deal:

Deal Title: "${dealTitle}"
${dealCategory ? `Category: ${dealCategory}` : ""}

Generate in JSON format (no markdown) with these fields:
- "username": unique username (no spaces, e.g., "Anna_K", "TechGuru", "DealHunter2025")
- "displayName": display name (can include spaces and optional emojis, e.g., "Anna K", "🔧 TechGuru")
- "avatar": emoji or emoji description representing interests (e.g., "🛍️", "💻", "🏠")
- "bio": short biography (1-2 sentences, English, authentic, related to product category)

Ensure the persona is realistic and matches the product category. Return ONLY JSON without comments.`;
  } else if (language === "de") {
    return `Du bist ein kreativer Assistent für die Generierung realistischer Benutzerprofile.
Generiere eine einzigartige, authentische deutschsprachige Person (Persona) für einen Benutzer, der sich für folgendes Angebot interessieren könnte:

Angebots-Titel: "${dealTitle}"
${dealCategory ? `Kategorie: ${dealCategory}` : ""}

Generiere im JSON-Format (ohne Markdown) mit folgenden Feldern:
- "username": eindeutiger Benutzername (keine Leerzeichen, z.B. "Anna_K", "TechGuru", "DealHunter2025")
- "displayName": angezeigter Name (kann Leerzeichen und optionale Emojis enthalten, z.B. "Anna K", "🔧 TechGuru")
- "avatar": Emoji oder Emoji-Beschreibung, die Interessen darstellt (z.B. "🛍️", "💻", "🏠")
- "bio": kurze Biografie (1-2 Sätze, Deutsch, authentisch, bezogen auf die Produktkategorie)

Stelle sicher, dass die Persona realistisch ist und zur Produktkategorie passt. Gib NUR JSON ohne Kommentare zurück.`;
  }

  // Fallback to English for unknown languages
  return `You are a creative assistant for generating realistic user profiles.
Generate a unique, authentic persona for a user interested in: "${dealTitle}"
${dealCategory ? `Category: ${dealCategory}` : ""}
Return JSON with: username, displayName, avatar, bio. No markdown.`;
}

/**
 * Parse JSON response from AI into GeneratedPersona
 */
function parsePersonaResponse(response: string, language: string): GeneratedPersona {
  try {
    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const data = JSON.parse(jsonMatch[0]);

    return {
      id: `persona_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      displayName: data.displayName || data.username || "User",
      username: data.username || `user_${Date.now()}`,
      avatar: data.avatar || "👤",
      bio: data.bio,
      language,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.warn("Failed to parse persona JSON, using fallback", {
      error: error instanceof Error ? error.message : String(error),
      response: response.substring(0, 100),
    });

    throw error; // Re-throw to use fallback
  }
}

/**
 * Generate fallback persona when AI generation fails
 * Uses simple algorithm to create coherent names based on deal
 */
function generateFallbackPersona(
  dealTitle: string,
  dealCategory?: string,
  language: string = "pl"
): GeneratedPersona {
  // Extract keywords from title
  const keywords = dealTitle
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 2);

  // Map category to emoji
  const categoryEmojis: Record<string, string> = {
    electronics: "💻",
    fashion: "👗",
    home: "🏠",
    sports: "⚽",
    books: "📚",
    toys: "🧸",
    food: "🍕",
    beauty: "💄",
    automotive: "🚗",
    default: "🛍️",
  };

  const avatar = categoryEmojis[dealCategory?.toLowerCase() || ""] || categoryEmojis.default;

  // Generate username
  const timestamp = Date.now().toString().slice(-4);
  const username =
    keywords.length > 0
      ? `${keywords[0]}_${timestamp}`.replace(/[^a-zA-Z0-9_ąćęłńóśźż]/g, "")
      : `user_${timestamp}`;

  // Generate display name
  const displayName =
    keywords.length > 0
      ? `${keywords[0].charAt(0).toUpperCase()}${keywords[0].slice(1)} ${timestamp.slice(-2)}`
      : `User ${timestamp.slice(-3)}`;

  return {
    id: `persona_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    displayName: `${avatar} ${displayName}`,
    username,
    avatar,
    bio: `Zainteresowany${language === "pl" ? "a" : ""} ${dealCategory || "okazjami"}`, // Polish gendered form
    language,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Helper: Convert persona to User object structure for Firestore
 */
export function personaToUser(persona: GeneratedPersona): {
  uid: string;
  displayName: string;
  photoURL: string;
  isAiGenerated: boolean;
  personaId: string;
} {
  return {
    uid: persona.id,
    displayName: persona.displayName,
    photoURL: persona.avatar || "👤",
    isAiGenerated: true,
    personaId: persona.id,
  };
}
