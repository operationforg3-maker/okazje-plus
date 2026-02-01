"use client";

import { useEffect, useRef, useState } from 'react';
import { ForumPost, ForumThread, PostAttachment, Deal, Product } from '@/lib/types';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { SearchableAttachmentPicker } from '@/components/forum/searchable-attachment-picker';
import { AttachmentCard } from '@/components/forum/attachment-card';
import { VoteControls } from '@/components/forum/vote-controls';
import { PostReactions } from '@/components/forum/post-reactions';
import { PostActions } from '@/components/forum/post-actions';
import { useForumFavorite } from '@/hooks/use-forum-favorite';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Pin, Lock, Award, Bookmark } from 'lucide-react';
import { toast } from 'sonner';

// Komponent do parsowania @mentions i renderowania załączników
async function parseMentions(content: string): Promise<{
  text: string;
  mentions: Array<{ type: 'deal' | 'product' | 'user'; id: string; item?: Deal | Product | { id: string; displayName?: string; email?: string } }>;
}> {
  const mentionRegex = /@(deal|product|user):([a-zA-Z0-9_-]+)/g;
  const mentions: Array<{ type: 'deal' | 'product' | 'user'; id: string; item?: Deal | Product | { id: string; displayName?: string; email?: string } }> = [];
  
  const matches = Array.from(content.matchAll(mentionRegex));
  for (const match of matches) {
    const type = match[1] as 'deal' | 'product' | 'user';
    const id = match[2];
    
    try {
      if (type === 'user') {
        const usersRef = collection(db, 'users');
        const userDoc = await getDoc(doc(usersRef, id));

        if (userDoc.exists()) {
          const data = userDoc.data();
          mentions.push({
            type,
            id: userDoc.id,
            item: { id: userDoc.id, displayName: data?.displayName, email: data?.email },
          });
        } else {
          const byName = await getDocs(query(usersRef, where('displayName', '==', id), limit(1)));
          const matchDoc = byName.docs[0];
          if (matchDoc) {
            const data = matchDoc.data();
            mentions.push({
              type,
              id: matchDoc.id,
              item: { id: matchDoc.id, displayName: data?.displayName, email: data?.email },
            });
          }
        }
      } else {
        const collectionName = type === 'deal' ? 'deals' : 'product_cores';
        const docRef = doc(db, collectionName, id);
        const snap = await getDoc(docRef);
        
        if (snap.exists()) {
          mentions.push({
            type,
            id,
            item: { id: snap.id, ...snap.data() } as Deal | Product,
          });
        }
      }
    } catch (error) {
      console.error(`Failed to fetch ${type}:${id}`, error);
    }
  }
  
  const cleanText = content.replace(mentionRegex, (match, type, id) => {
    if (type === 'user') return `@${id}`;
    return '';
  });
  return { text: cleanText, mentions };
}

type MentionType = 'deal' | 'product' | 'user';
type MentionContext = {
  type: MentionType;
  query: string;
  start: number;
  end: number;
};
type MentionSuggestion = {
  type: MentionType;
  id: string;
  title: string;
  image?: string;
  subtitle?: string;
};

