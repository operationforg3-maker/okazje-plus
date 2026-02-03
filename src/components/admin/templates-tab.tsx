/**
 * Templates Tab Component for Social Media Admin
 * Manages post templates for different platforms
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { SocialTemplate, SocialPlatform } from '@/lib/types';
import { saveSocialTemplate, deleteSocialTemplate, getPlatformDisplayName } from '@/lib/social-automation';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';

interface TemplatesTabProps {
  templates: SocialTemplate[];
  onUpdate: () => Promise<void>;
}

export function TemplatesTab({ templates, onUpdate }: TemplatesTabProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<SocialTemplate>>({
    name: '',
    platform: 'facebook',
    type: 'deal',
    contentTemplate: '',
    hashtagsTemplate: '',
    imageStyle: 'clean',
  });

  function startCreate() {
    setFormData({
      name: '',
      platform: 'facebook',
      type: 'deal',
      contentTemplate: '',
      hashtagsTemplate: '',
      imageStyle: 'clean',
    });
    setIsCreating(true);
    setEditingId(null);
  }

  function startEdit(template: SocialTemplate) {
    setFormData(template);
    setEditingId(template.id!);
    setIsCreating(false);
  }

  function cancelEdit() {
    setIsCreating(false);
    setEditingId(null);
    setFormData({});
  }

  async function handleSave() {
    try {
      if (!formData.name || !formData.contentTemplate) {
        toast.error('Wypełnij wymagane pola');
        return;
      }

      await saveSocialTemplate(formData as SocialTemplate);
      toast.success('Szablon zapisany');
      await onUpdate();
      cancelEdit();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Błąd zapisywania szablonu');
    }
  }

  async function handleDelete(templateId: string) {
    if (!confirm('Na pewno usunąć szablon?')) return;

    try {
      await deleteSocialTemplate(templateId);
      toast.success('Szablon usunięty');
      await onUpdate();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Błąd usuwania szablonu');
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Szablony Postów</CardTitle>
              <CardDescription>
                Zarządzaj szablonami treści dla różnych platform
              </CardDescription>
            </div>
            {!isCreating && !editingId && (
              <Button onClick={startCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Nowy szablon
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {(isCreating || editingId) && (
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle className="text-base">
                  {isCreating ? 'Nowy szablon' : 'Edytuj szablon'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="template-name">Nazwa szablonu *</Label>
                    <Input
                      id="template-name"
                      placeholder="np. Hot Deal Facebook"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="template-platform">Platforma *</Label>
                    <Select
                      value={formData.platform}
                      onValueChange={(value: SocialPlatform) => setFormData({ ...formData, platform: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="facebook">Facebook</SelectItem>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="twitter">Twitter/X</SelectItem>
                        <SelectItem value="linkedin">LinkedIn</SelectItem>
                        <SelectItem value="tiktok">TikTok</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="template-type">Typ *</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value: 'deal' | 'product' | 'article') => setFormData({ ...formData, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deal">Okazja</SelectItem>
                        <SelectItem value="product">Produkt</SelectItem>
                        <SelectItem value="article">Artykuł</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="template-image-style">Styl obrazu</Label>
                    <Select
                      value={formData.imageStyle}
                      onValueChange={(value) => setFormData({ ...formData, imageStyle: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="clean">Clean (czysty)</SelectItem>
                        <SelectItem value="minimal">Minimal (minimalistyczny)</SelectItem>
                        <SelectItem value="bold">Bold (odważny)</SelectItem>
                        <SelectItem value="gradient">Gradient</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="template-content">Szablon treści *</Label>
                  <Textarea
                    id="template-content"
                    placeholder="Użyj placeholderów: {title}, {description}, {price}, {merchant}, {temperature}, {url}"
                    rows={6}
                    value={formData.contentTemplate || ''}
                    onChange={(e) => setFormData({ ...formData, contentTemplate: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Dostępne zmienne: {'{title}, {description}, {price}, {merchant}, {temperature}, {url}, {category}'}
                  </p>
                </div>

                <div>
                  <Label htmlFor="template-hashtags">Hashtagi (opcjonalne)</Label>
                  <Input
                    id="template-hashtags"
                    placeholder="np. #okazje #promocje #zakupy"
                    value={formData.hashtagsTemplate || ''}
                    onChange={(e) => setFormData({ ...formData, hashtagsTemplate: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Możesz też użyć AI do automatycznego generowania hashtagów
                  </p>
                </div>

                <Separator />

                <div className="flex gap-2">
                  <Button onClick={handleSave}>
                    <Save className="h-4 w-4 mr-2" />
                    Zapisz
                  </Button>
                  <Button onClick={cancelEdit} variant="outline" aria-label="Anuluj edycję">
                    <X className="h-4 w-4 mr-2" />
                    Anuluj
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {templates.length === 0 && !isCreating && !editingId ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Brak szablonów. Utwórz pierwszy szablon.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {templates.map((template) => (
                <Card key={template.id} className="relative">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="secondary">
                            {getPlatformDisplayName(template.platform)}
                          </Badge>
                          <Badge variant="outline">
                            {template.type === 'deal' ? 'Okazja' : template.type === 'product' ? 'Produkt' : 'Artykuł'}
                          </Badge>
                          <Badge variant="outline">
                            {template.imageStyle}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => startEdit(template)}
                          size="sm"
                          variant="outline"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => handleDelete(template.id!)}
                          size="sm"
                          variant="destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Szablon treści:</Label>
                        <div className="mt-1 p-3 bg-muted rounded text-sm font-mono whitespace-pre-wrap">
                          {template.contentTemplate}
                        </div>
                      </div>
                      {template.hashtagsTemplate && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Hashtagi:</Label>
                          <div className="mt-1 text-sm text-blue-600 dark:text-blue-400">
                            {template.hashtagsTemplate}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
