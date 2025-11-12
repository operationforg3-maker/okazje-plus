import Link from 'next/link';
import { ShoppingBag, Twitter, Facebook, Instagram } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t bg-card">
      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <ShoppingBag className="h-7 w-7 text-primary" />
              <span className="font-bold font-headline text-xl">Okazje+</span>
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              Twoje zaufane źródło najlepszych okazji zakupowych w internecie.
            </p>
          </div>

          <div>
            <h3 className="font-headline font-semibold">Nawigacja</h3>
            <div className="mt-4 flex flex-col space-y-2">
              <Link href="/deals" className="text-sm text-muted-foreground hover:text-primary transition-colors">Gorące okazje</Link>
              <Link href="/products" className="text-sm text-muted-foreground hover:text-primary transition-colors">Produkty</Link>
              <Link href="/login" className="text-sm text-muted-foreground hover:text-primary transition-colors">Logowanie / Rejestracja</Link>
              <Link href="/admin" className="text-sm text-muted-foreground hover:text-primary transition-colors">Panel Admina</Link>
            </div>
          </div>

          <div>
            <h3 className="font-headline font-semibold">Informacje</h3>
            <div className="mt-4 flex flex-col space-y-2">
              <Link href="/#o-projekcie" className="text-sm text-muted-foreground hover:text-primary transition-colors">O nas</Link>
              <Link href="mailto:kontakt@okazje-plus.pl" className="text-sm text-muted-foreground hover:text-primary transition-colors">Kontakt</Link>
              <Link href="/polityka-prywatnosci" className="text-sm text-muted-foreground hover:text-primary transition-colors">Polityka prywatności</Link>
              <Link href="/regulamin" className="text-sm text-muted-foreground hover:text-primary transition-colors">Regulamin</Link>
            </div>
          </div>
          
          <div>
            <h3 className="font-headline font-semibold">Social Media</h3>
            <div className="mt-4 flex space-x-4">
                <Link href="#" className="text-muted-foreground hover:text-primary transition-colors">
                    <Twitter className="h-6 w-6" />
                    <span className="sr-only">Twitter</span>
                </Link>
                <Link href="#" className="text-muted-foreground hover:text-primary transition-colors">
                    <Facebook className="h-6 w-6" />
                    <span className="sr-only">Facebook</span>
                </Link>
                <Link href="#" className="text-muted-foreground hover:text-primary transition-colors">
                    <Instagram className="h-6 w-6" />
                    <span className="sr-only">Instagram</span>
                </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t pt-6 text-center text-sm text-muted-foreground">
          <p>
            &copy; {new Date().getFullYear()} Okazje+. Wszelkie prawa zastrzeżone.
          </p>
          <p className="mt-1">
            Wersja: v{process.env.NEXT_PUBLIC_APP_VERSION}
            {process.env.NEXT_PUBLIC_GIT_SHA && (
              <>
                {' '}
                (<abbr title={process.env.NEXT_PUBLIC_GIT_SHA}>#{process.env.NEXT_PUBLIC_GIT_SHA.slice(0,7)}</abbr>)
              </>
            )}
          </p>
        </div>
      </div>
    </footer>
  );
}
