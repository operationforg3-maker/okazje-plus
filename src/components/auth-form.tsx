'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface AuthFormProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultTab?: 'login' | 'register';
}

export default function AuthForm({ className, defaultTab = 'login', ...props }: AuthFormProps) {
  const t = useTranslations('auth');
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [success, setSuccess] = React.useState<string | null>(null);

  const handleLogin = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        setSuccess(t('success.loggedIn'));
        setTimeout(() => window.location.href = '/', 2000);
      } else {
        const data = await response.json();
        setError(data.error || t('error.loginFailed'));
      }
    } catch (error: any) {
      setError(error.message || t('error.loginFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        setSuccess(t('success.registered'));
        setTimeout(() => window.location.href = '/', 2000);
      } else {
        const data = await response.json();
        setError(data.error || t('error.registerFailed'));
      }
    } catch (error: any) {
      setError(error.message || t('error.registerFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn('grid gap-6', className)} {...props}>
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-green-500/50 text-green-600 dark:text-green-400">
          <AlertTitle>Success!</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}
      
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">{t('login.title')}</TabsTrigger>
          <TabsTrigger value="register">{t('register.title')}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="login">
          <form onSubmit={handleLogin} className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email-login">{t('email.label')}</Label>
              <Input
                id="email-login"
                placeholder={t('email.placeholder')}
                type="email"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect="off"
                disabled={isLoading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password-login">{t('password.label')}</Label>
              <Input
                id="password-login"
                type="password"
                disabled={isLoading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button disabled={isLoading} className="w-full mt-2">
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t('button.login')}...
                </span>
              ) : (
                t('button.login')
              )}
            </Button>
          </form>
        </TabsContent>
        
        <TabsContent value="register">
          <form onSubmit={handleRegister} className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="email-register">{t('email.label')}</Label>
              <Input
                id="email-register"
                placeholder={t('email.placeholder')}
                type="email"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect="off"
                disabled={isLoading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password-register">{t('password.label')}</Label>
              <Input
                id="password-register"
                type="password"
                disabled={isLoading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button disabled={isLoading} className="w-full mt-2">
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t('button.register')}...
                </span>
              ) : (
                t('button.register')
              )}
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
