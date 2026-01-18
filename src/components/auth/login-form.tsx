'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface LoginFormProps extends React.HTMLAttributes<HTMLDivElement> {}

export default function LoginForm({ className, ...props }: LoginFormProps) {
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const router = useRouter();
  const t = useTranslations('login');

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
  
  const handleSocialLogin = async (provider: GoogleAuthProvider) => {
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
              <AlertTitle>{t('errors.title')}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
          </Alert>
      )}
      <Tabs defaultValue="login" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">{t('tabs.login')}</TabsTrigger>
          <TabsTrigger value="register">{t('tabs.register')}</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
          <form onSubmit={handleLogin}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="email-login">{t('labels.email')}</Label>
                <Input
                  id="email-login"
                  placeholder={t('placeholders.email')}
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
                <Label htmlFor="password-login">{t('labels.password')}</Label>
                <Input id="password-login" type="password" placeholder={t('placeholders.password')} autoComplete="current-password" disabled={isLoading} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button disabled={isLoading} className="mt-2">
                {isLoading && <span className="animate-spin mr-2">...</span>}
                {t('buttons.login')}
              </Button>
            </div>
          </form>
        </TabsContent>
        <TabsContent value="register">
          <form onSubmit={handleRegister}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="email-register">{t('labels.email')}</Label>
                <Input
                  id="email-register"
                  placeholder={t('placeholders.email')}
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
                <Label htmlFor="password-register">{t('labels.password')}</Label>
                <Input id="password-register" type="password" placeholder={t('placeholders.password')} autoComplete="new-password" disabled={isLoading} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button disabled={isLoading} className="mt-2">
                {isLoading && <span className="animate-spin mr-2">...</span>}
                {t('buttons.register')}
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
            {t('social.continueWith')}
          </span>
        </div>
      </div>
      <Button 
        variant="outline" 
        type="button" 
        disabled={isLoading} 
        onClick={() => handleSocialLogin(new GoogleAuthProvider())}
        className="w-full h-11 border-2 hover:bg-accent hover:border-primary/50 transition-all"
      >
        <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        <span className="font-medium">{t('social.continueGoogle')}</span>
      </Button>
    </div>
  );
}
