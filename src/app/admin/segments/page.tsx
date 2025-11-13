"use client";

export const dynamic = 'force-dynamic';

import { withAuth } from '@/components/auth/withAuth';
import { useEffect, useState } from 'react';
import { getUsersBySegment, getSegmentDistribution, classifyUserSegment } from '@/lib/segmentation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Users, 
  Target, 
  RefreshCw,
  Search,
} from 'lucide-react';
import type { UserSegment } from '@/lib/types';

const SEGMENT_COLORS = {
  price_sensitive: 'bg-red-500',
  fast_delivery: 'bg-blue-500',
  brand_lover: 'bg-purple-500',
  deal_hunter: 'bg-amber-500',
  quality_seeker: 'bg-green-500',
  impulse_buyer: 'bg-pink-500',
};

const SEGMENT_LABELS = {
  price_sensitive: 'Wrażliwi na cenę',
  fast_delivery: 'Szybka dostawa',
  brand_lover: 'Miłośnicy marek',
  deal_hunter: 'Łowcy okazji',
  quality_seeker: 'Poszukiwacze jakości',
  impulse_buyer: 'Impulsywni kupujący',
};

function SegmentsPage() {
  const [loading, setLoading] = useState(true);
  const [distribution, setDistribution] = useState<Record<string, number> | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<UserSegment['segmentType']>('deal_hunter');
  const [segmentUsers, setSegmentUsers] = useState<UserSegment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDistribution();
  }, []);

  useEffect(() => {
    if (selectedSegment) {
      loadSegmentUsers(selectedSegment);
    }
  }, [selectedSegment]);

  const loadDistribution = async () => {
    try {
      setLoading(true);
      const dist = await getSegmentDistribution();
      setDistribution(dist);
    } catch (e: any) {
      setError(e.message || 'Nie udało się pobrać rozkładu segmentów');
    } finally {
      setLoading(false);
    }
  };

  const loadSegmentUsers = async (segmentType: UserSegment['segmentType']) => {
    try {
      const users = await getUsersBySegment(segmentType, 50);
      setSegmentUsers(users);
    } catch (e: any) {
      console.error('Failed to load segment users:', e);
      setSegmentUsers([]);
    }
  };

  const handleReclassifyUser = async (userId: string) => {
    try {
      await classifyUserSegment(userId);
      await loadSegmentUsers(selectedSegment);
      await loadDistribution();
    } catch (e: any) {
      console.error('Failed to reclassify user:', e);
    }
  };

  const filteredUsers = segmentUsers.filter(user =>
    user.userId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalUsers = distribution
    ? Object.values(distribution).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight">🎯 Segmentacja Użytkowników</h2>
        <p className="text-muted-foreground">
          Automatyczna klasyfikacja użytkowników na podstawie zachowań i preferencji
        </p>
      </div>

      {loading && <Badge variant="secondary">Ładowanie...</Badge>}
      {error && <Badge variant="destructive">Błąd: {error}</Badge>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Object.entries(SEGMENT_LABELS).map(([type, label]) => {
          const count = distribution?.[type] || 0;
          const percentage = totalUsers > 0 ? (count / totalUsers) * 100 : 0;
          
          return (
            <Card
              key={type}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedSegment === type ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setSelectedSegment(type as UserSegment['segmentType'])}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{label}</CardTitle>
                <div className={`h-3 w-3 rounded-full ${SEGMENT_COLORS[type as keyof typeof SEGMENT_COLORS]}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{count.toLocaleString('pl-PL')}</div>
                <p className="text-xs text-muted-foreground mt-1">{percentage.toFixed(1)}% użytkowników</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              {SEGMENT_LABELS[selectedSegment]}
            </CardTitle>
            <Button onClick={() => loadSegmentUsers(selectedSegment)} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Odśwież
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Szukaj użytkownika..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Badge variant="secondary">{filteredUsers.length} użytkowników</Badge>
            </div>

            <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <div key={user.userId} className="p-4 flex items-center justify-between hover:bg-muted/50">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{user.userId}</span>
                        <Badge variant="outline" className="text-xs">
                          {(user.confidence * 100).toFixed(0)}% zaufania
                        </Badge>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Aktywność: {user.characteristics.activityLevel}
                        {user.characteristics.avgPricePoint && ` • Śr. cena: ${user.characteristics.avgPricePoint.toFixed(0)} PLN`}
                      </div>
                    </div>
                    <Button onClick={() => handleReclassifyUser(user.userId)} variant="ghost" size="sm">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>Brak użytkowników w tym segmencie</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default withAuth(SegmentsPage);
