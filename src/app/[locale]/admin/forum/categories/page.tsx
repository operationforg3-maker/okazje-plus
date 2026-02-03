"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CategorySuggestionsManager } from "@/components/admin/category-suggestions-manager";
import { ForumCategoryManager } from "@/components/admin/forum-category-manager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ForumCategoriesPage() {
  const { user } = useAuth();

  useEffect(() => {
    if (user && user.role !== "admin") {
      redirect("/");
    }
  }, [user]);

  if (!user) {
    return <div>Ładowanie...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Zarządzanie kategoriami forum</h1>
        <p className="text-muted-foreground">
          Twórz, edytuj kategorie oraz przeglądaj propozycje użytkowników
        </p>
      </div>

      <Tabs defaultValue="manage" className="space-y-4">
        <TabsList>
          <TabsTrigger value="manage">Zarządzanie kategoriami</TabsTrigger>
          <TabsTrigger value="suggestions">Propozycje użytkowników</TabsTrigger>
        </TabsList>

        <TabsContent value="manage">
          <ForumCategoryManager />
        </TabsContent>

        <TabsContent value="suggestions">
          <CategorySuggestionsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}