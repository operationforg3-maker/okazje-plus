"use client";

import { withAuth } from '@/components/auth/withAuth';
import { useAuth } from '@/lib/auth';
import { useEffect, useState } from 'react';
import { ForumCategory, PostAttachment, Deal, Product } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { SearchableAttachmentPicker } from '@/components/forum/searchable-attachment-picker';
import { AttachmentCard } from '@/components/forum/attachment-card';
import { ForumRichEditor } from '@/components/forum/rich-editor';
import { CategorySuggestionDialog } from '@/components/forum/category-suggestion-dialog';
import { useRouter } from 'next/navigation';

function NewThreadPageImpl() {
  const { user, getIdToken } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [attachments, setAttachments] = useState<Array<{ type: 'deal' | 'product'; id: string; item: Deal | Product }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/forum/categories', { cache: 'no-store' });
        const json = await res.json().catch(() => ({ categories: [] }));
        setCategories(Array.isArray(json?.categories) ? json.categories : []);
      } catch {
        setCategories([]);
      }
    })();
  }, []);

  const handleSubmit = async () => {
    if (!user) return;
    if (!title.trim() || !content.trim()) return;

    setLoading(true);
    try {
      // Filter out any attachments with missing data and create valid PostAttachments
      const validAttachments = attachments
        .filter(att => att.type && att.id) // Ensure both type and id exist
        .map(att => ({ type: att.type, id: att.id } as PostAttachment));

      const postAttachments = validAttachments.length > 0 ? validAttachments : undefined;

      const token = await getIdToken();
      if (!token) throw new Error('Brak autoryzacji');

      const response = await fetch('/api/forum/threads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          content,
          categoryId: categoryId || undefined,
          attachments: postAttachments,
          authorDisplayName: user?.displayName || user?.email || null,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.threadId) {
        router.push(`/forum/${data.threadId}`);
      } else {
        throw new Error(data.error || 'Nie udało się utworzyć wątku');
      }
    } catch (error) {
      console.error('Error creating forum thread:', error);
      alert(`Błąd: ${error instanceof Error ? error.message : 'Nie udało się utworzyć wątku'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAttachmentAdd = (item: Deal | Product, type: 'deal' | 'product') => {
    // Avoid duplicates
    if (attachments.some(att => att.id === item.id)) {
      return;
    }
    setAttachments(prev => [...prev, { type, id: item.id, item }]);
  };

  const handleAttachmentRemove = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };

  return (
    <div className="page-container py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Nowy wątek</h1>
        <p className="text-muted-foreground">Stwórz dyskusję, pytanie lub prezentację produktu/okazji</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Podstawowe informacje</CardTitle>
          <CardDescription className="flex items-center justify-between">
            <span>Uzupełnij tytuł, treść oraz kategorię</span>
            <CategorySuggestionDialog onSuggestionCreated={async () => {
              try {
                const res = await fetch('/api/forum/categories', { cache: 'no-store' });
                const json = await res.json().catch(() => ({ categories: [] }));
                setCategories(Array.isArray(json?.categories) ? json.categories : []);
              } catch {
                setCategories([]);
              }
            }} />
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Tytuł</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="np. Jaki smartfon do 1500 zł w 2025?" />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Kategoria</label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={categoryId === '' ? 'default' : 'outline'}
                onClick={() => setCategoryId('')}
              >
                Bez kategorii
              </Button>
              {categories.map((c) => (
                <Button
                  key={c.id}
                  type="button"
                  size="sm"
                  variant={categoryId === c.id ? 'default' : 'outline'}
                  onClick={() => setCategoryId(c.id)}
                >
                  {c.name}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Kategorie są płaskie — wybierz jedną dla lepszej widoczności wątku.
            </p>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Treść</label>
            <ForumRichEditor
              value={content}
              onChange={setContent}
              attachments={attachments}
              onAttachmentAdd={handleAttachmentAdd}
              onAttachmentRemove={handleAttachmentRemove}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={loading || !title.trim() || !content.trim()}>
          {loading ? 'Zapisywanie...' : 'Utwórz wątek'}
        </Button>
      </div>
    </div>
  );
}

export default withAuth(NewThreadPageImpl);
