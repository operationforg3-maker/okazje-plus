// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { fillCategoriesWithDeals } from '@/ai/flows/fillCategoriesWithDeals';
import { createCategoryStructure } from '@/ai/flows/createCategoryStructure';
import generateCategoriesAI from '@/ai/flows/generateCategoriesAI';
import { fillSubSubcategoryProducts } from '@/ai/flows/fillSubSubcategoryProducts';
import { logAiCommand } from '@/lib/data-admin';
import { getAllCategories, getSubcategories, getSubSubcategories } from '@/lib/data-admin';
import { generateText, parseJsonFromResponse } from '@/lib/vertex';
import { JobQueue } from '@/lib/ingestion/queue';
import { getServerAuthSession } from '@/lib/auth-server';

const jobQueue = new JobQueue();

/**
 * AI Command Dispatcher
 * 
 * Unified endpoint for natural language operations.
 * Uses Vertex AI to parse prompts and JobQueue for async execution.
 * 
 * Supports:
 * - Natural language: "Import 20 gaming laptops"
 * - Legacy commands: "createCategoryStructure", "fillCategoriesWithDeals"
 */

export async function POST(req: NextRequest) {
  try {
    // Check auth
    const session = await getServerAuthSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - admin role required' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { command, prompt } = body;
    
    const inputText = prompt || command;
    
    console.log('[AI Command] Received:', inputText);
    
    if (!inputText) {
      return NextResponse.json({ 
        error: 'Brak polecenia',
        message: 'Błąd: Nie podano polecenia do wykonania' 
      }, { status: 400 });
    }
    
    let result: string;
    let jobId: string | undefined;
    
    // Try parsing as natural language first
    const isNaturalLanguage = !['createCategoryStructure', 'generateCategoriesAI', 'fillCategoriesWithProducts', 'fillCategoriesWithDeals'].includes(inputText);
    
    if (isNaturalLanguage) {
      console.log('[AI Command] Parsing natural language with Vertex AI...');
      
      const aiPrompt = `You are a command dispatcher for an e-commerce operations system.
Parse the following user command and return a JSON object with the action to take.

Available tools:
1. import_products - Import products from AliExpress
   Fields: { tool: "import_products", category: string, subcategory?: string, count: number, keywords?: string }
   
2. audit_seo - Run SEO audit
   Fields: { tool: "audit_seo", scope: "all" | "recent", days?: number }
   
3. audit_content - Run content quality audit
   Fields: { tool: "audit_content", scope: "all" | "category", category?: string }
   
4. validate_links - Check affiliate links
   Fields: { tool: "validate_links", scope: "all" | "category", category?: string }
   
5. maintenance_typesense - Sync Typesense search index
   Fields: { tool: "maintenance_typesense", action: "sync" | "rebuild" }
   
6. create_category - Create new category/subcategory
   Fields: { tool: "create_category", name: string, parent?: string }

User command: "${inputText}"

Respond ONLY with a JSON object. Example:
{ "tool": "import_products", "category": "Electronics", "subcategory": "Laptops", "count": 20, "keywords": "gaming laptop" }`;

      try {
        const aiResponse = await generateText(aiPrompt, {
          temperature: 0.1,
          maxTokens: 500,
        });
        
        const parsedCommand = parseJsonFromResponse(aiResponse);
        console.log('[AI Command] Parsed:', parsedCommand);
        
        // Route to job queue based on tool
        const tool = parsedCommand.tool;
        
        if (tool === 'import_products') {
          jobId = await jobQueue.enqueue('import_filling', {
            category: parsedCommand.category,
            subcategory: parsedCommand.subcategory,
            count: parsedCommand.count || 10,
            keywords: parsedCommand.keywords,
          }, {
            invokedBy: session.uid,
            metadata: { originalCommand: inputText },
          });
          
          result = `✅ Product import queued: ${parsedCommand.count || 10} items from ${parsedCommand.category}${parsedCommand.subcategory ? ` > ${parsedCommand.subcategory}` : ''}`;
          
        } else if (tool === 'audit_seo') {
          jobId = await jobQueue.enqueue('audit_seo', {
            scope: parsedCommand.scope || 'recent',
            days: parsedCommand.days || 7,
          }, {
            invokedBy: session.uid,
            metadata: { originalCommand: inputText },
          });
          
          result = `✅ SEO audit queued: ${parsedCommand.scope} scope`;
          
        } else if (tool === 'audit_content') {
          jobId = await jobQueue.enqueue('audit_content', {
            scope: parsedCommand.scope || 'all',
            category: parsedCommand.category,
          }, {
            invokedBy: session.uid,
            metadata: { originalCommand: inputText },
          });
          
          result = `✅ Content audit queued: ${parsedCommand.scope} scope`;
          
        } else if (tool === 'validate_links') {
          jobId = await jobQueue.enqueue('validate_links', {
            scope: parsedCommand.scope || 'all',
            category: parsedCommand.category,
          }, {
            invokedBy: session.uid,
            metadata: { originalCommand: inputText },
          });
          
          result = `✅ Link validation queued: ${parsedCommand.scope} scope`;
          
        } else if (tool === 'maintenance_typesense') {
          jobId = await jobQueue.enqueue('maintenance_typesense', {
            action: parsedCommand.action || 'sync',
          }, {
            invokedBy: session.uid,
            metadata: { originalCommand: inputText },
          });
          
          result = `✅ Typesense ${parsedCommand.action || 'sync'} queued`;
          
        } else if (tool === 'create_category') {
          jobId = await jobQueue.enqueue('create_category', {
            name: parsedCommand.name,
            parent: parsedCommand.parent,
          }, {
            invokedBy: session.uid,
            metadata: { originalCommand: inputText },
          });
          
          result = `✅ Category creation queued: ${parsedCommand.name}`;
          
        } else {
          return NextResponse.json({
            error: `Unknown tool: ${tool}`,
            message: 'AI parsed an unsupported action',
          }, { status: 400 });
        }
        
        // Log to history
        await logAiCommand({
          command: inputText,
          status: 'success',
          result: `${result} (Job ID: ${jobId})`,
          invokedBy: session.uid,
        });
        
        return NextResponse.json({
          success: true,
          message: result,
          jobId,
          tool,
        }, { status: 202 });
        
      } catch (aiError: any) {
        console.error('[AI Command] Vertex AI parsing failed:', aiError);
        // Fall through to legacy command handling
        console.log('[AI Command] Falling back to legacy command mode');
      }
    }
    
    // Legacy command handling (backward compatibility)
    if (inputText === 'createCategoryStructure' || inputText.includes('utwórz kategorie')) {
      console.log('[AI Command] Executing createCategoryStructure...');
      result = await createCategoryStructure();
      console.log('[AI Command] Result:', result);
      
      // Zaloguj do historii
      try {
        await logAiCommand({
          command: 'createCategoryStructure',
          status: 'success',
          result,
        });
      } catch (logError) {
        console.error('[AI Command] Failed to log command:', logError);
      }
    } else if (inputText === 'generateCategoriesAI' || inputText.includes('generuj kategorie')) {
      console.log('[AI Command] Executing generateCategoriesAI...');
      const params = body?.params ?? { mode: 'seeds-only' };
      const aiRes = await generateCategoriesAI(params);
      result = `OK: Utworzono ${aiRes.createdCount} kategorii (mode: ${aiRes.mode})`;
      console.log('[AI Command] Result:', result);
      try {
        await logAiCommand({ command: 'generateCategoriesAI', status: 'success', result });
      } catch (logError) {
        console.error('[AI Command] Failed to log command:', logError);
      }
    } else if (inputText === 'fillCategoriesWithProducts' || inputText.includes('wypełnij katalog')) {
      console.log('[AI Command] Executing fillCategoriesWithProducts (async background job)...');
      
      // Uruchom w tle bez czekania — zwróć 202 Accepted
      (async () => {
        try {
          const categories = await getAllCategories();
          let totalProductsAdded = 0;
          let totalProductsUpdated = 0;
          let preferredCurrency = 'USD';
          
          // Pobierz preferencję waluty
          try {
            const { adminDb } = await import('@/lib/firebase-admin');
            const currencyDoc = await adminDb.collection('config').doc('currencyPreference').get();
            if (currencyDoc.exists) {
              preferredCurrency = currencyDoc.data()?.currency || 'USD';
            }
          } catch (e) {
            console.warn('[fillCategoriesWithProducts Background] Failed to load currency', e);
          }

          console.log(`[fillCategoriesWithProducts Background] Processing ${categories.length} categories...`);

          // Iteruj po wszystkich pod-podkategoriach
          for (const cat of categories) {
            const subcategories = await getSubcategories(cat.id);
            for (const sub of subcategories) {
              const subsubcategories = await getSubSubcategories(cat.id, sub.id);
              
              if (subsubcategories.length > 0) {
                for (const subsub of subsubcategories) {
                  try {
                    console.log(`[fillCategoriesWithProducts Background] Processing: ${cat.name}/${sub.name}/${subsub.name}`);
                    const res = await fillSubSubcategoryProducts({
                      categoryId: cat.id,
                      categoryName: cat.name,
                      categorySlug: cat.slug,
                      subcategoryId: sub.id,
                      subcategoryName: sub.name,
                      subcategorySlug: sub.slug,
                      subsubcategoryId: subsub.id,
                      subsubcategoryName: subsub.name,
                      subsubcategorySlug: subsub.slug,
                      preferredCurrency,
                      maxProducts: 20,
                    });
                    totalProductsAdded += res.productsAdded;
                    totalProductsUpdated += res.productsUpdated;
                  } catch (e: any) {
                    console.error(`[fillCategoriesWithProducts Background] Error processing ${cat.name}/${sub.name}/${subsub.name}:`, e.message);
                    // Continue to next even if one fails
                  }
                  // Sleep between subcategories to avoid rate limiting
                  await new Promise(resolve => setTimeout(resolve, 2000));
                }
              } else {
                // Jeśli brak pod-podkategorii, przetwórz bezpośrednio subcategorię
                try {
                  console.log(`[fillCategoriesWithProducts Background] No sub-subcategories, processing: ${cat.name}/${sub.name}`);
                  const subsub = { id: sub.id, name: sub.name, slug: sub.slug };
                  const res = await fillSubSubcategoryProducts({
                    categoryId: cat.id,
                    categoryName: cat.name,
                    categorySlug: cat.slug,
                    subcategoryId: sub.id,
                    subcategoryName: sub.name,
                    subcategorySlug: sub.slug,
                    subsubcategoryId: subsub.id,
                    subsubcategoryName: subsub.name,
                    subsubcategorySlug: subsub.slug,
                    preferredCurrency,
                    maxProducts: 20,
                  });
                  totalProductsAdded += res.productsAdded;
                  totalProductsUpdated += res.productsUpdated;
                } catch (e: any) {
                  console.error(`[fillCategoriesWithProducts Background] Error processing ${cat.name}/${sub.name}:`, e.message);
                }
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
            }
          }

          const finalResult = `✅ Background job completed: ${totalProductsAdded} products added, ${totalProductsUpdated} updated`;
          console.log(`[fillCategoriesWithProducts Background] ${finalResult}`);
          
          try {
            await logAiCommand({
              command: 'fillCategoriesWithProducts',
              status: 'success',
              result: finalResult,
            });
          } catch (logError) {
            console.error('[fillCategoriesWithProducts Background] Failed to log command:', logError);
          }
        } catch (e: any) {
          console.error('[fillCategoriesWithProducts Background] Fatal error:', e.message);
          try {
            await logAiCommand({
              command: 'fillCategoriesWithProducts',
              status: 'error',
              result: `Background job error: ${e.message}`,
            });
          } catch (logError) {
            console.error('[fillCategoriesWithProducts Background] Failed to log error:', logError);
          }
        }
      })(); // IIFE - run in background

      result = '⏳ Wypełnianie katalog zaraz się zacznie w tle. Sprawdź status w historii.';
      return NextResponse.json({ result, success: true, jobStatus: 'pending' }, { status: 202 });
    } else if (inputText === 'fillCategoriesWithDeals' || inputText.includes('pobierz deale')) {
      console.log('[AI Command] Executing fillCategoriesWithDeals...');
      result = await fillCategoriesWithDeals();
      console.log('[AI Command] Result:', result);
      
      // Zaloguj do historii
      try {
        await logAiCommand({
          command: 'fillCategoriesWithDeals',
          status: 'success',
          result,
        });
      } catch (logError) {
        console.error('[AI Command] Failed to log command:', logError);
      }
    } else {
      result = `Nieznane polecenie: "${inputText}". Dostępne: createCategoryStructure, generateCategoriesAI, fillCategoriesWithProducts, fillCategoriesWithDeals`;
      return NextResponse.json({ result, message: result }, { status: 400 });
    }
    
    return NextResponse.json({ result, message: result, success: true });
  } catch (error: any) {
    console.error('[AI Command] Error:', error);
    
    const errorMessage = error?.message || 'Nieznany błąd';
    const errorStack = error?.stack || '';
    
    // Zaloguj błąd
    try {
      await logAiCommand({
        command: 'error',
        status: 'error',
        result: `${errorMessage}\n\nStack: ${errorStack}`,
      });
    } catch (logError) {
      console.error('[AI Command] Failed to log error:', logError);
    }
    
    
    return NextResponse.json({ 
      error: errorMessage,
      message: `Błąd: ${errorMessage}`,
      success: false
    }, { status: 500 });
  }
}
