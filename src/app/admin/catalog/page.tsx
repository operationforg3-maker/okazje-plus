'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertCircle,
  CheckCircle,
  Play,
  Loader,
  Download,
  Settings,
} from 'lucide-react';
import { ProductMatchingTable } from '@/components/admin/product-matching-table';
import { IngestionMonitor } from '@/components/admin/ingestion-monitor';

/**
 * Admin Catalog Page - Product-Centric Architecture Control Panel
 * Features:
 * - Product Management (view, merge, delete duplicates)
 * - Harvester Control (trigger imports from AliExpress/Amazon/Allegro)
 * - Refiner Control (trigger AI enrichment)
 * - Real-time job monitoring
 */
export default function AdminCatalogPage() {
  const [activeTab, setActiveTab] = useState('products');
  const [harvesterQuery, setHarvesterQuery] = useState('');
  const [harvesterSource, setHarvesterSource] = useState('aliexpress');
  const [harvesterRunning, setHarvesterRunning] = useState(false);
  const [refinerRunning, setRefinerRunning] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleStartHarvester = async () => {
    if (!harvesterQuery.trim()) {
      setMessage({ type: 'error', text: 'Please enter a search query' });
      return;
    }

    setHarvesterRunning(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/harvester/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: harvesterSource,
          query: harvesterQuery,
          maxResults: 50,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start harvester');
      }

      const data = await response.json();
      setMessage({
        type: 'success',
        text: `Harvester started! Job ID: ${data.job.id}`,
      });
      setHarvesterQuery('');
    } catch (error) {
      setMessage({
        type: 'error',
        text: (error as Error).message,
      });
    } finally {
      setHarvesterRunning(false);
    }
  };

  const handleRefinerPending = async () => {
    setRefinerRunning(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/refiner/pending', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to start refiner');
      }

      const data = await response.json();
      setMessage({
        type: 'success',
        text: `Refiner started! Processing ${data.job.productsProcessed} products.`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: (error as Error).message,
      });
    } finally {
      setRefinerRunning(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Product Catalog Management</h1>
        <p className="text-gray-600">Product-Centric Architecture Control Panel</p>
      </div>

      {/* Status Message */}
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          {message.type === 'error' ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="harvester">Harvester</TabsTrigger>
          <TabsTrigger value="refiner">Refiner</TabsTrigger>
          <TabsTrigger value="monitor">Monitor</TabsTrigger>
        </TabsList>

        {/* PRODUCTS TAB */}
        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Product Database</CardTitle>
              <CardDescription>
                View, manage, and merge products. Products are deduplicated by identity hash (title + image).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Status Filters */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('products')}
                  >
                    All Products
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('products')}
                  >
                    Draft
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('products')}
                  >
                    Pending Approval
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('products')}
                  >
                    Approved
                  </Button>
                </div>

                {/* Product Matching Table */}
                <ProductMatchingTable />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HARVESTER TAB */}
        <TabsContent value="harvester" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Smart Harvester</CardTitle>
              <CardDescription>
                Automatically import products from external sources (AliExpress, Amazon, Allegro).
                Includes deduplication and automatic deal creation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Harvester Controls */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Source Selection */}
                <div>
                  <label className="block text-sm font-medium mb-2">Source</label>
                  <select
                    value={harvesterSource}
                    onChange={(e) => setHarvesterSource(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    disabled={harvesterRunning}
                  >
                    <option value="aliexpress">AliExpress</option>
                    <option value="amazon">Amazon</option>
                    <option value="allegro">Allegro</option>
                  </select>
                </div>

                {/* Search Query */}
                <div>
                  <label className="block text-sm font-medium mb-2">Search Query</label>
                  <Input
                    placeholder="e.g., laptop, headphones, keyboard"
                    value={harvesterQuery}
                    onChange={(e) => setHarvesterQuery(e.target.value)}
                    disabled={harvesterRunning}
                  />
                </div>

                {/* Start Button */}
                <div className="flex items-end">
                  <Button
                    onClick={handleStartHarvester}
                    disabled={harvesterRunning}
                    className="w-full"
                  >
                    {harvesterRunning ? (
                      <>
                        <Loader className="w-4 h-4 mr-2 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Start Harvester
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Info */}
              <div className="bg-blue-50 border border-blue-200 rounded p-4 space-y-2">
                <h4 className="font-semibold text-blue-900">How it works:</h4>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Fetches products from the selected source API</li>
                  <li>Calculates identity hash (normalized title + image hash)</li>
                  <li>
                    If product exists: Creates new deal + updates best price
                  </li>
                  <li>If product new: Creates draft product + deal</li>
                  <li>Draft products require AI enrichment before approval</li>
                </ol>
              </div>

              {/* Deduplication Info */}
              <div className="bg-amber-50 border border-amber-200 rounded p-4">
                <p className="text-sm text-amber-800">
                  <strong>Deduplication:</strong> Products are identified by a hash of their normalized title and primary image.
                  This prevents duplicate products from creating duplicate entries, even if imported multiple times.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* REFINER TAB */}
        <TabsContent value="refiner" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Refiner</CardTitle>
              <CardDescription>
                Automatically enrich draft products with AI-generated content.
                Cleans specs, generates descriptions, and creates review summaries.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Quick Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Button
                  onClick={handleRefinerPending}
                  disabled={refinerRunning}
                  size="lg"
                  variant="default"
                >
                  {refinerRunning ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Refine All Pending Products
                    </>
                  )}
                </Button>

                <Button size="lg" variant="outline" disabled>
                  <Settings className="w-4 h-4 mr-2" />
                  Refinement Settings (Coming Soon)
                </Button>
              </div>

              {/* Refinement Options */}
              <div className="bg-blue-50 border border-blue-200 rounded p-4 space-y-3">
                <h4 className="font-semibold text-blue-900">Refinement Types:</h4>
                <div className="space-y-2 text-sm text-blue-800">
                  <div>
                    <strong>Specs Cleanup:</strong> Normalizes and standardizes product specifications
                  </div>
                  <div>
                    <strong>Description Generation:</strong> Creates multilingual (PL/EN/DE) descriptions
                  </div>
                  <div>
                    <strong>Review Summary:</strong> Generates user sentiment summaries based on ratings
                  </div>
                  <div>
                    <strong>Full Enrichment:</strong> Runs all of the above + calculates quality scores
                  </div>
                </div>
              </div>

              {/* Spec Cleaning Example */}
              <Card className="bg-gray-50">
                <CardHeader>
                  <CardTitle className="text-base">Spec Cleaning Example</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <p className="text-gray-600">Raw Input:</p>
                    <p className="font-mono bg-white p-2 rounded">
                      RAM: "16 GB", storage_type: "SSD", screen size: "15.6 inch"
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Cleaned Output:</p>
                    <p className="font-mono bg-white p-2 rounded">
                      RAM: "16GB", Storage: "SSD", Screen: "15.6\""
                    </p>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MONITOR TAB */}
        <TabsContent value="monitor">
          <IngestionMonitor />
        </TabsContent>
      </Tabs>

      {/* Architecture Info */}
      <Card>
        <CardHeader>
          <CardTitle>Product-Centric Architecture</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ProductCore */}
            <div className="border rounded p-4 space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Badge>ProductCore</Badge>
              </h4>
              <p className="text-sm text-gray-600">
                The immutable product entity - one per unique product
              </p>
              <ul className="text-sm space-y-1 text-gray-700">
                <li>✓ Identity Hash (title + image)</li>
                <li>✓ Standardized Specs</li>
                <li>✓ Multilingual Descriptions</li>
                <li>✓ Ratings & Reviews Summary</li>
                <li>✓ Best Price (calculated)</li>
              </ul>
            </div>

            {/* Deal */}
            <div className="border rounded p-4 space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Badge variant="secondary">Deal</Badge>
              </h4>
              <p className="text-sm text-gray-600">
                The mutable offer entity - multiple per product
              </p>
              <ul className="text-sm space-y-1 text-gray-700">
                <li>✓ Price & Shipping</li>
                <li>✓ Source (AliExpress, Amazon, Allegro)</li>
                <li>✓ Affiliate Link</li>
                <li>✓ Price History (Omnibus compliance)</li>
                <li>✓ Merchant Rating & Stock</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
