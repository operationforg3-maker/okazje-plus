import { addDoc, collection, doc, getDoc, getDocs, increment, limit, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CategorySuggestion, ForumCategory, ForumPost, ForumThread, PostAttachment } from '@/lib/types';

export async function listForumCategoriesData(): Promise<ForumCategory[]> {
  const ref = collection(db, 'forum_categories');
  const snap = await getDocs(query(ref, orderBy('sortOrder', 'asc')));
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as ForumCategory));
}

export async function createCategorySuggestionData(data: {
  name: string;
  description: string;
  suggestedByUid: string;
  suggestedByName?: string | null;
}): Promise<string> {
  const ref = collection(db, 'forum_category_suggestions');
  const docRef = await addDoc(ref, {
    ...data,
    status: 'pending',
    createdAt: new Date().toISOString(),
  } as Omit<CategorySuggestion, 'id'>);
  return docRef.id;
}

export async function listCategorySuggestionsData(statusFilter?: 'pending' | 'approved' | 'rejected'): Promise<CategorySuggestion[]> {
  const ref = collection(db, 'forum_category_suggestions');
  const q = statusFilter
    ? query(ref, where('status', '==', statusFilter), orderBy('createdAt', 'desc'))
    : query(ref, orderBy('createdAt', 'desc'));

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as CategorySuggestion));
}

export async function approveCategorySuggestionData(suggestionId: string, adminUid: string): Promise<string> {
  const suggestionRef = doc(db, 'forum_category_suggestions', suggestionId);
  const suggestionSnap = await getDoc(suggestionRef);

  if (!suggestionSnap.exists()) {
    throw new Error('Propozycja nie znaleziona');
  }

  const suggestion = suggestionSnap.data() as CategorySuggestion;

  const slug = suggestion.name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  const categoriesRef = collection(db, 'forum_categories');
  const categoriesSnap = await getDocs(categoriesRef);
  const nextSortOrder = categoriesSnap.size + 1;

  const newCategoryRef = await addDoc(categoriesRef, {
    name: suggestion.name,
    slug,
    description: suggestion.description,
    sortOrder: nextSortOrder,
    createdAt: new Date().toISOString(),
  });

  await updateDoc(suggestionRef, {
    status: 'approved',
    reviewedAt: new Date().toISOString(),
    reviewedByUid: adminUid,
  });

  return newCategoryRef.id;
}

export async function rejectCategorySuggestionData(suggestionId: string, adminUid: string, reason: string): Promise<void> {
  const suggestionRef = doc(db, 'forum_category_suggestions', suggestionId);
  await updateDoc(suggestionRef, {
    status: 'rejected',
    reviewedAt: new Date().toISOString(),
    reviewedByUid: adminUid,
    rejectionReason: reason,
  });
}

export async function listForumThreadsData(limitCount: number = 20, categoryId?: string): Promise<ForumThread[]> {
  const ref = collection(db, 'forum_threads');
  let qBase;

  try {
    if (categoryId) {
      qBase = query(ref, where('categoryId', '==', categoryId), orderBy('isPinned', 'desc'), orderBy('lastPostAt', 'desc'), limit(limitCount));
    } else {
      qBase = query(ref, orderBy('isPinned', 'desc'), orderBy('lastPostAt', 'desc'), limit(limitCount));
    }
  } catch {
    qBase = categoryId
      ? query(ref, where('categoryId', '==', categoryId), orderBy('createdAt', 'desc'), limit(limitCount))
      : query(ref, orderBy('createdAt', 'desc'), limit(limitCount));
  }

  const snap = await getDocs(qBase);
  const threads = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as ForumThread));

  return threads
    .filter(t => !t.status || t.status === 'approved')
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0;
    });
}

export async function getForumThreadData(threadId: string): Promise<ForumThread | null> {
  const ref = doc(db, 'forum_threads', threadId);
  const d = await getDoc(ref);
  if (!d.exists()) return null;
  return { id: d.id, ...(d.data() as any) } as ForumThread;
}

export async function listForumPostsData(threadId: string, limitCount: number = 100): Promise<ForumPost[]> {
  const ref = collection(db, 'forum_threads', threadId, 'posts');
  const q = query(ref, orderBy('createdAt', 'asc'), limit(limitCount));
  const snap = await getDocs(q);
  const posts = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as ForumPost));
  return posts.filter(p => !p.status || p.status === 'approved');
}

export async function createForumThreadData(params: {
  title: string;
  content: string;
  categoryId?: string | null;
  attachments?: PostAttachment[];
  authorUid: string;
  authorDisplayName?: string | null;
}): Promise<string> {
  const now = new Date().toISOString();
  const threadData: Record<string, any> = {
    title: params.title,
    authorUid: params.authorUid,
    authorDisplayName: params.authorDisplayName ?? null,
    categoryId: params.categoryId ?? null,
    tags: [],
    summary: params.content.slice(0, 200),
    postsCount: 1,
    createdAt: now,
    updatedAt: now,
    lastPostAt: now,
  };

  if (params.attachments && params.attachments.length > 0) {
    threadData.attachments = params.attachments;
  }

  const threadRef = await addDoc(collection(db, 'forum_threads'), threadData);

  const post: Omit<ForumPost, 'id'> = {
    threadId: threadRef.id,
    authorUid: params.authorUid,
    authorDisplayName: params.authorDisplayName ?? null,
    content: params.content,
    ...(params.attachments && params.attachments.length > 0 && { attachments: params.attachments }),
    parentId: null,
    upvotes: 0,
    downvotes: 0,
    createdAt: now,
    updatedAt: now,
  };

  await addDoc(collection(db, 'forum_threads', threadRef.id, 'posts'), post as any);
  return threadRef.id;
}

export async function addForumPostData(params: {
  threadId: string;
  content: string;
  attachments?: PostAttachment[];
  authorUid: string;
  authorDisplayName?: string | null;
  parentId?: string | null;
}): Promise<string> {
  const now = new Date().toISOString();
  const postData: Record<string, any> = {
    threadId: params.threadId,
    authorUid: params.authorUid,
    authorDisplayName: params.authorDisplayName ?? null,
    content: params.content,
    parentId: params.parentId ?? null,
    upvotes: 0,
    downvotes: 0,
    createdAt: now,
    updatedAt: now,
  };

  if (params.attachments && params.attachments.length > 0) {
    postData.attachments = params.attachments;
  }

  const ref = await addDoc(collection(db, 'forum_threads', params.threadId, 'posts'), postData);
  await updateDoc(doc(db, 'forum_threads', params.threadId), {
    postsCount: increment(1),
    lastPostAt: now,
    updatedAt: now,
  });

  return ref.id;
}
