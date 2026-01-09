import { Sparkles } from "lucide-react";
import AuthForm from "@/components/auth-form";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata = {
  title: 'Logowanie i Rejestracja | Okazje Plus',
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="container relative flex min-h-screen flex-col items-center justify-center py-12 px-6">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[450px] animate-in fade-in duration-700">
          {/* Logo */}
          <div className="flex flex-col space-y-4 text-center animate-in slide-in-from-top duration-1000">
            <Link href="/" className="flex items-center justify-center gap-2 mb-4 hover:opacity-80 transition-opacity">
              <Logo className="h-10" />
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Okazje Plus
            </h1>
            <p className="text-slate-300">
              Logowanie i rejestracja
            </p>
          </div>

          {/* Auth Form */}
          <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700/50 backdrop-blur-sm shadow-2xl animate-in slide-in-from-bottom duration-1000 delay-300">
            <AuthForm />
          </div>

          {/* Footer Links */}
          <div className="text-center text-sm text-slate-400 space-y-2 animate-in fade-in duration-1000 delay-500">
            <p>
              Wracając na <Link href="/" className="text-slate-200 hover:text-white transition-colors font-semibold underline">stronę główną</Link>
            </p>
            <p className="text-xs">
              © 2026 Okazje Plus. Wszystkie prawa zastrzeżone.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
