// @ts-nocheck
"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { useCollection } from "react-firebase-hooks/firestore";
import { collection, doc, setDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { withAuth } from '@/components/auth/withAuth';
import { Category, Subcategory } from "@/lib/types";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Loader2, Trash2, Sparkles } from "lucide-react";

// --- Form types ---
type MainCategoryInputs = {
  nameEn: string;
  namePl: string;
  nameDe?: string;
  slug: string;
};

type SubcategoryInputs = {
  nameEn: string;
  namePl: string;
  nameDe?: string;
  slug: string;
};

type SubSubcategoryInputs = {
  parentSlug: string;
  nameEn: string;
  namePl: string;
  nameDe?: string;
  slug: string;
};

// --- Helper function to generate slug ---
const generateSlug = (name: string) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // remove non-word chars
    .replace(/[\s_-]+/g, "-") // collapse whitespace and replace by -
    .replace(/^-+|-+$/g, ""); // remove leading/trailing dashes
};

function AdminCategoriesPage() {
  const { user, loading: authLoading } = useAuth();
  const [categoriesData, loadingCategories, errorCategories] = useCollection(collection(db, "categories"));

  // Calculate allCategories early so it can be used in handlers
  const allCategories = useMemo(() => 
    categoriesData?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)) || [],
    [categoriesData]
  );

  const [isSubmittingMain, setIsSubmittingMain] = useState(false);
  const [isSubmittingSub, setIsSubmittingSub] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isFilling, setIsFilling] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const {
    register: registerMain,
    handleSubmit: handleSubmitMain,
    reset: resetMain,
    watch: watchMainName,
    setValue: setMainValue,
  } = useForm<MainCategoryInputs>();

  const {
    register: registerSub,
    handleSubmit: handleSubmitSub,
    reset: resetSub,
    watch: watchSubName,
    setValue: setSubValue,
  } = useForm<SubcategoryInputs>();

  const {
    register: registerSubSub,
    handleSubmit: handleSubmitSubSub,
    reset: resetSubSub,
    watch: watchSubSubName,
    setValue: setSubSubValue,
  } = useForm<SubSubcategoryInputs>();

  // Auto-generate slug for main category (English as primary)
  const mainName = watchMainName("nameEn");
  useEffect(() => {
    if (mainName) {
      setMainValue("slug", generateSlug(mainName));
    }
  }, [mainName, setMainValue]);

  // Auto-generate slug for subcategory (English as primary)
  const subName = watchSubName("nameEn");
  useEffect(() => {
    if (subName) {
      setSubValue("slug", generateSlug(subName));
    }
  }, [subName, setSubValue]);

  // Auto-generate slug for sub-subcategory
  const subSubName = watchSubSubName("nameEn");
  useEffect(() => {
    if (subSubName) {
      setSubSubValue("slug", generateSlug(subSubName));
    }
  }, [subSubName, setSubSubValue]);


  const onAddMainCategory: SubmitHandler<MainCategoryInputs> = async (data) => {
    setIsSubmittingMain(true);
    try {
      const categoryRef = doc(db, "categories", data.slug);
      const nameEn = data.nameEn?.trim() || data.namePl?.trim();
      const namePl = data.namePl?.trim() || data.nameEn?.trim();
      const nameDe = data.nameDe?.trim() || nameEn || namePl; // ensure DE present for interface consistency

      const newCategory: Omit<Category, 'id'> = {
        name: nameEn || namePl,
        slug: data.slug,
        translations: {
          en: { name: nameEn || '' },
          pl: { name: namePl || '' },
          de: { name: nameDe || '' },
        },
        subcategories: [],
      };
      await setDoc(categoryRef, newCategory);
      toast.success(`Kategoria "${nameEn || namePl}" została dodana.`);
      resetMain();
    } catch (error) {
      console.error("Błąd dodawania kategorii:", error);
      toast.error("Wystąpił błąd. Sprawdź, czy kategoria o tym slugu już nie istnieje.");
    } finally {
      setIsSubmittingMain(false);
    }
  };

  const onAddSubcategory: SubmitHandler<SubcategoryInputs> = async (data) => {
    if (!editingCategory) return;
    setIsSubmittingSub(true);
    try {
      const categoryRef = doc(db, "categories", editingCategory.id);
      const nameEn = data.nameEn?.trim() || data.namePl?.trim();
      const namePl = data.namePl?.trim() || data.nameEn?.trim();
      const nameDe = data.nameDe?.trim() || nameEn || namePl; // ensure DE present

      const newSubcategory: Subcategory = {
        name: nameEn || namePl,
        slug: data.slug,
        translations: {
          en: { name: nameEn || '' },
          pl: { name: namePl || '' },
          de: { name: nameDe || '' },
        },
        subcategories: [],
      };
      
      await updateDoc(categoryRef, {
        subcategories: arrayUnion(newSubcategory),
      });
      
      toast.success(`Podkategoria "${nameEn || namePl}" została dodana.`);
      resetSub();
    } catch (error) {
      console.error("Błąd dodawania podkategorii:", error);
      toast.error("Wystąpił błąd. Spróbuj ponownie.");
    } finally {
      setIsSubmittingSub(false);
    }
  };

  const onAddSubSubcategory: SubmitHandler<SubSubcategoryInputs> = async (data) => {
    if (!editingCategory) return;
    setIsSubmittingSub(true);
    try {
      const categoryRef = doc(db, "categories", editingCategory.id);
      const latestCat = allCategories?.find(c => c.id === editingCategory.id);
      if (!latestCat) throw new Error('Brak kategorii');

      const nameEn = data.nameEn?.trim() || data.namePl?.trim();
      const namePl = data.namePl?.trim() || data.nameEn?.trim();
      const nameDe = data.nameDe?.trim() || nameEn || namePl; // ensure DE present

      const updatedSubs = (latestCat.subcategories || []).map(sub => {
        if (sub.slug !== data.parentSlug) return sub;
        const existing = Array.isArray(sub.subcategories) ? sub.subcategories : [];
        const newSubSub = {
          name: nameEn || namePl,
          slug: data.slug,
          translations: {
            en: { name: nameEn || '' },
            pl: { name: namePl || '' },
            de: { name: nameDe || '' },
          },
        };
        return { ...sub, subcategories: [...existing, newSubSub] };
      });
      await updateDoc(categoryRef, { subcategories: updatedSubs });
      toast.success(`Pod-podkategoria "${nameEn || namePl}" została dodana.`);
      resetSubSub();
    } catch (error) {
      console.error("Błąd dodawania pod-podkategori:", error);
      toast.error("Wystąpił błąd. Spróbuj ponownie.");
    } finally {
      setIsSubmittingSub(false);
    }
  };

  const onDeleteSubSubcategory = async (parentSlug: string, subSubSlug: string) => {
    if (!editingCategory) return;
    if (!confirm('Czy na pewno chcesz usunąć tę pod-podkategorię?')) return;
    try {
      const categoryRef = doc(db, "categories", editingCategory.id);
      const latestCat = allCategories?.find(c => c.id === editingCategory.id);
      if (!latestCat) throw new Error('Brak kategorii');
      const updatedSubs = (latestCat.subcategories || []).map(sub => {
        if (sub.slug !== parentSlug) return sub;
        const cleaned = (sub.subcategories || []).filter(s => s.slug !== subSubSlug);
        return { ...sub, subcategories: cleaned };
      });
      await updateDoc(categoryRef, { subcategories: updatedSubs });
      toast.success('Pod-podkategoria została usunięta.');
    } catch (error) {
      console.error("Błąd usuwania pod-podkategorii:", error);
      toast.error('Wystąpił błąd podczas usuwania.');
    }
  };

  const onDeleteSubcategory = async (subcategoryToRemove: Subcategory) => {
      if (!editingCategory) return;
      if (!confirm(`Czy na pewno chcesz usunąć podkategorię "${subcategoryToRemove.name}"?`)) return;

      try {
        const categoryRef = doc(db, "categories", editingCategory.id);
        
        // Atomically remove the subcategory from the "subcategories" array field.
        await updateDoc(categoryRef, {
            subcategories: arrayRemove(subcategoryToRemove)
        });

        toast.success(`Podkategoria "${subcategoryToRemove.name}" została usunięta.`);
      } catch (error) {
          console.error("Błąd usuwania podkategorii:", error);
          toast.error("Wystąpił błąd podczas usuwania.");
      }
  };

  const onGenerateAIContext = async (
    categoryId: string,
    mainCategoryName: string,
    subcategoryName: string,
    subsubcategoryName: string,
    subcategorySlug: string,
    subsubcategorySlug: string
  ) => {
    setIsGeneratingAI(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/admin/categories/generate-context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          categoryId,
          subcategoryId: subcategorySlug,
          subsubcategoryId: subsubcategorySlug,
          mainCategoryName,
          subcategoryName,
          subsubcategoryName,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('✨ Kontekst kategorii został wygenerowany i zapisany!');
      } else {
        toast.error('Błąd: ' + (data.error || 'Nieznany błąd'));
      }
    } catch (error) {
      console.error("Błąd generowania kontekstu AI:", error);
      toast.error('Błąd przy generowaniu kontekstu.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const onFillAllCategories = async () => {
    if (!confirm('🤖 Auto-Fillier wypełni WSZYSTKIE kategorie produktami z AliExpress. To może zająć kilka minut. Kontynuować?')) {
      return;
    }

    setIsFilling(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/admin/ai/fill-categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          maxProductsPerCategory: 20,
        }),
      });

      if (!response.ok) {
        throw new Error('Fill failed');
      }

      const result = await response.json();
      toast.success('✅ Kategorie zostały wypełnione produktami!');
      console.log('Fill result:', result);
    } catch (error) {
      console.error('Fill error:', error);
      toast.error('❌ Błąd podczas wypełniania kategorii');
    } finally {
      setIsFilling(false);
    }
  };

  if (authLoading || loadingCategories) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  // Get current subcategories for the dialog to ensure UI updates instantly after deletion
  const currentSubcategories = allCategories?.find(c => c.id === editingCategory?.id)?.subcategories || [];

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Zarządzanie Kategoriami</h1>
        <Button 
          onClick={onFillAllCategories} 
          disabled={isFilling}
          size="lg"
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
        >
          {isFilling ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Wypełniam kategorie...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-5 w-5" />
              🤖 Auto-Fillier: Wypełnij wszystkie kategorie
            </>
          )}
        </Button>
      </div>

      <Card className="border-purple-200 bg-purple-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Automatyczny Fillier
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>Auto-Fillier</strong> automatycznie wypełnia wszystkie kategorie produktami z AliExpress używając AI:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Pobiera produkty dla każdej kategorii/podkategorii</li>
            <li>Wzbogaca opisy używając AI (3 agenty: Quality Score, Copywriter, Librarian)</li>
            <li>Automatycznie kategoryzuje produkty</li>
            <li>Dodaje ~20 produktów na kategorię (draft status)</li>
          </ul>
          <p className="text-xs mt-2">
            ⏱️ Proces może zająć 5-10 minut. Wyniki pojawią się w panelu moderacji produktów.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Dodaj nową kategorię główną</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmitMain(onAddMainCategory)} className="space-y-4">
            <div>
              <Label htmlFor="main-name-en">Nazwa kategorii (EN)</Label>
              <Input id="main-name-en" {...registerMain("nameEn", { required: true })} placeholder="Electronics"/>
            </div>
            <div>
              <Label htmlFor="main-name-pl">Nazwa kategorii (PL)</Label>
              <Input id="main-name-pl" {...registerMain("namePl", { required: true })} placeholder="Elektronika"/>
            </div>
            <div>
              <Label htmlFor="main-name-de">Nazwa kategorii (DE, opcjonalnie)</Label>
              <Input id="main-name-de" {...registerMain("nameDe") } placeholder="Elektronik"/>
            </div>
            <div>
              <Label htmlFor="main-slug">Slug (wygenerowany automatycznie)</Label>
              <Input id="main-slug" {...registerMain("slug", { required: true })} readOnly className="bg-muted"/>
            </div>
            <Button type="submit" disabled={isSubmittingMain}>
              {isSubmittingMain && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Dodaj Kategorię
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Istniejące kategorie</CardTitle></CardHeader>
        <CardContent>
          {errorCategories && <p className="text-destructive">Błąd ładowania kategorii.</p>}
          <ul className="space-y-2">
            {allCategories && allCategories.length > 0 ? (
              allCategories.map((cat) => (
                <li key={cat.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <span className="font-semibold">{cat.name}</span>
                    <span className="text-sm text-muted-foreground ml-3">({cat.subcategories?.length || 0} podkategorii)</span>
                  </div>
                  
                  <Dialog onOpenChange={(open) => {if (!open) setEditingCategory(null)}}>
                     <DialogTrigger asChild>
                        <Button variant="outline" onClick={() => setEditingCategory(cat)}>
                            Zarządzaj podkategoriami
                        </Button>
                     </DialogTrigger>
                     <DialogContent className="sm:max-w-[625px]">
                        {editingCategory && editingCategory.id === cat.id && (
                            <>
                                <DialogHeader>
                                    <DialogTitle>Zarządzaj podkategoriami dla: <span className="font-bold text-primary">{editingCategory.name}</span></DialogTitle>
                                </DialogHeader>

                                <div className="mt-4">
                                    <h3 className="font-semibold mb-2">Istniejące podkategorie:</h3>
                                    {currentSubcategories.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">Brak podkategorii.</p>
                                    ) : (
                                        <ul className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                            {currentSubcategories.map((sub, index) => (
                                              <li key={index} className="p-2 border rounded-md bg-secondary/50 space-y-2">
                                                <div className="flex items-center justify-between">
                                                  <span>{sub.name} <span className="text-xs text-muted-foreground">({sub.slug})</span></span>
                                                  <Button variant="ghost" size="icon" onClick={() => onDeleteSubcategory(sub)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                  </Button>
                                                </div>
                                                {Array.isArray(sub.subcategories) && sub.subcategories.length > 0 && (
                                                  <div className="pl-2 border-l space-y-1">
                                                    {sub.subcategories.map((subsub) => (
                                                      <div key={subsub.slug} className="flex items-center justify-between text-sm bg-background px-2 py-1 rounded">
                                                        <span>{subsub.name} <span className="text-xs text-muted-foreground">({subsub.slug})</span></span>
                                                        <div className="flex gap-1">
                                                          <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            disabled={isGeneratingAI}
                                                            onClick={() =>
                                                              onGenerateAIContext(
                                                                editingCategory!.id,
                                                                editingCategory!.name,
                                                                sub.name,
                                                                subsub.name,
                                                                sub.slug,
                                                                subsub.slug
                                                              )
                                                            }
                                                            title="Wygeneruj opis i słowa kluczowe AI"
                                                          >
                                                            <Sparkles className="h-4 w-4 text-yellow-500" />
                                                          </Button>
                                                          <Button variant="ghost" size="icon" onClick={() => onDeleteSubSubcategory(sub.slug, subsub.slug)}>
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                          </Button>
                                                        </div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                              </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                <div className="mt-6 border-t pt-6">
                                    <h3 className="font-semibold mb-2">Dodaj nową podkategorię</h3>
                                    <form onSubmit={handleSubmitSub(onAddSubcategory)} className="space-y-4">
                                        <div>
                                            <Label htmlFor="sub-name-en">Nazwa podkategorii (EN)</Label>
                                            <Input id="sub-name-en" {...registerSub("nameEn", { required: true })} placeholder="Smartphones"/>
                                        </div>
                                        <div>
                                            <Label htmlFor="sub-name-pl">Nazwa podkategorii (PL)</Label>
                                            <Input id="sub-name-pl" {...registerSub("namePl", { required: true })} placeholder="Smartfony"/>
                                        </div>
                                        <div>
                                            <Label htmlFor="sub-name-de">Nazwa podkategorii (DE, opcjonalnie)</Label>
                                            <Input id="sub-name-de" {...registerSub("nameDe") } placeholder="Smartphones"/>
                                        </div>
                                        <div>
                                            <Label htmlFor="sub-slug">Slug (wygenerowany automatycznie)</Label>
                                            <Input id="sub-slug" {...registerSub("slug", { required: true })} readOnly className="bg-muted" />
                                        </div>
                                        <Button type="submit" disabled={isSubmittingSub}>
                                            {isSubmittingSub && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Dodaj Podkategorię
                                        </Button>
                                    </form>
                                </div>

                                <div className="mt-6 border-t pt-6">
                                  <h3 className="font-semibold mb-2">Dodaj pod-podkategorię (3 poziom)</h3>
                                  <form onSubmit={handleSubmitSubSub(onAddSubSubcategory)} className="space-y-4">
                                    <div>
                                      <Label htmlFor="subsub-parent">Wybierz podkategorię</Label>
                                      <select id="subsub-parent" className="w-full border rounded px-3 py-2"
                                        {...registerSubSub("parentSlug", { required: true })}
                                      >
                                        <option value="">-- wybierz --</option>
                                        {currentSubcategories.map(sub => (
                                          <option key={sub.slug} value={sub.slug}>{sub.name} ({sub.slug})</option>
                                        ))}
                                      </select>
                                    </div>
                                    <div>
                                      <Label htmlFor="subsub-name-en">Nazwa (EN)</Label>
                                      <Input id="subsub-name-en" {...registerSubSub("nameEn", { required: true })} placeholder="Phones" />
                                    </div>
                                    <div>
                                      <Label htmlFor="subsub-name-pl">Nazwa (PL)</Label>
                                      <Input id="subsub-name-pl" {...registerSubSub("namePl", { required: true })} placeholder="Telefony" />
                                    </div>
                                    <div>
                                      <Label htmlFor="subsub-name-de">Nazwa (DE, opcjonalnie)</Label>
                                      <Input id="subsub-name-de" {...registerSubSub("nameDe") } placeholder="Telefone" />
                                    </div>
                                    <div>
                                      <Label htmlFor="subsub-slug">Slug (wygenerowany automatycznie)</Label>
                                      <Input id="subsub-slug" {...registerSubSub("slug", { required: true })} readOnly className="bg-muted" />
                                    </div>
                                    <Button type="submit" disabled={isSubmittingSub}>
                                      {isSubmittingSub && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                      Dodaj pod-podkategorię
                                    </Button>
                                  </form>
                                </div>
                                
                                <DialogFooter className="mt-4">
                                  <DialogClose asChild>
                                    <Button type="button" variant="secondary">Zamknij</Button>
                                  </DialogClose>
                                </DialogFooter>
                            </>
                        )}
                     </DialogContent>
                  </Dialog>

                </li>
              ))
            ) : (
              <p>Brak zdefiniowanych kategorii.</p>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

export default withAuth(AdminCategoriesPage, { requiredRole: 'admin' });
