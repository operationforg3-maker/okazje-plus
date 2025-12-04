'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle, Loader, Play, BarChart3, Zap, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SmartImportResult {
  success: boolean;
  reason?: string;
  qualityScore: number;
  qualityRecommendation: 'publish' | 'reject' | 'manual_review';
  category?: {
    main: string;
    sub: string;
    subsub: string;
    confidence: number;
  };
  generatedContent?: {
    normalizedTitle: string;
    shortDescription: string;
    htmlContent: string;
    marketingTitle: string;
  };
  processingTimeMs: number;
}

export default function SmartImportPage() {
  const [activeTab, setActiveTab] = useState('test');
  const [loading, setLoading] = useState(false);
  const [testRunning, setTestRunning] = useState(false);
  const [result, setResult] = useState<SmartImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [cache, setCache] = useState<any>(null);

  const [formData, setFormData] = useState({
    title: 'Samsung Galaxy S24 Ultra 256GB Smartphone',
    description: 'Latest flagship with 200MP camera, 5000mAh battery, 6.8" display',
    price: 3999,
    originalPrice: 5499,
    shippingCost: 50,
    rating: 4.8,
    soldCount: 1200,
    merchantRating: 98,
    merchant: 'AliExpress Electronics',
    source: 'aliexpress',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: ['price', 'originalPrice', 'shippingCost', 'rating', 'soldCount', 'merchantRating'].includes(name)
        ? parseFloat(value) || 0
        : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/admin/smart-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const runFullTestSuite = async () => {
    setTestRunning(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/smart-import/test', { method: 'POST' });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      setStats(data.stats);
      alert('✅ Test suite completed! Check the logs for detailed results.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTestRunning(false);
    }
  };

  const getStats = async () => {
    try {
      const response = await fetch('/api/admin/smart-import/stats');
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      setStats(data.processingStats);
      setCache(data.cacheStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    }
  };

  const resetStats = async () => {
    try {
      await fetch('/api/admin/smart-import/stats/reset', { method: 'POST' });
      setStats(null);
      setCache(null);
      alert('✅ Statistics reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset stats');
    }
  };

  const clearCache = async () => {
    if (!confirm('Clear cache? This will remove all cached results.')) return;
    try {
      await fetch('/api/admin/smart-import/cache/clear', { method: 'POST' });
      setCache(null);
      alert('✅ Cache cleared');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear cache');
    }
  };

  const testSamples = [
    {
      name: 'iPhone 15 Pro',
      data: {
        title: 'iPhone 15 Pro Max 256GB',
        description: 'Latest Apple flagship with A17 Pro chip, Dynamic Island, titanium design',
        price: 6999,
        originalPrice: 7999,
        shippingCost: 0,
        rating: 4.9,
        soldCount: 5000,
        merchantRating: 99,
        merchant: 'Apple Store',
        source: 'aliexpress',
      },
    },
    {
      name: 'Budget Laptop',
      data: {
        title: 'Budget Laptop 15.6" Intel Celeron 4GB RAM 128GB SSD',
        description: 'Entry-level laptop perfect for students and office work',
        price: 899,
        originalPrice: 1299,
        shippingCost: 100,
        rating: 3.5,
        soldCount: 50,
        merchantRating: 75,
        merchant: 'Generic Seller',
        source: 'aliexpress',
      },
    },
    {
      name: 'Premium Headphones',
      data: {
        title: 'Sony WH-1000XM5 Premium Wireless Headphones',
        description: '30h battery, noise cancellation, premium sound quality',
        price: 1499,
        originalPrice: 1799,
        shippingCost: 0,
        rating: 4.8,
        soldCount: 3000,
        merchantRating: 98,
        merchant: 'Sony Official',
        source: 'aliexpress',
      },
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">🤖 Smart Import Dashboard</h1>
        <p className="text-gray-500 mt-2">Test & optimize the 3 AI Agents pipeline</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="test">Test Pipeline</TabsTrigger>
          <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="test" className="space-y-6 mt-6">
          <div className="grid grid-cols-3 gap-4">
            {testSamples.map((sample) => (
              <Button
                key={sample.name}
                variant="outline"
                onClick={() => {
                  setFormData({ ...sample.data } as any);
                  setResult(null);
                  setError(null);
                }}
                className="justify-start h-auto"
              >
                <span className="text-left">
                  <div className="font-semibold">{sample.name}</div>
                  <div className="text-xs text-gray-500">{sample.data.title.substring(0, 40)}...</div>
                </span>
              </Button>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Product Input</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="source">Source</Label>
                    <select
                      name="source"
                      value={formData.source}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="aliexpress">AliExpress</option>
                      <option value="allegro">Allegro</option>
                      <option value="amazon">Amazon</option>
                      <option value="ebay">eBay</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="price">Price (PLN)</Label>
                    <Input
                      id="price"
                      name="price"
                      type="number"
                      value={formData.price}
                      onChange={handleInputChange}
                      step="0.01"
                    />
                  </div>
                  <div>
                    <Label htmlFor="originalPrice">Original Price</Label>
                    <Input
                      id="originalPrice"
                      name="originalPrice"
                      type="number"
                      value={formData.originalPrice}
                      onChange={handleInputChange}
                      step="0.01"
                    />
                  </div>
                  <div>
                    <Label htmlFor="shippingCost">Shipping Cost</Label>
                    <Input
                      id="shippingCost"
                      name="shippingCost"
                      type="number"
                      value={formData.shippingCost}
                      onChange={handleInputChange}
                      step="0.01"
                    />
                  </div>
                </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label htmlFor="rating">Rating (0-5)</Label>
                <Input
                  id="rating"
                  name="rating"
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  value={formData.rating}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <Label htmlFor="soldCount">Sold Count</Label>
                <Input
                  id="soldCount"
                  name="soldCount"
                  type="number"
                  value={formData.soldCount}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <Label htmlFor="merchantRating">Merchant Rating %</Label>
                <Input
                  id="merchantRating"
                  name="merchantRating"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.merchantRating}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <Label htmlFor="merchant">Merchant</Label>
                <Input
                  id="merchant"
                  name="merchant"
                  value={formData.merchant}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run Smart Import
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <Card className={result.success ? 'border-green-200' : 'border-red-200'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.success ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Import Successful
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  Import Failed
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.reason && <p className="text-red-600">{result.reason}</p>}

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded">
                <h4 className="font-semibold text-sm mb-2">Agent 1: The Ruthless Auditor</h4>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-gray-600">Score:</span>{' '}
                    <span className="font-mono text-lg">
                      {result.qualityScore}/{result.qualityRecommendation === 'publish' ? '100 ✅' : '100'}
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-600">Recommendation:</span>{' '}
                    <span className={`font-semibold ${
                      result.qualityRecommendation === 'publish' ? 'text-green-600' :
                      result.qualityRecommendation === 'reject' ? 'text-red-600' :
                      'text-yellow-600'
                    }`}>
                      {result.qualityRecommendation.toUpperCase()}
                    </span>
                  </p>
                </div>
              </div>

              {result.category && (
                <div className="bg-gray-50 p-4 rounded">
                  <h4 className="font-semibold text-sm mb-2">Agent 3: The Librarian</h4>
                  <div className="space-y-1 text-sm font-mono">
                    <p><span className="text-gray-600">Main:</span> {result.category.main}</p>
                    <p><span className="text-gray-600">Sub:</span> {result.category.sub}</p>
                    <p><span className="text-gray-600">SubSub:</span> {result.category.subsub}</p>
                    <p><span className="text-gray-600">Confidence:</span> {(result.category.confidence * 100).toFixed(0)}%</p>
                  </div>
                </div>
              )}
            </div>

            {result.generatedContent && (
              <div className="bg-blue-50 p-4 rounded">
                <h4 className="font-semibold text-sm mb-2">Agent 2: The Sales Copywriter</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-gray-600">Marketing Title:</p>
                    <p className="font-semibold">{result.generatedContent.marketingTitle}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Short Description:</p>
                    <p className="italic text-gray-700">{result.generatedContent.shortDescription}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">HTML Content:</p>
                    <div
                      className="mt-1 p-2 bg-white rounded border text-xs"
                      dangerouslySetInnerHTML={{ __html: result.generatedContent.htmlContent }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="text-xs text-gray-500">
              Processing time: {result.processingTimeMs}ms
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
