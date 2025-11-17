"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Eye, Edit, Sparkles } from "lucide-react";
import { SecretPage, WheelPrize } from "@/lib/types";
import {
  getAllSecretPages,
  createSecretPage,
  updateSecretPage,
  deleteSecretPage,
} from "@/lib/data";

export default function SecretPagesAdmin() {
  const router = useRouter();
  const [pages, setPages] = useState<SecretPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPage, setEditingPage] = useState<SecretPage | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    slug: "",
    title: "",
    description: "",
    heroImage: "",
    heroText: "",
    isActive: true,
    wheelEnabled: true,
    wheelTitle: "Zakręć kołem fortuny!",
    backgroundColor: "#f9fafb",
    textColor: "#111827",
    content: "",
    requiresAuth: false,
  });

  const [wheelPrizes, setWheelPrizes] = useState<WheelPrize[]>([
    {
      id: "1",
      label: "Penis tomka",
      description: "Gratulacje! Wygrałeś główną nagrodę!",
      probability: 10,
      color: "#ff6b6b",
      icon: "🍆",
      isSpecial: true,
    },
    {
      id: "2",
      label: "Zniżka 50%",
      description: "50% zniżki na następne zakupy",
      probability: 20,
      color: "#4ecdc4",
      icon: "🎁",
    },
    {
      id: "3",
      label: "Darmowa dostawa",
      description: "Darmowa dostawa bez limitu",
      probability: 30,
      color: "#45b7d1",
      icon: "🚚",
    },
    {
      id: "4",
      label: "Spróbuj ponownie",
      description: "Następnym razem się uda!",
      probability: 40,
      color: "#95e1d3",
      icon: "🔄",
    },
  ]);

  useEffect(() => {
    loadPages();
  }, []);

  const loadPages = async () => {
    try {
      const data = await getAllSecretPages();
      setPages(data as SecretPage[]);
    } catch (error) {
      console.error("Failed to load pages:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        wheelPrizes,
      };

      if (editingPage) {
        await updateSecretPage(editingPage.id, data);
      } else {
        await createSecretPage(data);
      }

      await loadPages();
      resetForm();
    } catch (error) {
      console.error("Failed to save page:", error);
      alert("Błąd podczas zapisywania strony");
    }
  };

  const handleEdit = (page: SecretPage) => {
    setEditingPage(page);
    setFormData({
      slug: page.slug,
      title: page.title,
      description: page.description || "",
      heroImage: page.heroImage || "",
      heroText: page.heroText || "",
      isActive: page.isActive,
      wheelEnabled: page.wheelEnabled,
      wheelTitle: page.wheelTitle || "Zakręć kołem fortuny!",
      backgroundColor: page.backgroundColor || "#f9fafb",
      textColor: page.textColor || "#111827",
      content: page.content || "",
      requiresAuth: page.requiresAuth || false,
    });
    setWheelPrizes(page.wheelPrizes || []);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć tę stronę?")) return;
    try {
      await deleteSecretPage(id);
      await loadPages();
    } catch (error) {
      console.error("Failed to delete page:", error);
      alert("Błąd podczas usuwania strony");
    }
  };

  const resetForm = () => {
    setEditingPage(null);
    setShowForm(false);
    setFormData({
      slug: "",
      title: "",
      description: "",
      heroImage: "",
      heroText: "",
      isActive: true,
      wheelEnabled: true,
      wheelTitle: "Zakręć kołem fortuny!",
      backgroundColor: "#f9fafb",
      textColor: "#111827",
      content: "",
      requiresAuth: false,
    });
    setWheelPrizes([]);
  };

  const addPrize = () => {
    setWheelPrizes([
      ...wheelPrizes,
      {
        id: Date.now().toString(),
        label: "Nowa nagroda",
        probability: 10,
        color: "#4ecdc4",
        icon: "🎁",
      },
    ]);
  };

  const updatePrize = (index: number, field: keyof WheelPrize, value: any) => {
    const updated = [...wheelPrizes];
    updated[index] = { ...updated[index], [field]: value };
    setWheelPrizes(updated);
  };

  const removePrize = (index: number) => {
    setWheelPrizes(wheelPrizes.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Ładowanie...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Tajne strony promocyjne</h1>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nowa strona
        </Button>
      </div>

      {showForm && (
        <Card className="p-6 mb-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="slug">Slug (URL)</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value })
                  }
                  placeholder="super-okazja-tomek"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  URL: /{formData.slug}
                </p>
              </div>

              <div>
                <Label htmlFor="title">Tytuł</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Super Okazja!"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Opis</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Krótki opis strony"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="heroImage">URL obrazu hero</Label>
                <Input
                  id="heroImage"
                  value={formData.heroImage}
                  onChange={(e) =>
                    setFormData({ ...formData, heroImage: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>

              <div>
                <Label htmlFor="heroText">Tekst hero</Label>
                <Input
                  id="heroText"
                  value={formData.heroText}
                  onChange={(e) =>
                    setFormData({ ...formData, heroText: e.target.value })
                  }
                  placeholder="Wielka promocja!"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isActive: checked })
                  }
                />
                <Label htmlFor="isActive">Strona aktywna</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="wheelEnabled"
                  checked={formData.wheelEnabled}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, wheelEnabled: checked })
                  }
                />
                <Label htmlFor="wheelEnabled">Koło fortuny włączone</Label>
              </div>
            </div>

            {formData.wheelEnabled && (
              <>
                <div>
                  <Label htmlFor="wheelTitle">Tytuł koła fortuny</Label>
                  <Input
                    id="wheelTitle"
                    value={formData.wheelTitle}
                    onChange={(e) =>
                      setFormData({ ...formData, wheelTitle: e.target.value })
                    }
                  />
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      Nagrody
                    </h3>
                    <Button type="button" onClick={addPrize} size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Dodaj
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {wheelPrizes.map((prize, index) => (
                      <div
                        key={prize.id}
                        className="grid grid-cols-6 gap-2 items-center border p-2 rounded"
                      >
                        <Input
                          placeholder="Etykieta"
                          value={prize.label}
                          onChange={(e) =>
                            updatePrize(index, "label", e.target.value)
                          }
                        />
                        <Input
                          placeholder="Ikona"
                          value={prize.icon || ""}
                          onChange={(e) =>
                            updatePrize(index, "icon", e.target.value)
                          }
                          className="text-center"
                        />
                        <Input
                          type="number"
                          placeholder="Prawdop."
                          value={prize.probability}
                          onChange={(e) =>
                            updatePrize(
                              index,
                              "probability",
                              Number(e.target.value)
                            )
                          }
                        />
                        <Input
                          type="color"
                          value={prize.color || "#4ecdc4"}
                          onChange={(e) =>
                            updatePrize(index, "color", e.target.value)
                          }
                        />
                        <Input
                          placeholder="Opis"
                          value={prize.description || ""}
                          onChange={(e) =>
                            updatePrize(index, "description", e.target.value)
                          }
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => removePrize(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <p className="text-sm text-gray-500 mt-2">
                    Suma prawdopodobieństw:{" "}
                    {wheelPrizes.reduce((sum, p) => sum + p.probability, 0)}
                  </p>
                </div>
              </>
            )}

            <div>
              <Label htmlFor="content">Dodatkowa treść (HTML)</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                placeholder="<p>Dodatkowa treść...</p>"
                rows={5}
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit">
                {editingPage ? "Zapisz zmiany" : "Utwórz stronę"}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm}>
                Anuluj
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid gap-4">
        {pages.map((page) => (
          <Card key={page.id} className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-xl font-semibold">{page.title}</h3>
                <p className="text-sm text-gray-600">/{page.slug}</p>
                {page.description && (
                  <p className="text-gray-700 mt-2">{page.description}</p>
                )}
                <div className="flex gap-4 mt-2 text-sm text-gray-500">
                  <span>👁️ {page.stats?.totalViews || 0} wyświetleń</span>
                  <span>🎰 {page.stats?.totalSpins || 0} zakręceń</span>
                  <span>
                    {page.isActive ? (
                      <span className="text-green-600">✓ Aktywna</span>
                    ) : (
                      <span className="text-red-600">✗ Nieaktywna</span>
                    )}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(`/${page.slug}`, "_blank")}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleEdit(page)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(page.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {pages.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Brak tajnych stron. Utwórz pierwszą!</p>
          </div>
        )}
      </div>
    </div>
  );
}
