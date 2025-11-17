"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShoppingBag, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import Link from "next/link";

export default function ActivatePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Hasło musi mieć minimum 6 znaków");
      return;
    }

    if (password !== confirmPassword) {
      setError("Hasła nie są identyczne");
      return;
    }

    setLoading(true);

    try {
      const functions = getFunctions(undefined, "europe-west1");
      const activatePreRegistration = httpsCallable(functions, "activatePreRegistration");
      
      const result = await activatePreRegistration({ token, password });
      const data = result.data as { success: boolean; message: string; uid: string };

      if (data.success) {
        setSuccess(true);
        
        // Automatyczne logowanie po aktywacji
        setTimeout(async () => {
          try {
            // Pobierz email z tokenu (parsuj JWT po stronie klienta dla UX)
            const payload = JSON.parse(atob(token.split('.')[1]));
            const auth = getAuth();
            await signInWithEmailAndPassword(auth, payload.email, password);
            router.push("/deals");
          } catch (err) {
            // Jeśli auto-login się nie uda, przekieruj do logowania
            router.push("/login");
          }
        }, 2000);
      }
    } catch (err: any) {
      console.error("Activation error:", err);
      setError(err.message || "Nie udało się aktywować konta");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-accent/5 to-background p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold mb-2">Konto aktywowane!</h1>
          <p className="text-muted-foreground mb-6">
            Witamy na pokładzie! Za chwilę zostaniesz automatycznie zalogowany...
          </p>
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-accent/5 to-background p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <ShoppingBag className="h-10 w-10 text-primary" />
            <span className="font-headline text-3xl font-bold">
              Okazje<span className="text-primary">+</span>
            </span>
          </Link>
          <h1 className="text-2xl font-bold mt-4">Aktywuj konto Beta</h1>
          <p className="text-muted-foreground mt-2">
            Ustaw hasło aby dokończyć aktywację
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <form onSubmit={handleActivate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Hasło</Label>
            <Input
              id="password"
              type="password"
              placeholder="Minimum 6 znaków"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Potwierdź hasło</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Powtórz hasło"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              disabled={loading}
            />
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Aktywacja...
              </>
            ) : (
              "Aktywuj konto"
            )}
          </Button>
        </form>

        <p className="text-xs text-center text-muted-foreground mt-6">
          Masz problem z aktywacją?{" "}
          <a href="mailto:pomoc@okazje.plus" className="text-primary hover:underline">
            Skontaktuj się z nami
          </a>
        </p>
      </Card>
    </div>
  );
}
