'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Trash2, CheckCircle, AlertCircle, Loader2, ListTree, Sparkles } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import type { Category, Subcategory, SubSubcategory } from '@/lib/types';

interface CategoryBuilderProps {
  onCategoriesCreated?: (categories: Category[]) => void;
  onConsoleLog?: (message: string, type: 'info' | 'success' | 'error' | 'warning') => void;
  user?: any;
  getIdToken?: () => Promise<string | null>;
}

interface CategoryForm {
  mainCategory: {
    name: string;
    slug: string;
    description: string;
    icon: string;
  };
  subCategories: Array<{
    name: string;
    slug: string;
    description: string;
    subSubCategories: Array<{
      name: string;
      slug: string;
      description: string;
    }>;
  }>;
}

export function CategoryBuilder({ onCategoriesCreated, onConsoleLog, user: userProp, getIdToken: getIdTokenProp }: CategoryBuilderProps) {
  const user = userProp || null;
  const getIdTokenFn = getIdTokenProp || (async () => null);

  const [loading, setLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [form, setForm] = useState<CategoryForm>({
    mainCategory: {
      name: 'Elektronika',
      slug: 'elektronika',
      description: 'Elektronika i urządzenia techniczne',
      icon: '⚡',
    },
    subCategories: [
      {
        name: 'Smartfony',
        slug: 'smartfony',
        description: 'Telefony komórkowe i akcesoria',
        subSubCategories: [
          { name: 'iPhone', slug: 'iphone', description: 'Telefony Apple' },
          { name: 'Samsung', slug: 'samsung', description: 'Telefony Samsung' },
        ],
      },
    ],
  });

  const log = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const timestamp = new Date().toLocaleTimeString('pl-PL');
    const logMessage = `[${timestamp}] ${message}`;
    console.log(`[${type.toUpperCase()}] ${logMessage}`);
    onConsoleLog?.(logMessage, type);
  };

  const handleAutoBuild = async () => {
    setAutoLoading(true);
    try {
      log('🤖 Uruchamiam automatyczne budowanie pełnego drzewa kategorii...', 'info');
      
      if (!user) {
        throw new Error('Brak uwierzytelnienia użytkownika');
      }

      if (!getIdTokenProp) {
        log('⚠️ Ostrzeżenie: getIdToken nie został przesłany jako prop', 'warning');
      }

      const token = await getIdTokenFn();
      if (!token) {
        throw new Error('Nie udało się pobrać tokenu autoryzacji (getIdToken zwrócił null)');
      }

      const res = await fetch('/api/admin/categories/auto-build', { 
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }
      const body = await res.json();
      const createdDocs = body.created || 0;
      const rootCount = body.categories || 0;
      log(`✅ Zakończono auto-build. Zapisano ${createdDocs} dokumentów (${rootCount} kategorii głównych).`, 'success');

      // Poinformuj wyżej z poprawną licznością, nawet jeśli nie ściągamy pełnych danych (używane do logów)
      const stubCategories = Array.from({ length: rootCount }, (_, idx) => ({
        id: `auto-${idx}`,
        slug: `auto-${idx}`,
        name: `Kategoria ${idx + 1}`,
        subcategories: [],
      })) as unknown as Category[];
      onCategoriesCreated?.(stubCategories);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nieznany błąd';
      log(`❌ Auto-build kategorii nie powiódł się: ${message}`, 'error');
    } finally {
      setAutoLoading(false);
    }
  };

  const handleAddSubcategory = () => {
    setForm(prev => ({
      ...prev,
      subCategories: [
        ...prev.subCategories,
        {
          name: '',
          slug: '',
          description: '',
          subSubCategories: [{ name: '', slug: '', description: '' }],
        },
      ],
    }));
  };

  const handleAddSubSubcategory = (subCatIndex: number) => {
    setForm(prev => {
      const newForm = { ...prev };
      newForm.subCategories[subCatIndex].subSubCategories.push({
        name: '',
        slug: '',
        description: '',
      });
      return newForm;
    });
  };

  const handleRemoveSubcategory = (index: number) => {
    setForm(prev => ({
      ...prev,
      subCategories: prev.subCategories.filter((_, i) => i !== index),
    }));
  };

  const handleRemoveSubSubcategory = (subCatIndex: number, subSubCatIndex: number) => {
    setForm(prev => {
      const newForm = { ...prev };
      newForm.subCategories[subCatIndex].subSubCategories = newForm.subCategories[
        subCatIndex
      ].subSubCategories.filter((_, i) => i !== subSubCatIndex);
      return newForm;
    });
  };

  const handleCreateCategories = async () => {
    setLoading(true);
    try {
      log('🏗️ Rozpoczynam tworzenie struktury kategorii...', 'info');

      if (!user) {
        throw new Error('Brak uwierzytelnienia użytkownika');
      }

      const categories: Category[] = [
        {
          id: form.mainCategory.slug,
          slug: form.mainCategory.slug,
          name: form.mainCategory.name,
          description: form.mainCategory.description,
          icon: form.mainCategory.icon,
          subcategories: form.subCategories.map(sub => ({
            slug: sub.slug,
            name: sub.name,
            description: sub.description,
            subcategories: sub.subSubCategories.map(subsub => ({
              slug: subsub.slug,
              name: subsub.name,
              description: subsub.description,
            })),
          })),
        },
      ];

      log(`✓ Struktura przygotowana: 1 kategoria główna`, 'success');
      log(
        `  └─ ${form.subCategories.length} podkategorie (razem ${form.subCategories.reduce((acc, s) => acc + s.subSubCategories.length, 0)} pod-podkategorii)`,
        'info'
      );

      // TODO: Save to Firestore
      log('💾 Wysyłam dane do bazy...', 'info');

      if (!getIdTokenProp) {
        log('⚠️ Ostrzeżenie: getIdToken nie został przesłany jako prop', 'warning');
      }

      const token = await getIdTokenFn();
      if (!token) {
        throw new Error('Nie udało się pobrać tokenu autoryzacji (getIdToken zwrócił null)');
      }

      const response = await fetch('/api/admin/categories/create', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ categories }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      log(`✅ Kategorie utworzone pomyślnie! (${result.count} dokumentów)`, 'success');
      onCategoriesCreated?.(categories);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nieznany błąd';
      log(`❌ Błąd: ${message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="card-base">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListTree className="h-5 w-5" />
          Konstruktor Kategorii
        </CardTitle>
        <CardDescription>Tworzenie struktury kategorii, podkategorii i pod-podkategorii</CardDescription>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleAutoBuild}
            disabled={autoLoading}
            className="gap-2"
          >
            {autoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Auto: pełne drzewo (import ready)
          </Button>
          <Alert className="py-2 px-3 border-dashed">
            <AlertDescription className="text-xs">
              Użyj automatu aby wgrać kompletną 3‑poziomową taksonomię zgodną z importami (AliExpress/Convertiser/Deals&Products).
            </AlertDescription>
          </Alert>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Category */}
        <div className="space-y-3 p-4 bg-muted/20 rounded-lg border border-border/40">
          <h3 className="font-semibold">Kategoria główna</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nazwa</Label>
              <Input
                value={form.mainCategory.name}
                onChange={e => setForm(prev => ({
                  ...prev,
                  mainCategory: { ...prev.mainCategory, name: e.target.value },
                }))}
                placeholder="np. Elektronika"
              />
            </div>
            <div>
              <Label className="text-xs">Slug</Label>
              <Input
                value={form.mainCategory.slug}
                onChange={e => setForm(prev => ({
                  ...prev,
                  mainCategory: { ...prev.mainCategory, slug: e.target.value },
                }))}
                placeholder="elektronika"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Opis</Label>
              <Textarea
                value={form.mainCategory.description}
                onChange={e => setForm(prev => ({
                  ...prev,
                  mainCategory: { ...prev.mainCategory, description: e.target.value },
                }))}
                placeholder="Opis kategorii"
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* Subcategories */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Podkategorie ({form.subCategories.length})</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddSubcategory}
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              Dodaj
            </Button>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {form.subCategories.map((subCat, subIdx) => (
              <div
                key={subIdx}
                className="p-3 bg-muted/10 rounded-lg border border-border/30 space-y-2"
              >
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="secondary" className="text-xs">
                    Podkategoria {subIdx + 1}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveSubcategory(subIdx)}
                    className="h-7 w-7 p-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={subCat.name}
                    onChange={e => {
                      setForm(prev => {
                        const newForm = { ...prev };
                        newForm.subCategories[subIdx].name = e.target.value;
                        return newForm;
                      });
                    }}
                    placeholder="Nazwa"
                    size={28}
                  />
                  <Input
                    value={subCat.slug}
                    onChange={e => {
                      setForm(prev => {
                        const newForm = { ...prev };
                        newForm.subCategories[subIdx].slug = e.target.value;
                        return newForm;
                      });
                    }}
                    placeholder="Slug"
                    size={28}
                  />
                </div>

                {/* Sub-subcategories */}
                <div className="mt-3 pt-2 border-t border-border/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Pod-podkategorie ({subCat.subSubCategories.length})
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleAddSubSubcategory(subIdx)}
                      className="h-6 px-2 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Dodaj
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {subCat.subSubCategories.map((subSubCat, subSubIdx) => (
                      <div
                        key={subSubIdx}
                        className="flex items-center gap-2 bg-background/50 p-2 rounded border border-border/20"
                      >
                        <Input
                          value={subSubCat.name}
                          onChange={e => {
                            setForm(prev => {
                              const newForm = { ...prev };
                              newForm.subCategories[subIdx].subSubCategories[subSubIdx].name =
                                e.target.value;
                              return newForm;
                            });
                          }}
                          placeholder="Nazwa"
                          className="text-xs h-8"
                        />
                        <Input
                          value={subSubCat.slug}
                          onChange={e => {
                            setForm(prev => {
                              const newForm = { ...prev };
                              newForm.subCategories[subIdx].subSubCategories[subSubIdx].slug =
                                e.target.value;
                              return newForm;
                            });
                          }}
                          placeholder="Slug"
                          className="text-xs h-8 flex-1"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveSubSubcategory(subIdx, subSubIdx)}
                          className="h-7 w-7 p-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action */}
        <Button
          onClick={handleCreateCategories}
          disabled={loading}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Tworzę kategorie...
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              Utwórz strukturę kategorii
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
