"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CategorySuggestionsManager } from "@/components/admin/category-suggestions-manager";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function ForumCategoriesPage() {
  const { user } = useAuth();

  useEffect(() => {
    // Sprawdź czy jest admin
    if (user && user.role !== 'admin') {
      redirect('/');
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
          Przeglądaj i zatwierdzaj propozycje kategorii od użytkowników
        </p>
      </div>

      <CategorySuggestionsManager />
    </div>
  );
}
