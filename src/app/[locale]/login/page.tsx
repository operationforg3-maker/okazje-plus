import { ShoppingBag } from "lucide-react";
import LoginForm from "@/components/auth/login-form";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="container relative flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center py-12">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]">
        <div className="flex flex-col space-y-2 text-center">
            <Link href="/" className="flex items-center justify-center gap-2 mb-4">
              <ShoppingBag className="h-8 w-8 text-primary" />
              <span className="font-bold font-headline text-2xl">Okazje+</span>
            </Link>
          <h1 className="text-2xl font-semibold tracking-tight font-headline">
            Witaj z powrotem
          </h1>
          <p className="text-sm text-muted-foreground">
            Zaloguj się lub utwórz konto, aby odkrywać najlepsze okazje.
          </p>
        </div>
        <LoginForm />
        <p className="px-8 text-center text-sm text-muted-foreground">
          Klikając Kontynuuj, zgadzasz się z naszym{' '}
          <Link
            href="/terms"
            className="underline underline-offset-4 hover:text-primary"
          >
            Regulaminem
          </Link>{' '}
          i{' '}
          <Link
            href="/privacy"
            className="underline underline-offset-4 hover:text-primary"
          >
            Polityką Prywatności
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
