'use client';

/**
 * OAuth Settings & Token Management Page (M2)
 * 
 * Admin interface for managing OAuth configurations and tokens
 * - View OAuth tokens for each vendor
 * - Authorize new accounts
 * - Revoke existing tokens
 * - Multi-account support
 */

export const dynamic = 'force-dynamic';

import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Key,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  Trash2,
  Plus,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { OAuthToken } from '@/lib/types';

interface TokenDisplay {
  id: string;
  vendorId: string;
  accountName?: string;
  tokenType: string;
  status: 'active' | 'expired' | 'revoked';
  expiresAt: string;
  obtainedAt: string;
  lastUsedAt?: string;
  lastRefreshedAt?: string;
  scope?: string[];
  createdAt: string;
  createdBy: string;
}

function OAuthSettingsPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [tokens, setTokens] = useState<TokenDisplay[]>([]);
  const [processingTokenId, setProcessingTokenId] = useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<string>('aliexpress');

  useEffect(() => {
    // Check for OAuth callback status
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (success === 'true') {
      const vendorId = searchParams.get('vendorId');
      const accountName = searchParams.get('accountName');
      
      toast({
        title: 'OAuth Authorized Successfully',
        description: `Token for ${accountName || 'default'} account on ${vendorId} obtained.`,
      });
      
      // Clear URL parameters
      window.history.replaceState({}, '', '/admin/settings/oauth');
    }

    if (error) {
      toast({
        title: 'OAuth Authorization Failed',
        description: errorDescription || error,
        variant: 'destructive',
      });
      
      // Clear URL parameters
      window.history.replaceState({}, '', '/admin/settings/oauth');
    }

    fetchTokens();
  }, [searchParams, toast]);

  const fetchTokens = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/oauth/tokens?vendorId=${selectedVendor}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch tokens');
      }
      
      const data = await response.json();
      setTokens(data.tokens || []);
    } catch (error) {
      console.error('Error fetching tokens:', error);
      toast({
        title: 'Error',
        description: 'Failed to load OAuth tokens',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAuthorize = (accountName?: string) => {
    const params = new URLSearchParams({
      vendorId: selectedVendor,
    });
    
    if (accountName) {
      params.set('accountName', accountName);
    }
    
    window.location.href = `/api/admin/oauth/authorize?${params.toString()}`;
  };

  const handleRevoke = async (tokenId: string) => {
    if (!confirm('Are you sure you want to revoke this token? This action cannot be undone.')) {
      return;
    }

    setProcessingTokenId(tokenId);
    try {
      const response = await fetch('/api/admin/oauth/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to revoke token');
      }

      toast({
        title: 'Success',
        description: 'Token revoked successfully',
      });

      // Refresh token list
      await fetchTokens();
    } catch (error) {
      console.error('Error revoking token:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to revoke token',
        variant: 'destructive',
      });
    } finally {
      setProcessingTokenId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case 'expired':
        return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />Expired</Badge>;
      case 'revoked':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Revoked</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pl-PL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isExpiringSoon = (expiresAt: string) => {
    const expires = new Date(expiresAt).getTime();
    const now = Date.now();
    const hoursUntilExpiry = (expires - now) / (1000 * 60 * 60);
    
    return hoursUntilExpiry < 24 && hoursUntilExpiry > 0;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">OAuth & Token Management</h2>
        <p className="text-muted-foreground">
          Manage OAuth tokens for API vendors
        </p>
      </div>

      {/* Vendor Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Vendor</CardTitle>
          <CardDescription>
            Choose a vendor to manage OAuth tokens
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant={selectedVendor === 'aliexpress' ? 'default' : 'outline'}
              onClick={() => {
                setSelectedVendor('aliexpress');
                fetchTokens();
              }}
            >
              AliExpress
            </Button>
            {/* Add more vendors here */}
          </div>
        </CardContent>
      </Card>

      {/* Tokens List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>OAuth Tokens</CardTitle>
            <CardDescription>
              Active and inactive tokens for {selectedVendor}
            </CardDescription>
          </div>
          <Button onClick={() => handleAuthorize()}>
            <Plus className="h-4 w-4 mr-2" />
            Authorize New Account
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : tokens.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Key className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">No OAuth tokens found</p>
              <p className="text-sm mb-4">
                Authorize a new account to connect to {selectedVendor}
              </p>
              <Button onClick={() => handleAuthorize()}>
                <Plus className="h-4 w-4 mr-2" />
                Authorize Account
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {tokens.map((token) => (
                <div
                  key={token.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">
                        {token.accountName || 'Default Account'}
                      </h3>
                      {getStatusBadge(token.status)}
                      {token.status === 'active' && isExpiringSoon(token.expiresAt) && (
                        <Badge variant="outline" className="text-orange-600 border-orange-600">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Expiring Soon
                        </Badge>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                      <div>
                        <span className="font-medium">Token Type:</span> {token.tokenType}
                      </div>
                      <div>
                        <span className="font-medium">Obtained:</span> {formatDate(token.obtainedAt)}
                      </div>
                      <div>
                        <span className="font-medium">Expires:</span> {formatDate(token.expiresAt)}
                      </div>
                      {token.lastUsedAt && (
                        <div>
                          <span className="font-medium">Last Used:</span> {formatDate(token.lastUsedAt)}
                        </div>
                      )}
                      {token.lastRefreshedAt && (
                        <div>
                          <span className="font-medium">Last Refreshed:</span> {formatDate(token.lastRefreshedAt)}
                        </div>
                      )}
                      {token.scope && token.scope.length > 0 && (
                        <div className="col-span-2">
                          <span className="font-medium">Scopes:</span> {token.scope.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    {token.status === 'active' && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={processingTokenId === token.id}
                        title="Token will be automatically refreshed when needed"
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Auto-Refresh
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRevoke(token.id)}
                      disabled={processingTokenId === token.id || token.status === 'revoked'}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Revoke
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>OAuth Configuration</CardTitle>
          <CardDescription>
            How to configure OAuth for vendors
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-semibold">AliExpress OAuth Setup</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              <li>Register your application on AliExpress Open Platform</li>
              <li>Configure redirect URI: <code className="bg-muted px-1 py-0.5 rounded">/api/admin/oauth/callback</code></li>
              <li>Add OAuth configuration to Firestore <code className="bg-muted px-1 py-0.5 rounded">oauthConfigs</code> collection</li>
              <li>Click "Authorize New Account" to start OAuth flow</li>
            </ol>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-semibold">Multi-Account Support</h4>
            <p className="text-sm text-muted-foreground">
              You can authorize multiple accounts for the same vendor. Each account can have its own token
              and be used for different import profiles. This is useful for managing multiple stores or
              testing different configurations.
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-semibold">Token Refresh</h4>
            <p className="text-sm text-muted-foreground">
              Tokens are automatically refreshed when they expire. The system checks token expiration
              before each API call and refreshes as needed. You don't need to manually refresh tokens.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default withAuth(OAuthSettingsPage);
