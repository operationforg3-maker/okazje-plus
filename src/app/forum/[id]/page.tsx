"use client";

import { useEffect, useState } from 'react';
import { addForumPost, getForumThread, listForumPosts } from '@/lib/data';
import { ForumPost, ForumThread, PostAttachment, Deal, Product } from '@/lib/types';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import { SearchableAttachmentPicker } from '@/components/forum/searchable-attachment-picker';
import { AttachmentCard } from '@/components/forum/attachment-card';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Komponent do parsowania @mentions i renderowania załączników
async function parseMentions(content: string): Promise<{
  text: string;
  mentions: Array<{ type: 'deal' | 'product'; id: string; item?: Deal | Product }>;
}> {
  const mentionRegex = /@(deal|product):([a-zA-Z0-9_-]+)/g;
  const mentions: Array<{ type: 'deal' | 'product'; id: string; item?: Deal | Product }> = [];
  
  const matches = Array.from(content.matchAll(mentionRegex));
  for (const match of matches) {
    const type = match[1] as 'deal' | 'product';
    const id = match[2];
    
    try {
      const collectionName = type === 'deal' ? 'deals' : 'products';
      const docRef = doc(db, collectionName, id);
      const snap = await getDoc(docRef);
      
      if (snap.exists()) {
        mentions.push({
          type,
          id,
          item: { id: snap.id, ...snap.data() } as Deal | Product,
        });
      }
    } catch (error) {
      console.error(`Failed to fetch ${type}:${id}`, error);
    }
  }
  
  const cleanText = content.replace(mentionRegex, '');
  return { text: cleanText, mentions };
}

function PostContent({ content, attachments }: { content: string; attachments?: PostAttachment[] }) {
  const [parsed, setParsed] = useState<{ text: string; mentions: Array<{ type: 'deal' | 'product'; id: string; item?: Deal | Product }> } | null>(null);

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
          {parsed.mentions.map((mention, idx) => 
            mention.item ? (
              <AttachmentCard
                key={`${mention.type}-${mention.id}-${idx}`}
                item={mention.item}
                type={mention.type}
                variant="compact"
              />
            ) : null
          )}
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
    const collectionName = attachment.type === 'deal' ? 'deals' : 'products';
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

export default function ThreadPage() {
  const params = useParams<{ id: string }>();
  const threadId = params?.id;
  const { user } = useAuth();

  const [thread, setThread] = useState<ForumThread | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);

  const [reply, setReply] = useState('');
  const [attType, setAttType] = useState<'none' | 'deal' | 'product'>('none');
  const [selectedAttachment, setSelectedAttachment] = useState<Deal | Product | null>(null);
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
      const attachments: PostAttachment[] | undefined = 
        attType === 'none' || !selectedAttachment 
          ? undefined 
          : [{ type: attType, id: selectedAttachment.id } as PostAttachment];
      
      await addForumPost({
        threadId: thread.id,
        content: reply,
        attachments,
        authorUid: user.uid,
        authorDisplayName: user.displayName || user.email,
      });
      setReply('');
      setAttType('none');
      setSelectedAttachment(null);
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
              <PostContent content={p.content} attachments={p.attachments} />
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
          <div className="space-y-2">
            <Textarea 
              value={reply} 
              onChange={(e) => setReply(e.target.value)} 
              rows={6} 
              placeholder="Napisz odpowiedź... Możesz użyć @deal:id lub @product:id aby osadzić załącznik."
            />
            <p className="text-xs text-muted-foreground">Tip: Użyj @deal:id lub @product:id w treści aby automatycznie osadzić kartę okazji/produktu.</p>
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
    </div>
  );
}
