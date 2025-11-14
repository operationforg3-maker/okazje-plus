"use client";

import { useEffect, useState } from 'react';
import { addForumPost, getForumThread, listForumPosts } from '@/lib/data';
import { ForumPost, ForumThread, PostAttachment } from '@/lib/types';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

function AttachmentRenderer({ attachments }: { attachments?: PostAttachment[] }) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div className="mt-2 flex gap-2 flex-wrap">
      {attachments.map((a, idx) => (
        <Badge key={idx} variant="outline">
          {a.type === 'deal' ? 'Okazja' : 'Produkt'}: {a.id}
        </Badge>
      ))}
    </div>
  );
}

export default function ThreadPage() {
  const params = useParams<{ id: string }>();
  const threadId = params?.id;
  const { user } = useAuth();

  const [thread, setThread] = useState<ForumThread | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);

  const [reply, setReply] = useState('');
  const [attType, setAttType] = useState<'none' | 'deal' | 'product'>('none');
  const [attId, setAttId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!threadId) return;
      try {
        const [th, ps] = await Promise.all([
          getForumThread(threadId),
          listForumPosts(threadId),
        ]);
        if (!mounted) return;
        setThread(th);
        setPosts(ps);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false };
  }, [threadId]);

  const handleReply = async () => {
    if (!user || !thread || !reply.trim()) return;
    setSaving(true);
    try {
      const attachments: PostAttachment[] | undefined = attType === 'none' || !attId.trim() ? undefined : [{ type: attType, id: attId } as PostAttachment];
      await addForumPost({
        threadId: thread.id,
        content: reply,
        attachments,
        authorUid: user.uid,
        authorDisplayName: user.displayName || user.email,
      });
      setReply('');
      setAttType('none');
      setAttId('');
      const updated = await listForumPosts(thread.id);
      setPosts(updated);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="container mx-auto p-6">Ładowanie...</div>;
  }

  if (!thread) {
    return <div className="container mx-auto p-6 text-muted-foreground">Wątek nie istnieje.</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{thread.title}</h1>
          <p className="text-muted-foreground">
            {thread.authorDisplayName || 'Użytkownik'} • {new Date(thread.createdAt).toLocaleString('pl-PL')}
          </p>
        </div>
        <Link href="/forum">
          <Button variant="outline">Wróć do forum</Button>
        </Link>
      </div>

      {/* Posty */}
      <div className="space-y-4">
        {posts.map((p) => (
          <Card key={p.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <span>{p.authorDisplayName || 'Użytkownik'}</span>
                <span className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleString('pl-PL')}</span>
              </CardTitle>
              <CardDescription></CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <div className="whitespace-pre-wrap text-sm leading-6">{p.content}</div>
              <AttachmentRenderer attachments={p.attachments} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Odpowiedź */}
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
          <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={6} placeholder="Napisz odpowiedź..." />
          <div className="flex gap-2 items-center">
            <Button variant={attType === 'none' ? 'default' : 'outline'} size="sm" onClick={() => setAttType('none')}>Brak</Button>
            <Button variant={attType === 'deal' ? 'default' : 'outline'} size="sm" onClick={() => setAttType('deal')}>Okazja</Button>
            <Button variant={attType === 'product' ? 'default' : 'outline'} size="sm" onClick={() => setAttType('product')}>Produkt</Button>
            {attType !== 'none' && (
              <Input value={attId} onChange={(e) => setAttId(e.target.value)} placeholder="ID elementu" className="max-w-xs" />
            )}
            <div className="flex-1" />
            <Button onClick={handleReply} disabled={!user || saving || !reply.trim()}>
              {saving ? 'Wysyłanie...' : 'Wyślij odpowiedź'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