function MentionSuggestions({
  suggestions,
  onSelect,
}: {
  suggestions: MentionSuggestion[];
  onSelect: (item: MentionSuggestion) => void;
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className="border rounded-lg divide-y bg-background shadow-sm">
      {suggestions.map((item, index) => (
        <button
          key={`${item.type}-${item.id || `idx-${index}`}`}
          type="button"
          className="w-full p-3 flex items-center gap-3 text-left hover:bg-muted/50 transition-colors"
          onClick={() => onSelect(item)}
        >
          {item.image ? (
            <img src={item.image} alt={item.title} className="w-10 h-10 rounded object-cover" />
          ) : (
            <div className="w-10 h-10 rounded bg-muted" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium line-clamp-1">{item.title}</div>
            {item.subtitle && (
              <div className="text-xs text-muted-foreground">{item.subtitle}</div>
            )}
          </div>
          <Badge variant="outline" className="text-xs">
            {item.type === 'deal' ? 'Okazja' : item.type === 'product' ? 'Produkt' : 'Użytkownik'}
          </Badge>
        </button>
      ))}
    </div>
  );
}

function PostContent({ content, attachments }: { content: string; attachments?: PostAttachment[] }) {
  const [parsed, setParsed] = useState<{
    text: string;
    mentions: Array<{ type: 'deal' | 'product' | 'user'; id: string; item?: Deal | Product | { id: string; displayName?: string; email?: string } }>;
  } | null>(null);

  useEffect(() => {
    parseMentions(content).then(setParsed);
  }, [content]);

  if (!parsed) {
    return <div className="whitespace-pre-wrap text-sm leading-6">{content}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="whitespace-pre-wrap text-sm leading-6">{parsed.text}</div>

      {/* Render inline @mentions */}
      {parsed.mentions.length > 0 && (
        <div className="space-y-2">
          {parsed.mentions.map((mention, idx) => {
            if (!mention.item) return null;
            if (mention.type === 'user') {
              const user = mention.item as { id: string; displayName?: string; email?: string };
              return (
                <Badge key={`user-${mention.id}-${idx}`} variant="secondary" className="w-fit">
                  @{user.displayName || user.email || mention.id}
                </Badge>
              );
            }

            return (
              <AttachmentCard
                key={`${mention.type}-${mention.id}-${idx}`}
                item={mention.item as Deal | Product}
                type={mention.type}
                variant="compact"
              />
            );
          })}
        </div>
      )}

      {/* Render formal attachments (if different from mentions) */}
      {attachments && attachments.length > 0 && (
        <div className="space-y-2 pt-2 border-t">
          {attachments.map((att, idx) => {
            // Skip if already shown in mentions
            const alreadyShown = parsed.mentions.some(m => m.type === att.type && m.id === att.id);
            if (alreadyShown) return null;

            return (
              <FetchAndRenderAttachment key={`att-${idx}`} attachment={att} />
            );
          })}
        </div>
      )}
    </div>
  );
}

function FetchAndRenderAttachment({ attachment }: { attachment: PostAttachment }) {
  const [item, setItem] = useState<Deal | Product | null>(null);

  useEffect(() => {
    const collectionName = attachment.type === 'deal' ? 'deals' : 'product_cores';
    const docRef = doc(db, collectionName, attachment.id);
    getDoc(docRef).then(snap => {
      if (snap.exists()) {
        setItem({ id: snap.id, ...snap.data() } as Deal | Product);
      }
    }).catch(console.error);
  }, [attachment.type, attachment.id]);

  if (!item) return null;

  return (
    <AttachmentCard
      item={item}
      type={attachment.type}
      variant="compact"
    />
  );
}

// Helper component to save/favorite a post
function SavePostButton({ postId, threadId }: { postId: string; threadId: string }) {
  const { isFavorited, isLoading, toggleFavorite } = useForumFavorite(postId, 'post');

  return (
    <Button
      variant={isFavorited ? "default" : "outline"}
      size="sm"
      onClick={toggleFavorite}
      disabled={isLoading}
      className={isFavorited ? "gap-1" : "gap-1"}
    >
      <Bookmark className={`h-4 w-4 ${isFavorited ? 'fill-current' : ''}`} />
      {isFavorited ? 'Zapisane' : 'Zapisz'}
    </Button>
  );
}

export default function ThreadPage() {
  const params = useParams<{ id: string }>();
  const threadId = params?.id;
  const { user, getIdToken } = useAuth();

  const [thread, setThread] = useState<ForumThread | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);

  const [reply, setReply] = useState('');
  const [attType, setAttType] = useState<'none' | 'deal' | 'product'>('none');
  const [selectedAttachment, setSelectedAttachment] = useState<Deal | Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [replyToPostId, setReplyToPostId] = useState<string | null>(null);
  const [replyToContent, setReplyToContent] = useState('');
  const [mentionContext, setMentionContext] = useState<MentionContext | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionSuggestion[]>([]);
  const [replyMentionContext, setReplyMentionContext] = useState<MentionContext | null>(null);
  const [replyMentionSuggestions, setReplyMentionSuggestions] = useState<MentionSuggestion[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const mainTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Favorites hook
  const { isFavorited, isLoading: isFavoriteLoading, toggleFavorite } = useForumFavorite(
    threadId || '',
    'thread',
    (isFav) => {
      // Update saved count when thread favorite state changes
      setSavedCount((prev) => isFav ? prev + 1 : Math.max(0, prev - 1));
    }
  );

  const getTitleValue = (title: any): string => {
    if (typeof title === 'string') return title;
    if (title && typeof title === 'object') {
      return title.pl || title.en || title.de || 'N/A';
    }
    return 'N/A';
  };

  const getMentionContext = (value: string, cursor: number) => {
    const prefix = value.slice(0, cursor);
    const match = prefix.match(/@(deal|product|user):([^\s@]*)$/i);
    if (!match || match.index === undefined) return null;
    return {
      type: match[1].toLowerCase() as MentionType,
      query: match[2] || '',
      start: match.index,
      end: cursor,
    } satisfies MentionContext;
  };

  const fetchMentionSuggestions = async (context: MentionContext) => {
    const queryText = context.query.toLowerCase();
    if (context.type === 'user') {
      const usersRef = collection(db, 'users');
      const snap = await getDocs(query(usersRef, limit(20)));
      return snap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((user: any) => {
          if (!queryText) return true;
          const displayName = String(user.displayName || '').toLowerCase();
          const email = String(user.email || '').toLowerCase();
          return displayName.includes(queryText) || email.includes(queryText);
        })
        .slice(0, 10)
        .map((user: any) => ({
          type: 'user' as const,
          id: user.id,
          title: user.displayName || user.email || user.id,
          subtitle: user.email ? user.email : undefined,
          image: user.photoURL || undefined,
        }));
    }

    if (context.type === 'deal') {
      const ref = collection(db, 'deals');
      let snap;
      try {
        snap = await getDocs(query(ref, where('status', '==', 'approved'), limit(20)));
      } catch {
        snap = await getDocs(query(ref, limit(20)));
      }
      return snap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as Deal))
        .filter((deal) => {
          if (!queryText) return true;
          const title = getTitleValue((deal as any).title);
          return title.toLowerCase().includes(queryText);
        })
        .slice(0, 10)
        .map((deal) => ({
          type: 'deal' as const,
          id: deal.id,
          title: getTitleValue((deal as any).title),
          image: (deal as any).image,
          subtitle: typeof (deal as any).price === 'number' ? `${(deal as any).price} zł` : undefined,
        }));
    }

    const ref = collection(db, 'product_cores');
    let snap;
    try {
      snap = await getDocs(query(ref, where('status', '==', 'approved'), limit(20)));
    } catch {
      snap = await getDocs(query(ref, limit(20)));
    }

    return snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((product: any) => {
        if (!queryText) return true;
        const title = getTitleValue(product.title ?? product.name);
        return title.toLowerCase().includes(queryText);
      })
      .slice(0, 10)
      .map((product: any) => ({
        type: 'product' as const,
        id: product.id,
        title: getTitleValue(product.title ?? product.name),
        image: product.image ?? product.imageUrl ?? product.images?.[0],
        subtitle:
          typeof product.bestTotalPrice === 'number'
            ? `${product.bestTotalPrice} zł`
            : typeof product.bestPrice?.amount === 'number'
              ? `${product.bestPrice.amount} zł`
              : undefined,
      }));
  };

  useEffect(() => {
    if (!mentionContext) {
      setMentionSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      const results = await fetchMentionSuggestions(mentionContext);
      setMentionSuggestions(results);
    }, 200);

    return () => clearTimeout(timer);
  }, [mentionContext]);

  useEffect(() => {
    if (!replyMentionContext) {
      setReplyMentionSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      const results = await fetchMentionSuggestions(replyMentionContext);
      setReplyMentionSuggestions(results);
    }, 200);

    return () => clearTimeout(timer);
  }, [replyMentionContext]);

  const applyMention = (
    value: string,
    setValue: (next: string) => void,
    context: MentionContext,
    suggestion: MentionSuggestion,
    textareaRef?: React.RefObject<HTMLTextAreaElement>
  ) => {
    const mentionText = `@${suggestion.type}:${suggestion.id} `;
    const nextValue = value.slice(0, context.start) + mentionText + value.slice(context.end);
    setValue(nextValue);

    if (textareaRef?.current) {
      const pos = context.start + mentionText.length;
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(pos, pos);
      });
    }
  };

  const fetchThread = async (id: string) => {
    const res = await fetch(`/api/forum/threads/${id}`, { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    return res.ok ? (json.thread as ForumThread) : null;
  };

  const fetchPosts = async (id: string) => {
    const res = await fetch(`/api/forum/threads/${id}/posts?limit=200`, { cache: 'no-store' });
    const json = await res.json().catch(() => ({ posts: [] }));
    return Array.isArray(json?.posts) ? (json.posts as ForumPost[]) : [];
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!threadId) return;
      try {
        const [th, ps, statsRes] = await Promise.all([
          fetchThread(threadId),
          fetchPosts(threadId),
          fetch(`/api/forum/threads/${threadId}/stats`, { cache: 'no-store' })
            .then((res) => res.json())
            .catch(() => ({})),
        ]);
        if (!mounted) return;
        setThread(th);
        setPosts(ps);
        setSavedCount(statsRes?.savedCount || 0);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false };
  }, [threadId]);

  const sendReply = async ({
    content,
    parentId,
    attachments,
  }: {
    content: string;
    parentId?: string | null;
    attachments?: PostAttachment[];
  }) => {
    if (!user || !thread || !content.trim()) return false;
    setSaving(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Brak autoryzacji');

      const response = await fetch(`/api/forum/threads/${thread.id}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content,
          parentId: parentId || null,
          attachments,
          authorDisplayName: user.displayName || user.email,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Nie udało się dodać odpowiedzi');
      }

      const updated = await fetchPosts(thread.id);
      setPosts(updated);
      return true;
    } catch (error: any) {
      console.error('Error adding reply:', error);
      toast.error(error.message || 'Błąd podczas dodawania odpowiedzi');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleReply = async () => {
    const attachments: PostAttachment[] | undefined =
      attType === 'none' || !selectedAttachment
        ? undefined
        : [{ type: attType, id: selectedAttachment.id } as PostAttachment];

    const ok = await sendReply({
      content: reply,
      parentId: null,
      attachments,
    });

    if (ok) {
      setReply('');
      setAttType('none');
      setSelectedAttachment(null);
      setMentionContext(null);
      setMentionSuggestions([]);
    }
  };

  const handleReplyToPost = async (parentId: string) => {
    const ok = await sendReply({
      content: replyToContent,
      parentId,
    });

    if (ok) {
      setReplyToPostId(null);
      setReplyToContent('');
      setReplyMentionContext(null);
      setReplyMentionSuggestions([]);
    }
  };

  if (loading) {
    return <div className="page-container py-6">Ładowanie...</div>;
  }

  if (!thread) {
    return <div className="page-container py-6 text-muted-foreground">Wątek nie istnieje.</div>;
  }

  return (
    <div className="page-container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">{thread.title}</h1>
            {thread.isPinned && (
              <Badge variant="outline" className="gap-1">
                <Pin className="h-3 w-3" />
                Przypięty
              </Badge>
            )}
            {thread.isLocked && (
              <Badge variant="destructive" className="gap-1">
                <Lock className="h-3 w-3" />
                Zablokowany
              </Badge>
            )}
            {savedCount > 0 && (
              <Badge variant="secondary" className="gap-1">
                <Bookmark className="h-3 w-3" />
                {savedCount} {savedCount === 1 ? 'zapis' : 'zapisy'}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            {thread.authorDisplayName || 'Użytkownik'} • {new Date(thread.createdAt).toLocaleString('pl-PL')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={isFavorited ? "default" : "outline"}
            size="sm"
            onClick={toggleFavorite}
            disabled={isFavoriteLoading}
            className={isFavorited ? "gap-1" : "gap-1"}
          >
            <Bookmark className={`h-4 w-4 ${isFavorited ? 'fill-current' : ''}`} />
            {isFavorited ? 'Zapisane' : 'Zapisz'}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/forum">Wróć do forum</Link>
          </Button>
        </div>
      </div>

      {/* Posty */}
      <div className="space-y-4">
        {(() => {
          const postsById = new Map(posts.map((p) => [p.id, p]));
          const childrenByParent = new Map<string | null, ForumPost[]>();

          posts.forEach((p) => {
            const key = p.parentId || null;
            const list = childrenByParent.get(key) || [];
            list.push(p);
            childrenByParent.set(key, list);
          });

          const sortByDate = (a: ForumPost, b: ForumPost) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

          childrenByParent.forEach((list, key) => {
            list.sort(sortByDate);
            childrenByParent.set(key, list);
          });

          const renderPost = (p: ForumPost, depth = 0) => {
            const isBestAnswer = thread.bestAnswerId === p.id;
            const isThreadAuthor = user?.uid === thread.authorUid;
            const isAdmin = user?.role === "admin" || user?.role === "moderator";
            const canMarkBestAnswer = (isThreadAuthor || isAdmin) && !isBestAnswer;
            const parent = p.parentId ? postsById.get(p.parentId) : null;
            const children = childrenByParent.get(p.id) || [];

            return (
              <div key={p.id} className={depth > 0 ? "ml-6 border-l pl-4" : ""}>
                <Card className={isBestAnswer ? "border-green-500 border-2" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <span>{p.authorDisplayName || 'Użytkownik'}</span>
                          {isBestAnswer && (
                            <Badge variant="default" className="gap-1 bg-green-600">
                              <Award className="h-3 w-3" />
                              Najlepsza odpowiedź
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {new Date(p.createdAt).toLocaleString('pl-PL')}
                          {p.isEdited && <span className="ml-2">(edytowany)</span>}
                        </CardDescription>
                        {parent && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Odpowiedź do: {parent.authorDisplayName || 'Użytkownik'}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {canMarkBestAnswer && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={async () => {
                              try {
                                const firebaseUser = auth.currentUser;
                                if (!firebaseUser) {
                                  toast.error("Brak autoryzacji");
                                  return;
                                }

                                const idToken = await firebaseUser.getIdToken();
                                
                                const response = await fetch("/api/forum/best-answer", {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${idToken}`,
                                  },
                                  body: JSON.stringify({
                                    threadId: thread.id,
                                    postId: p.id,
                                  }),
                                });

                                if (!response.ok) {
                                  throw new Error("Błąd oznaczania odpowiedzi");
                                }

                                toast.success("Oznaczono jako najlepszą odpowiedź");
                                
                                const updatedThread = await fetchThread(thread.id);
                                setThread(updatedThread);
                              } catch (error: any) {
                                console.error("Error marking best answer:", error);
                                toast.error(error.message || "Błąd oznaczania odpowiedzi");
                              }
                            }}
                          >
                            <Award className="h-4 w-4" />
                            Najlepsza odpowiedź
                          </Button>
                        )}
                        {!thread.isLocked && (
                          <Button
                            variant={replyToPostId === p.id ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              if (!user) {
                                toast.error("Musisz być zalogowany, aby odpowiedzieć");
                                return;
                              }
                              setReplyToPostId(replyToPostId === p.id ? null : p.id);
                              setReplyToContent('');
                            }}
                          >
                            Odpowiedz
                          </Button>
                        )}
                        {/* Save Post Button */}
                        <SavePostButton postId={p.id} threadId={thread.id} />
                        <PostActions
                          postId={p.id}
                          threadId={thread.id}
                          authorUid={p.authorUid}
                          content={p.content}
                          onUpdate={async () => {
                            const updated = await fetchPosts(thread.id);
                            setPosts(updated);
                          }}
                          onDelete={async () => {
                            const updated = await fetchPosts(thread.id);
                            setPosts(updated);
                          }}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-4">
                    <PostContent content={p.content} attachments={p.attachments} />
                    
                    <div className="flex items-center gap-4 flex-wrap pt-2 border-t">
                      <VoteControls
                        postId={p.id}
                        threadId={thread.id}
                        initialUpvotes={p.upvotes || 0}
                        initialDownvotes={p.downvotes || 0}
                      />
                      <PostReactions
                        postId={p.id}
                        threadId={thread.id}
                        initialReactions={p.reactions}
                      />
                    </div>

                    {replyToPostId === p.id && !thread.isLocked && (
                      <div className="mt-3 space-y-2">
                        <Textarea
                          ref={replyTextareaRef}
                          value={replyToContent}
                          onChange={(e) => {
                            const next = e.target.value;
                            setReplyToContent(next);
                            const cursor = e.target.selectionStart || next.length;
                            setReplyMentionContext(getMentionContext(next, cursor));
                          }}
                          rows={4}
                          placeholder="Napisz odpowiedź do tej wiadomości... (np. @user:uid)"
                        />
                        <MentionSuggestions
                          suggestions={replyMentionSuggestions}
                          onSelect={(item) => {
                            if (!replyMentionContext) return;
                            applyMention(replyToContent, setReplyToContent, replyMentionContext, item, replyTextareaRef);
                            setReplyMentionContext(null);
                            setReplyMentionSuggestions([]);
                          }}
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setReplyToPostId(null);
                              setReplyToContent('');
                              setReplyMentionContext(null);
                              setReplyMentionSuggestions([]);
                            }}
                          >
                            Anuluj
                          </Button>
                          <Button
                            onClick={() => handleReplyToPost(p.id)}
                            disabled={!replyToContent.trim() || saving}
                          >
                            {saving ? 'Wysyłanie...' : 'Wyślij odpowiedź'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {children.length > 0 && (
                  <div className="mt-3 space-y-3">
                    {children.map((child) => renderPost(child, depth + 1))}
                  </div>
                )}
              </div>
            );
          };

          const roots = childrenByParent.get(null) || [];
          return roots.map((p) => renderPost(p, 0));
        })()}
      </div>

      {/* Odpowiedź */}
      {thread.isLocked ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Ten wątek jest zablokowany. Nie możesz dodawać nowych odpowiedzi.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
        <CardHeader>
          <CardTitle>Twoja odpowiedź</CardTitle>
          <CardDescription>
            {user ? 'Dodaj nowy post w wątku' : (
              <span>Musisz być zalogowany aby odpowiedzieć. <Link href="/login" className="underline">Zaloguj się</Link>.</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Textarea 
              ref={mainTextareaRef}
              value={reply} 
              onChange={(e) => {
                const next = e.target.value;
                setReply(next);
                const cursor = e.target.selectionStart || next.length;
                setMentionContext(getMentionContext(next, cursor));
              }} 
              rows={6} 
              placeholder="Napisz odpowiedź... Możesz użyć @deal:id, @product:id lub @user:uid aby oznaczyć użytkownika."
            />
            <p className="text-xs text-muted-foreground">Tip: Użyj @deal:id, @product:id lub @user:uid aby oznaczyć użytkownika i osadzić kartę.</p>
            <MentionSuggestions
              suggestions={mentionSuggestions}
              onSelect={(item) => {
                if (!mentionContext) return;
                applyMention(reply, setReply, mentionContext, item, mainTextareaRef);
                setMentionContext(null);
                setMentionSuggestions([]);
              }}
            />
          </div>
          
          <div className="space-y-3">
            <div className="flex gap-2 items-center">
              <span className="text-sm font-medium">Załącznik:</span>
              <Button 
                variant={attType === 'none' ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => { setAttType('none'); setSelectedAttachment(null); }}
              >
                Brak
              </Button>
              <Button 
                variant={attType === 'deal' ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => { setAttType('deal'); setSelectedAttachment(null); }}
              >
                Okazja
              </Button>
              <Button 
                variant={attType === 'product' ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => { setAttType('product'); setSelectedAttachment(null); }}
              >
                Produkt
              </Button>
            </div>
            
            {attType !== 'none' && (
              <SearchableAttachmentPicker
                type={attType}
                onSelect={(item) => setSelectedAttachment(item)}
                selected={selectedAttachment}
                onClear={() => setSelectedAttachment(null)}
              />
            )}
          </div>
          
          <div className="flex justify-end">
            <Button onClick={handleReply} disabled={!user || saving || !reply.trim()}>
              {saving ? 'Wysyłanie...' : 'Wyślij odpowiedź'}
            </Button>
          </div>
        </CardContent>
        </Card>
      )}
    </div>
  );
}