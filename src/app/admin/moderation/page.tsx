'use client';

export const dynamic = 'force-dynamic';

import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckSquare, 
  Clock,
  CheckCircle,
  XCircle,
  Eye
} from 'lucide-react';

function ModerationPage() {
  // Mock data - w rzeczywistości pobieramy z Firestore
  const pendingDeals = [
    { id: '1', title: 'iPhone 15 Pro Max - ekstra cena!', category: 'Elektronika → Smartfony', author: 'user123', date: '2024-11-09', status: 'draft' },
    { id: '2', title: 'Sony WH-1000XM5 promocja', category: 'Elektronika → Audio', author: 'dealhunter', date: '2024-11-09', status: 'draft' },
    { id: '3', title: 'Laptop Dell XPS 13"', category: 'Elektronika → Laptopy', author: 'techfan', date: '2024-11-08', status: 'draft' },
  ];

  const pendingProducts = [
    { id: '1', name: 'MacBook Pro M3', category: 'Elektronika → Laptopy', price: 8999, date: '2024-11-09', status: 'draft' },
    { id: '2', name: 'Samsung Galaxy S24 Ultra', category: 'Elektronika → Smartfony', price: 5499, date: '2024-11-09', status: 'draft' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Panel moderacji</h2>
        <p className="text-muted-foreground">
          Zatwierdzaj i odrzucaj nowe treści
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Do moderacji</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingDeals.length + pendingProducts.length}</div>
            <p className="text-xs text-muted-foreground">
              Oczekuje na akcję
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Zatwierdzone (7 dni)</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">156</div>
            <p className="text-xs text-muted-foreground">
              Ostatnie 7 dni
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Odrzucone (7 dni)</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">
              Ostatnie 7 dni
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Średni czas reakcji</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2.4h</div>
            <p className="text-xs text-muted-foreground">
              Ostatnie 7 dni
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Moderation Queue */}
      <Tabs defaultValue="deals" className="space-y-4">
        <TabsList>
          <TabsTrigger value="deals">
            Okazje ({pendingDeals.length})
          </TabsTrigger>
          <TabsTrigger value="products">
            Produkty ({pendingProducts.length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Zatwierdzone
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Odrzucone
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Okazje oczekujące na moderację</CardTitle>
              <CardDescription>
                Nowe okazje dodane przez użytkowników
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingDeals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Brak okazji do moderacji</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingDeals.map((deal) => (
                    <div key={deal.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{deal.title}</h3>
                          <Badge variant="secondary">{deal.status}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{deal.category}</span>
                          <span>•</span>
                          <span>Dodane przez {deal.author}</span>
                          <span>•</span>
                          <span>{deal.date}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          Podgląd
                        </Button>
                        <Button variant="destructive" size="sm">
                          <XCircle className="h-4 w-4 mr-1" />
                          Odrzuć
                        </Button>
                        <Button variant="default" size="sm">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Zatwierdź
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Produkty oczekujące na moderację</CardTitle>
              <CardDescription>
                Nowe produkty dodane przez administratorów lub import
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingProducts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Brak produktów do moderacji</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingProducts.map((product) => (
                    <div key={product.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{product.name}</h3>
                          <Badge variant="secondary">{product.status}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{product.category}</span>
                          <span>•</span>
                          <span className="font-semibold">{product.price.toLocaleString('pl-PL')} zł</span>
                          <span>•</span>
                          <span>{product.date}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          Podgląd
                        </Button>
                        <Button variant="destructive" size="sm">
                          <XCircle className="h-4 w-4 mr-1" />
                          Odrzuć
                        </Button>
                        <Button variant="default" size="sm">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Zatwierdź
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approved" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ostatnio zatwierdzone</CardTitle>
              <CardDescription>
                Historia zatwierdzonych treści
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Historia zatwierdzonych treści zostanie wyświetlona tutaj
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ostatnio odrzucone</CardTitle>
              <CardDescription>
                Historia odrzuconych treści
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Historia odrzuconych treści zostanie wyświetlona tutaj
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default withAuth(ModerationPage);
