"use client";

import { withAuth } from '@/components/auth/withAuth';
import { useAuth } from '@/lib/auth';
import { useState } from 'react';
import { createForumThread, listForumCategories } from '@/lib/data';
import { ForumCategory, PostAttachment } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

function NewThreadPageImpl() {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [attachmentType, setAttachmentType] = useState<'none' | 'deal' | 'product'>('none');
  const [attachmentId, setAttachmentId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listForumCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  const handleSubmit = async () => {
    if (!user) return;
    if (!title.trim() || !content.trim()) return;

    setLoading(true);
    try {
      const attachments: PostAttachment[] | undefined =
        attachmentType === 'none' || !attachmentId.trim()
          ? undefined
          : [{ type: attachmentType, id: attachmentId } as PostAttachment];

      const id = await createForumThread({
        title,
        content,
        categoryId: categoryId || undefined,
        attachments,
        authorUid: user.uid,
        authorDisplayName: user.displayName || user.email,
      });
      router.push(`/forum/${id}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Nowy wątek</h1>
        <p className="text-muted-foreground">Stwórz dyskusję, pytanie lub prezentację produktu/okazji</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Podstawowe informacje</CardTitle>
          <CardDescription>Uzupełnij tytuł, treść oraz kategorię</CardDescription>
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
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={10} placeholder="Opisz problem, temat dyskusji lub zaprezentuj produkt/okazję..." />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Załączniki (opcjonalnie)</CardTitle>
          <CardDescription>Możesz podpiąć istniejący produkt lub okazję</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button variant={attachmentType === 'none' ? 'default' : 'outline'} onClick={() => setAttachmentType('none')}>Brak</Button>
            <Button variant={attachmentType === 'deal' ? 'default' : 'outline'} onClick={() => setAttachmentType('deal')}>Okazja</Button>
            <Button variant={attachmentType === 'product' ? 'default' : 'outline'} onClick={() => setAttachmentType('product')}>Produkt</Button>
          </div>
          {attachmentType !== 'none' && (
            <div className="grid gap-2">
              <label className="text-sm font-medium">ID elementu</label>
              <Input value={attachmentId} onChange={(e) => setAttachmentId(e.target.value)} placeholder="Wpisz ID produktu/okazji" />
              <p className="text-xs text-muted-foreground">W przyszłości dodamy wygodną wyszukiwarkę. Teraz możesz wkleić ID ręcznie.</p>
            </div>
          )}
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
