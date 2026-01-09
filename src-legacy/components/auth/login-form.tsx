'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Github } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, GithubAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

interface LoginFormProps extends React.HTMLAttributes<HTMLDivElement> {}

export default function LoginForm({ className, ...props }: LoginFormProps) {
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const router = useRouter();

  const handleLogin = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/');
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      router.push('/');
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSocialLogin = async (provider: GoogleAuthProvider | GithubAuthProvider) => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, provider);
      router.push('/');
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={cn('grid gap-6', className)} {...props}>
      {error && (
          <Alert variant="destructive">
              <AlertTitle>Błąd</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
          </Alert>
      )}
      <Tabs defaultValue="login" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Logowanie</TabsTrigger>
          <TabsTrigger value="register">Rejestracja</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
          <form onSubmit={handleLogin}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="email-login">Email</Label>
                <Input
                  id="email-login"
                  placeholder="name@example.com"
                  type="email"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect="off"
                  disabled={isLoading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password-login">Hasło</Label>
                <Input id="password-login" type="password" disabled={isLoading} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button disabled={isLoading} className="mt-2">
                {isLoading && <span className="animate-spin mr-2">...</span>}
                Zaloguj się
              </Button>
            </div>
          </form>
        </TabsContent>
        <TabsContent value="register">
          <form onSubmit={handleRegister}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="email-register">Email</Label>
                <Input
                  id="email-register"
                  placeholder="name@example.com"
                  type="email"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect="off"
                  disabled={isLoading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password-register">Hasło</Label>
                <Input id="password-register" type="password" disabled={isLoading} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button disabled={isLoading} className="mt-2">
                {isLoading && <span className="animate-spin mr-2">...</span>}
                Utwórz konto
              </Button>
            </div>
          </form>
        </TabsContent>
      </Tabs>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Lub kontynuuj z
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Button variant="outline" type="button" disabled={isLoading} onClick={() => handleSocialLogin(new GoogleAuthProvider())}>
          <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512 109.8 512 0 402.2 0 261.8S109.8 11.6 244 11.6C381.5 11.6 488 120.3 488 261.8zM127.3 261.8c0 34.3 11.1 65.8 30.7 90.9-10.4-23.2-16.7-49.3-16.7-77.2 0-27.5 6.1-53.3 16.3-76.7-19.4 25.1-30.3 56.4-30.3 90zM244 501.1c5.2 0 10.3-.2 15.4-.5-29-16.1-53.2-39.8-69.3-69.3-16.1 29.5-39.8 53.2-69.3 69.3 22.3 12.3 47.7 19.9 75.2 20.5 15.6 0 30.8-.9 45.8-2.6-4.6-2-9-4.1-13.2-6.4zm11.3-18.9c-16.1-29.5-39.8-53.2-69.3-69.3 29.5-16.1 53.2-39.8 69.3-69.3 16.1 29.5 39.8 53.2 69.3 69.3-29.5 16.1-53.2 39.8-69.3 69.3zM441.4 352.7c-19.6-25-30.4-56.3-30.4-90.9s10.8-65.8 30.4-90.9c-22.3-12.3-47.7-19.9-75.2-20.5-15.6 0-30.8.9-45.8 2.6 4.6 2 9 4.1 13.2 6.4 16.1 29.5 39.8 53.2 69.3 69.3-29.5 16.1-53.2 39.8-69.3 69.3-16.1-29.5-39.8-53.2-69.3-69.3 29.5-16.1 53.2-39.8 69.3-69.3 25.3 44.5 34.6 97.9 26.2 148.9-5.2 0-10.3.2-15.4.5 29-16.1 53.2-39.8 69.3-69.3 16.1 29.5 39.8 53.2 69.3 69.3-4.6 2-9 4.1-13.2 6.4-15.1 1.7-30.3 2.6-45.8 2.6-27.5-.6-52.9-8.2-75.2-20.5 19.6 25 30.4 56.3 30.4 90.9z"></path></svg>
          Google
        </Button>
        <Button variant="outline" type="button" disabled={isLoading} onClick={() => handleSocialLogin(new GithubAuthProvider())}>
          <Github className="mr-2 h-4 w-4" />
          GitHub
        </Button>
      </div>
    </div>
  );
}
