'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { UserPlus, UserMinus, Loader2 } from 'lucide-react';
import { followUser, unfollowUser, isFollowing } from '@/lib/social';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

interface FollowButtonProps {
  targetUserId: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
}

export function FollowButton({ targetUserId, variant = 'default', size = 'default' }: FollowButtonProps) {
  const { user } = useAuth();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!user || user.uid === targetUserId) {
      setChecking(false);
      return;
    }

    async function checkFollowing() {
      try {
        const result = await isFollowing(user!.uid, targetUserId);
        setFollowing(result);
      } catch (error) {
        console.error('Error checking follow status:', error);
      } finally {
        setChecking(false);
      }
    }

    checkFollowing();
  }, [user, targetUserId]);

  const handleToggleFollow = async () => {
    if (!user) {
      toast.error('Musisz być zalogowany, aby obserwować użytkowników');
      return;
    }

    setLoading(true);
    try {
      if (following) {
        await unfollowUser(user.uid, targetUserId);
        setFollowing(false);
        toast.success('Przestałeś obserwować użytkownika');
      } else {
        await followUser(user.uid, targetUserId);
        setFollowing(true);
        toast.success('Teraz obserwujesz tego użytkownika!');
      }
    } catch (error: any) {
      toast.error(error.message || 'Wystąpił błąd');
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.uid === targetUserId) {
    return null;
  }

  if (checking) {
    return (
      <Button variant={variant} size={size} disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  return (
    <Button
      variant={following ? 'outline' : variant}
      size={size}
      onClick={handleToggleFollow}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : following ? (
        <>
          <UserMinus className="h-4 w-4 mr-2" />
          Obserwujesz
        </>
      ) : (
        <>
          <UserPlus className="h-4 w-4 mr-2" />
          Obserwuj
        </>
      )}
    </Button>
  );
}
