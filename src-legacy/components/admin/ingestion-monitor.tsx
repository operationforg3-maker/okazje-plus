'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Pause,
  Play,
  RefreshCw,
} from 'lucide-react';
import { getHarvesterJobs, getRefinerJobs } from '@/lib/data';

/**
 * IngestionMonitor - Tracks harvester and refiner job progress in real-time
 * Two tabs:
 * - Harvester: Monitor API imports, deduplication, deal creation
 * - Refiner: Monitor AI enrichment progress
 */
export function IngestionMonitor() {
  const [harvesterJobs, setHarvesterJobs] = useState<any[]>([]);
  const [refinerJobs, setRefinerJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('harvester');

  useEffect(() => {
    loadJobs();
    // Poll for updates every 5 seconds
    const interval = setInterval(loadJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadJobs = async () => {
    try {
      const [harvester, refiner] = await Promise.all([
        getHarvesterJobs(10),
        getRefinerJobs(10),
      ]);
      setHarvesterJobs(harvester);
      setRefinerJobs(refiner);
    } catch (error) {
      console.error('Error loading jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Ingestion Monitor</CardTitle>
            <CardDescription>Real-time harvest & enrichment tracking</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadJobs}
            disabled={loading}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="harvester">Harvester</TabsTrigger>
            <TabsTrigger value="refiner">Refiner</TabsTrigger>
          </TabsList>

          {/* HARVESTER TAB */}
          <TabsContent value="harvester" className="space-y-4">
            {harvesterJobs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No harvester jobs yet
              </div>
            ) : (
              harvesterJobs.map((job) => (
                <HarvesterJobCard key={job.id} job={job} />
              ))
            )}
          </TabsContent>

          {/* REFINER TAB */}
          <TabsContent value="refiner" className="space-y-4">
            {refinerJobs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No refiner jobs yet
              </div>
            ) : (
              refinerJobs.map((job) => (
                <RefinerJobCard key={job.id} job={job} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

/**
 * HarvesterJobCard - Single harvester job status
 */
function HarvesterJobCard({ job }: { job: any }) {
  const progress =
    job.productsFound > 0
      ? ((job.productsCreated + job.duplicatesSkipped) / job.productsFound) * 100
      : 0;

  const getStatusIcon = () => {
    switch (job.status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'running':
        return <Clock className="w-5 h-5 text-blue-600" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div>
            <p className="font-semibold">
              {job.source.toUpperCase()} - {job.query}
            </p>
            <p className="text-sm text-gray-500">{job.id}</p>
          </div>
        </div>
        <Badge
          variant={
            job.status === 'completed'
              ? 'default'
              : job.status === 'running'
              ? 'secondary'
              : 'destructive'
          }
        >
          {job.status}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 text-sm">
        <div className="border rounded p-3">
          <p className="text-gray-500">Found</p>
          <p className="text-lg font-semibold">{job.productsFound}</p>
        </div>
        <div className="border rounded p-3">
          <p className="text-gray-500">Created</p>
          <p className="text-lg font-semibold text-green-600">{job.productsCreated}</p>
        </div>
        <div className="border rounded p-3">
          <p className="text-gray-500">Deals</p>
          <p className="text-lg font-semibold text-blue-600">{job.dealsCreated}</p>
        </div>
        <div className="border rounded p-3">
          <p className="text-gray-500">Duplicates</p>
          <p className="text-lg font-semibold text-amber-600">{job.duplicatesSkipped}</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>Progress</span>
          <span className="text-gray-500">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Timeline */}
      <div className="text-xs text-gray-600 space-y-1">
        <p>
          Started: {new Date(job.startedAt).toLocaleString()}
        </p>
        {job.completedAt && (
          <p>
            Completed: {new Date(job.completedAt).toLocaleString()}
          </p>
        )}
      </div>

      {/* Errors */}
      {job.errors && job.errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded p-3">
          <p className="font-semibold text-red-800 text-sm mb-2">
            {job.errors.length} Errors
          </p>
          <div className="space-y-1">
            {job.errors.slice(0, 3).map((error: any, idx: number) => (
              <p key={idx} className="text-xs text-red-700">
                {error.message}
              </p>
            ))}
            {job.errors.length > 3 && (
              <p className="text-xs text-red-600">
                +{job.errors.length - 3} more...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {job.status === 'running' && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline">
            <Pause className="w-4 h-4 mr-2" />
            Pause
          </Button>
          <Button size="sm" variant="outline">
            <AlertCircle className="w-4 h-4 mr-2" />
            View Logs
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * RefinerJobCard - Single refiner job status
 */
function RefinerJobCard({ job }: { job: any }) {
  const progress =
    job.productsProcessed > 0
      ? (job.productsSuccessful / job.productsProcessed) * 100
      : 0;

  const getStatusIcon = () => {
    switch (job.status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'running':
        return <Clock className="w-5 h-5 text-blue-600" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div>
            <p className="font-semibold">
              {job.refinationType.replace(/_/g, ' ').toUpperCase()}
            </p>
            <p className="text-sm text-gray-500">{job.id}</p>
          </div>
        </div>
        <Badge
          variant={
            job.status === 'completed'
              ? 'default'
              : job.status === 'running'
              ? 'secondary'
              : 'destructive'
          }
        >
          {job.status}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="border rounded p-3">
          <p className="text-gray-500">Processed</p>
          <p className="text-lg font-semibold">{job.productsProcessed}</p>
        </div>
        <div className="border rounded p-3">
          <p className="text-gray-500">Success</p>
          <p className="text-lg font-semibold text-green-600">{job.productsSuccessful}</p>
        </div>
        <div className="border rounded p-3">
          <p className="text-gray-500">Failed</p>
          <p className="text-lg font-semibold text-red-600">{job.productsFailed}</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>Success Rate</span>
          <span className="text-gray-500">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Timeline */}
      <div className="text-xs text-gray-600 space-y-1">
        <p>
          Started: {new Date(job.startedAt).toLocaleString()}
        </p>
        {job.completedAt && (
          <p>
            Completed: {new Date(job.completedAt).toLocaleString()}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      {job.status === 'running' && (
        <Button size="sm" variant="outline">
          <Pause className="w-4 h-4 mr-2" />
          Pause
        </Button>
      )}
    </div>
  );
}
