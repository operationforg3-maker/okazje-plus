/**
 * AI Flow: Generate Subcategory Context for Better Import
 * 
 * Generates detailed context for each sub-subcategory:
 * - Polish and English descriptions
 * - Example products (5 items)
 * - Search keywords for imports
 * 
 * This helps the import pipeline understand what products to search for.
 */

import { z } from 'zod';
import { ai } from '../genkit';

const InputSchema = z.object({
  mainCategoryName: z.string().describe('Main category name (e.g., "Elektronika")'),
  subcategoryName: z.string().describe('Subcategory name (e.g., "Smartfony i telefony")'),
  subsubcategoryName: z.string().describe('Sub-subcategory name (e.g., "Smartfony")'),
});

const OutputSchema = z.object({
  descriptionPl: z.string().describe('Polish description (2-3 sentences, for UI)'),
  descriptionEn: z.string().describe('English description (2-3 sentences, for backend)'),
  exampleProducts: z.array(
    z.object({
      name: z.string().describe('Product name (English)'),
      category: z.string().describe('Product category'),
    })
  ).length(5).describe('5 example products'),
  searchKeywords: z.array(z.string()).describe('5-10 keywords for AliExpress search'),
});

export type SubcategoryContextInput = z.infer<typeof InputSchema>;
export type SubcategoryContextOutput = z.infer<typeof OutputSchema>;

export async function generateSubcategoryContext(input: SubcategoryContextInput): Promise<SubcategoryContextOutput> {
  const prompt = `You are a product categorization expert for an e-commerce platform.

Generate detailed context for this product category to help AI search for the right products:

**Category Path:**
- Main Category: ${input.mainCategoryName}
- Subcategory: ${input.subcategoryName}
- Sub-Subcategory: ${input.subsubcategoryName}

**Task:**
1. Write a SHORT Polish description (2-3 sentences) that describes what products belong to this category
2. Write a SHORT English description (2-3 sentences) - clear and specific for backend use
3. List 5 real product examples that would fit this category
4. Generate 5-10 search keywords (English) that would find products in this category on AliExpress

**Format your response as valid JSON matching this schema:**
{
  "descriptionPl": "string",
  "descriptionEn": "string",
  "exampleProducts": [
    { "name": "string", "category": "string" },
    ...
  ],
  "searchKeywords": ["string", "string", ...]
}

**Examples for reference:**
- For "Smartfony" under "Elektronika": products like iPhone, Samsung Galaxy, Google Pixel
- For "Sofy" under "Meble": products like corner sofa, leather sofa, fabric sofa
- For "Buty" under "Moda": products like sneakers, boots, dress shoes`;

  try {
    const response = await ai.generate({
      prompt,
      config: {
        temperature: 1,
        maxOutputTokens: 1024,
      },
    });

    const text = response.text;
    const parsed = JSON.parse(text);
    
    // Validate output structure
    const validated = OutputSchema.parse(parsed);
    
    return {
      descriptionPl: validated.descriptionPl,
      descriptionEn: validated.descriptionEn,
      exampleProducts: validated.exampleProducts,
      searchKeywords: validated.searchKeywords,
    };
  } catch (error) {
    console.error('[generateSubcategoryContext] Failed to parse AI response:', error);
    
    // Fallback response
    return {
      descriptionPl: `Produkty z kategorii ${input.subsubcategoryName}`,
      descriptionEn: `Products in the ${input.subsubcategoryName} category`,
      exampleProducts: [
        { name: input.subsubcategoryName, category: input.subcategoryName },
        { name: `${input.subsubcategoryName} 2`, category: input.subcategoryName },
        { name: `${input.subsubcategoryName} 3`, category: input.subcategoryName },
        { name: `${input.subsubcategoryName} 4`, category: input.subcategoryName },
        { name: `${input.subsubcategoryName} 5`, category: input.subcategoryName },
      ],
      searchKeywords: [input.subsubcategoryName.toLowerCase(), input.subcategoryName.toLowerCase()],
    };
  }
}

export default generateSubcategoryContext;
