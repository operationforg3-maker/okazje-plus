import { collection, query, where, getDocs, addDoc, deleteDoc, doc, getDoc, setDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface Follow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: string;
}

export interface UserProfile {
  userId: string;
  displayName: string;
  bio?: string;
  avatar?: string;
  followers: number;
  following: number;
  dealsPosted: number;
  badges: string[];
  level: number;
}

/**
 * Obserwuj użytkownika
 */
export async function followUser(followerId: string, followingId: string): Promise<void> {
  if (followerId === followingId) {
    throw new Error('Nie możesz obserwować samego siebie');
  }

  // Sprawdź czy już obserwuje
  const existing = await isFollowing(followerId, followingId);
  if (existing) {
    throw new Error('Już obserwujesz tego użytkownika');
  }

  const followsRef = collection(db, 'follows');
  await addDoc(followsRef, {
    followerId,
    followingId,
    createdAt: serverTimestamp(),
  });

  // Aktualizuj liczniki
  await updateFollowCounts(followerId, followingId);
}

/**
 * Przestań obserwować użytkownika
 */
export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  const followsRef = collection(db, 'follows');
  const q = query(
    followsRef,
    where('followerId', '==', followerId),
    where('followingId', '==', followingId)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    throw new Error('Nie obserwujesz tego użytkownika');
  }

  await deleteDoc(snapshot.docs[0].ref);

  // Aktualizuj liczniki
  await updateFollowCounts(followerId, followingId);
}

/**
 * Sprawdź czy użytkownik obserwuje innego użytkownika
 */
export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const followsRef = collection(db, 'follows');
  const q = query(
    followsRef,
    where('followerId', '==', followerId),
    where('followingId', '==', followingId),
    limit(1)
  );

  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

/**
 * Pobierz listę obserwowanych użytkowników
 */
export async function getFollowing(userId: string): Promise<string[]> {
  const followsRef = collection(db, 'follows');
  const q = query(followsRef, where('followerId', '==', userId));

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data().followingId);
}

/**
 * Pobierz listę obserwujących
 */
export async function getFollowers(userId: string): Promise<string[]> {
  const followsRef = collection(db, 'follows');
  const q = query(followsRef, where('followingId', '==', userId));

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data().followerId);
}

/**
 * Aktualizuj liczniki followersów i followingu
 */
async function updateFollowCounts(followerId: string, followingId: string): Promise<void> {
  const followersCount = (await getFollowers(followingId)).length;
  const followingCount = (await getFollowing(followerId)).length;

  const followerProfileRef = doc(db, 'userProfiles', followerId);
  const followingProfileRef = doc(db, 'userProfiles', followingId);

  await setDoc(followerProfileRef, { following: followingCount }, { merge: true });
  await setDoc(followingProfileRef, { followers: followersCount }, { merge: true });
}

/**
 * Pobierz feed z aktywnością obserwowanych użytkowników
 */
export async function getFollowingFeed(userId: string, limitCount: number = 20): Promise<any[]> {
  const following = await getFollowing(userId);
  
  if (following.length === 0) {
    return [];
  }

  // Pobierz najnowsze deale od obserwowanych
  const dealsRef = collection(db, 'deals');
  const q = query(
    dealsRef,
    where('postedBy', 'in', following.slice(0, 10)), // Firestore limit 10 dla 'in'
    where('status', '==', 'approved'),
    orderBy('postedAt', 'desc'),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    type: 'deal',
  }));
}

/**
 * Pobierz profil użytkownika
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const profileRef = doc(db, 'userProfiles', userId);
  const profileSnap = await getDoc(profileRef);

  if (!profileSnap.exists()) {
    return null;
  }

  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.data();

  const statsRef = doc(db, 'userStats', userId);
  const statsSnap = await getDoc(statsRef);
  const statsData = statsSnap.data();

  return {
    userId,
    displayName: userData?.displayName || userData?.email || 'Użytkownik',
    bio: profileSnap.data().bio,
    avatar: userData?.photoURL,
    followers: profileSnap.data().followers || 0,
    following: profileSnap.data().following || 0,
    dealsPosted: statsData?.dealsPosted || 0,
    badges: statsData?.badges?.map((b: any) => b.id) || [],
    level: statsData?.level || 1,
  };
}

/**
 * Aktualizuj bio użytkownika
 */
export async function updateUserBio(userId: string, bio: string): Promise<void> {
  const profileRef = doc(db, 'userProfiles', userId);
  await setDoc(profileRef, { bio }, { merge: true });
}
