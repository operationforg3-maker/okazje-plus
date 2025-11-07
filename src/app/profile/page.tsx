'use client';
export const dynamic = 'force-dynamic';


import { withAuth } from '@/components/auth/withAuth';
import { useAuth } from '@/lib/auth';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

function ProfilePage() {
  const { user, logout } = useAuth();

  if (!user) {
    return null; // Or a loading indicator
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="flex items-center space-x-6 mb-8">
        <Avatar className="h-24 w-24">
          {user.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName || 'User avatar'} />}
          <AvatarFallback>{user.displayName ? user.displayName.charAt(0) : 'U'}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-3xl font-bold">{user.displayName || 'Użytkownik'}</h1>
          <p className="text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Moja aktywność</h2>
        {/* TODO: Add user activity */}
        <p>Twoja aktywność pojawi się tutaj już wkrótce!</p>
      </div>

      <div className="mt-8">
        <Button onClick={logout}>Wyloguj</Button>
      </div>
    </div>
  );
}

export default withAuth(ProfilePage);
