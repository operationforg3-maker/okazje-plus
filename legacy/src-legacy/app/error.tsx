"use client";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // Można wysłać do analytics
    console.error("GlobalError boundary:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full space-y-4 text-center">
        <h1 className="text-2xl font-headline font-bold">Coś poszło nie tak</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Wystąpił błąd aplikacji. Spróbuj odświeżyć stronę albo wrócić później. Jeśli problem się powtarza – zgłoś go administratorowi.
        </p>
        <button
          onClick={() => reset()}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >Spróbuj ponownie</button>
      </div>
    </div>
  );
}
