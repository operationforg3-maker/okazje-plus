"use client";

import { useState, useEffect } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { useCollection } from "react-firebase-hooks/firestore";
import { collection, doc, setDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuth, isAdmin } from "@/lib/auth";
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
  name: string;
  slug: string;
};

type SubcategoryInputs = {
  name: string;
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


export default function AdminCategoriesPage() {
  const { user, loading: authLoading } = useAuth();
  const [categoriesData, loadingCategories, errorCategories] = useCollection(collection(db, "categories"));

  const [isSubmittingMain, setIsSubmittingMain] = useState(false);
  const [isSubmittingSub, setIsSubmittingSub] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isFilling, setIsFilling] = useState(false);

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

  // Auto-generate slug for main category
  const mainName = watchMainName("name");
  useEffect(() => {
    if (mainName) {
      setMainValue("slug", generateSlug(mainName));
    }
  }, [mainName, setMainValue]);

  // Auto-generate slug for subcategory
  const subName = watchSubName("name");
  useEffect(() => {
    if (subName) {
      setSubValue("slug", generateSlug(subName));
    }
  }, [subName, setSubValue]);


  const onAddMainCategory: SubmitHandler<MainCategoryInputs> = async (data) => {
    setIsSubmittingMain(true);
    try {
      const categoryRef = doc(db, "categories", data.slug);
      // Create a new category with an empty subcategories array
      const newCategory: Omit<Category, 'id'> = {
        name: data.name,
        slug: data.slug,
        subcategories: [],
      };
      await setDoc(categoryRef, newCategory);
      toast.success(`Kategoria "${data.name}" została dodana.`);
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
      const newSubcategory: Subcategory = { name: data.name, slug: data.slug };
      
      // Atomically add the new subcategory to the "subcategories" array field.
      await updateDoc(categoryRef, {
        subcategories: arrayUnion(newSubcategory),
      });
      
      toast.success(`Podkategoria "${data.name}" została dodana.`);
      resetSub();
      // The hook 'useCollection' will automatically update the UI.
    } catch (error) {
      console.error("Błąd dodawania podkategorii:", error);
      toast.error("Wystąpił błąd. Spróbuj ponownie.");
    } finally {
      setIsSubmittingSub(false);
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

  if (!user || !isAdmin(user)) {
    return <div className="text-center py-10">Brak uprawnień. Ta strona jest dostępna tylko dla administratorów.</div>;
  }
  
  const allCategories = categoriesData?.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));

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
              <Label htmlFor="main-name">Nazwa kategorii</Label>
              <Input id="main-name" {...registerMain("name", { required: true })} placeholder="np. Elektronika"/>
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
                    <span className="text-sm text-muted-foreground ml-3">({cat.subcategories.length} podkategorii)</span>
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
                                                <li key={index} className="flex items-center justify-between p-2 border rounded-md bg-secondary/50">
                                                    <span>{sub.name} <span className="text-xs text-muted-foreground">({sub.slug})</span></span>
                                                    <Button variant="ghost" size="icon" onClick={() => onDeleteSubcategory(sub)}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                <div className="mt-6 border-t pt-6">
                                    <h3 className="font-semibold mb-2">Dodaj nową podkategorię</h3>
                                    <form onSubmit={handleSubmitSub(onAddSubcategory)} className="space-y-4">
                                        <div>
                                            <Label htmlFor="sub-name">Nazwa podkategorii</Label>
                                            <Input id="sub-name" {...registerSub("name", { required: true })} placeholder="np. Smartfony"/>
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
