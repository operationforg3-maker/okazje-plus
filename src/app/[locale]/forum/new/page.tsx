"use client";

import { withAuth } from '@/components/auth/withAuth';
import { useAuth } from '@/lib/auth';
import { useState } from 'react';
import { listForumCategories } from '@/lib/data';
import { ForumCategory, PostAttachment, Deal, Product } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableAttachmentPicker } from '@/components/forum/searchable-attachment-picker';
import { AttachmentCard } from '@/components/forum/attachment-card';
import { ForumRichEditor } from '@/components/forum/rich-editor';
import { CategorySuggestionDialog } from '@/components/forum/category-suggestion-dialog';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';

function NewThreadPageImpl() {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [attachments, setAttachments] = useState<Array<{ type: 'deal' | 'product'; id: string; item: Deal | Product }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listForumCategories().then(setCategories).catch(() => setCategories([]));
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

      // Call Cloud Function instead of server action
      const createForumThread = httpsCallable(functions, 'createForumThreadCloudFunction');
      const result = await createForumThread({
        title,
        content,
        categoryId: categoryId || undefined,
        attachments: postAttachments,
      });

      const data = result.data as any;
      if (data.success && data.threadId) {
        router.push(`/forum/${data.threadId}`);
      } else {
        throw new Error(data.message || 'Failed to create forum thread');
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
            <CategorySuggestionDialog onSuggestionCreated={() => listForumCategories().then(setCategories)} />
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Tytuł</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="np. Jaki smartfon do 1500 zł w 2025?" />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Kategoria</label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz kategorię (opcjonalnie)" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
