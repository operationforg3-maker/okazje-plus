'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { withAuth } from '@/components/auth/withAuth';
import { useAuth } from '@/lib/auth';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  User, 
  Lock, 
  Bell, 
  Shield, 
  Settings as SettingsIcon,
  Upload,
  Save,
  Trash2,
  AlertTriangle,
  Mail,
  MapPin,
  Info
} from 'lucide-react';
import { updateProfile, updatePassword, updateEmail, deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { toast } from 'sonner';
import Link from 'next/link';

function SettingsPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);

  // Profil
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Konto
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Preferencje
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [dealNotifications, setDealNotifications] = useState(true);
  const [commentNotifications, setCommentNotifications] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);

  // Prywatność
  const [profilePublic, setProfilePublic] = useState(true);
  const [showActivity, setShowActivity] = useState(true);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setAvatarUrl(user.photoURL || '');
      
      // Tutaj można załadować dodatkowe dane z Firestore (bio, location, preferencje)
      // Na razie używam wartości domyślnych
    }
  }, [user]);

  if (!user) {
    return null;
  }

  const handleProfileUpdate = async () => {
    if (!user) return;
    
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      toast.error('Błąd: Brak sesji użytkownika');
      return;
    }
    
    setLoading(true);
    try {
      // Aktualizuj Firebase Auth profile
      await updateProfile(firebaseUser, {
        displayName: displayName.trim() || null,
        photoURL: avatarUrl.trim() || null,
      });

      // Aktualizuj dane w Firestore (users collection)
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        displayName: displayName.trim() || null,
        bio: bio.trim() || null,
        location: location.trim() || null,
        photoURL: avatarUrl.trim() || null,
      });

      toast.success('Profil został zaktualizowany!');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error('Błąd podczas aktualizacji profilu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!user || !user.email) return;

    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      toast.error('Błąd: Brak sesji użytkownika');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Nowe hasła nie są identyczne');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Nowe hasło musi mieć minimum 6 znaków');
      return;
    }

    setLoading(true);
    try {
      // Reauthenticate user
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(firebaseUser, credential);

      // Update password
      await updatePassword(firebaseUser, newPassword);

      toast.success('Hasło zostało zmienione!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error changing password:', error);
      if (error.code === 'auth/wrong-password') {
        toast.error('Aktualne hasło jest nieprawidłowe');
      } else {
        toast.error('Błąd podczas zmiany hasła: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePreferencesUpdate = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        preferences: {
          emailNotifications,
          dealNotifications,
          commentNotifications,
          weeklyDigest,
        },
      });

      toast.success('Preferencje zostały zaktualizowane!');
    } catch (error: any) {
      console.error('Error updating preferences:', error);
      toast.error('Błąd podczas aktualizacji preferencji: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrivacyUpdate = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        privacy: {
          profilePublic,
          showActivity,
        },
      });

      toast.success('Ustawienia prywatności zostały zaktualizowane!');
    } catch (error: any) {
      console.error('Error updating privacy:', error);
      toast.error('Błąd podczas aktualizacji prywatności: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || !user.email) return;

    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      toast.error('Błąd: Brak sesji użytkownika');
      return;
    }

    setLoading(true);
    try {
      // Usuń dane użytkownika z Firestore
      const userDocRef = doc(db, 'users', user.uid);
      await deleteDoc(userDocRef);

      // Usuń konto Firebase Auth
      await deleteUser(firebaseUser);

      toast.success('Konto zostało usunięte');
      // Przekieruj na stronę główną
      window.location.href = '/';
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast.error('Błąd podczas usuwania konta: ' + error.message);
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Link href="/profile" className="hover:text-primary transition-colors">
            Profil
          </Link>
          <span>/</span>
          <span className="text-foreground">Ustawienia</span>
        </div>
        <h1 className="font-headline text-3xl font-bold">Ustawienia konta</h1>
        <p className="text-muted-foreground mt-2">
          Zarządzaj swoim profilem, bezpieczeństwem i preferencjami
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profil</span>
          </TabsTrigger>
          <TabsTrigger value="account" className="gap-2">
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">Konto</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Preferencje</span>
          </TabsTrigger>
          <TabsTrigger value="privacy" className="gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Prywatność</span>
          </TabsTrigger>
          <TabsTrigger value="advanced" className="gap-2">
            <SettingsIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Zaawansowane</span>
          </TabsTrigger>
        </TabsList>

        {/* Profil */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Informacje profilowe</CardTitle>
              <CardDescription>
                Zaktualizuj swoje dane publiczne i zdjęcie profilowe
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-6">
                <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt="Avatar" />}
                  <AvatarFallback className="text-2xl">
                    {displayName ? displayName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <Label htmlFor="avatar">URL zdjęcia profilowego</Label>
                  <div className="flex gap-2">
                    <Input
                      id="avatar"
                      placeholder="https://example.com/avatar.jpg"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                    />
                    <Button variant="outline" size="icon">
                      <Upload className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Wklej URL swojego zdjęcia lub użyj przycisku do uploadu
                  </p>
                </div>
              </div>

              <Separator />

              {/* Display Name */}
              <div className="space-y-2">
                <Label htmlFor="displayName">Nazwa wyświetlana</Label>
                <Input
                  id="displayName"
                  placeholder="Twoja nazwa użytkownika"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={50}
                />
                <p className="text-xs text-muted-foreground">
                  Maksymalnie 50 znaków
                </p>
              </div>

              {/* Bio */}
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  placeholder="Opowiedz coś o sobie..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={500}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  {bio.length}/500 znaków
                </p>
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label htmlFor="location">Lokalizacja</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="location"
                    placeholder="Miasto, Kraj"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="pl-9"
                    maxLength={100}
                  />
                </div>
              </div>

              <Separator />

              <Button onClick={handleProfileUpdate} disabled={loading} className="w-full sm:w-auto">
                <Save className="mr-2 h-4 w-4" />
                {loading ? 'Zapisywanie...' : 'Zapisz zmiany'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Konto */}
        <TabsContent value="account">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Adres email</CardTitle>
                <CardDescription>
                  Twój obecny adres email używany do logowania
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium">{user.email}</p>
                    <p className="text-xs text-muted-foreground">Zweryfikowany email</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  <Info className="inline h-4 w-4 mr-1" />
                  Zmiana emaila wymaga ponownego logowania
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Zmiana hasła</CardTitle>
                <CardDescription>
                  Upewnij się, że używasz silnego hasła
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Aktualne hasło</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nowe hasło</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Potwierdź nowe hasło</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                <Button onClick={handlePasswordChange} disabled={loading || !currentPassword || !newPassword}>
                  <Lock className="mr-2 h-4 w-4" />
                  {loading ? 'Zmieniam...' : 'Zmień hasło'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Preferencje */}
        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>Powiadomienia</CardTitle>
              <CardDescription>
                Wybierz, o czym chcesz być informowany
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Powiadomienia email</Label>
                  <p className="text-sm text-muted-foreground">
                    Otrzymuj powiadomienia na email
                  </p>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Nowe okazje</Label>
                  <p className="text-sm text-muted-foreground">
                    Powiadomienia o gorących okazjach w Twoich kategoriach
                  </p>
                </div>
                <Switch
                  checked={dealNotifications}
                  onCheckedChange={setDealNotifications}
                  disabled={!emailNotifications}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Komentarze i odpowiedzi</Label>
                  <p className="text-sm text-muted-foreground">
                    Powiadomienia gdy ktoś odpowie na Twój komentarz
                  </p>
                </div>
                <Switch
                  checked={commentNotifications}
                  onCheckedChange={setCommentNotifications}
                  disabled={!emailNotifications}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Cotygodniowe podsumowanie</Label>
                  <p className="text-sm text-muted-foreground">
                    Email z najlepszymi okazjami tygodnia
                  </p>
                </div>
                <Switch
                  checked={weeklyDigest}
                  onCheckedChange={setWeeklyDigest}
                  disabled={!emailNotifications}
                />
              </div>

              <Separator />

              <Button onClick={handlePreferencesUpdate} disabled={loading}>
                <Save className="mr-2 h-4 w-4" />
                {loading ? 'Zapisywanie...' : 'Zapisz preferencje'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Prywatność */}
        <TabsContent value="privacy">
          <Card>
            <CardHeader>
              <CardTitle>Ustawienia prywatności</CardTitle>
              <CardDescription>
                Kontroluj widoczność swoich danych
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Profil publiczny</Label>
                  <p className="text-sm text-muted-foreground">
                    Pozwól innym użytkownikom odwiedzać Twój profil
                  </p>
                </div>
                <Switch
                  checked={profilePublic}
                  onCheckedChange={setProfilePublic}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Pokaż aktywność</Label>
                  <p className="text-sm text-muted-foreground">
                    Wyświetlaj Twoje komentarze i oceny publicznie
                  </p>
                </div>
                <Switch
                  checked={showActivity}
                  onCheckedChange={setShowActivity}
                  disabled={!profilePublic}
                />
              </div>

              <Separator />

              <Button onClick={handlePrivacyUpdate} disabled={loading}>
                <Save className="mr-2 h-4 w-4" />
                {loading ? 'Zapisywanie...' : 'Zapisz ustawienia'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Zaawansowane */}
        <TabsContent value="advanced">
          <div className="space-y-6">
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-destructive">Strefa niebezpieczna</CardTitle>
                <CardDescription>
                  Nieodwracalne operacje na koncie
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                  <div className="flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div className="space-y-2 flex-1">
                      <h4 className="font-semibold text-destructive">Usunięcie konta</h4>
                      <p className="text-sm text-muted-foreground">
                        Po usunięciu konta stracisz dostęp do wszystkich swoich danych:
                      </p>
                      <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                        <li>Historia komentarzy i głosów</li>
                        <li>Dodane okazje i produkty</li>
                        <li>Ulubione i powiadomienia</li>
                        <li>Statystyki i osiągnięcia</li>
                      </ul>
                      <p className="text-sm font-medium text-destructive">
                        Ta operacja jest nieodwracalna!
                      </p>
                    </div>
                  </div>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={loading}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Usuń konto
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Czy na pewno chcesz usunąć konto?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Ta operacja jest nieodwracalna. Wszystkie Twoje dane zostaną trwale usunięte
                        z naszych serwerów.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Anuluj</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteAccount}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        Tak, usuń moje konto
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default withAuth(SettingsPage);
