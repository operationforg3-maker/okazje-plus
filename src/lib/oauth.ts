/**
 * OAuth Token Management Service (M2)
 * 
 * Handles OAuth2 flow for vendor API authentication including:
 * - Token storage and retrieval
 * - Token refresh logic
 * - Multi-account support
 * - Token expiration handling
 */

import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  Timestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { OAuthToken, OAuthConfig } from './types';
import { logger } from './logging';

/**
 * Get OAuth configuration for a vendor
 */
export async function getOAuthConfig(vendorId: string): Promise<OAuthConfig | null> {
  try {
    const configRef = doc(db, 'oauthConfigs', vendorId);
    const configSnap = await getDoc(configRef);
    
    if (!configSnap.exists()) {
      logger.warn('OAuth config not found', { vendorId });
      return null;
    }
    
    return { id: configSnap.id, ...configSnap.data() } as OAuthConfig;
  } catch (error) {
    logger.error('Failed to get OAuth config', { vendorId, error });
    throw error;
  }
}

/**
 * Store OAuth token in Firestore
 */
export async function storeOAuthToken(token: Omit<OAuthToken, 'id' | 'createdAt' | 'updatedAt'>): Promise<OAuthToken> {
  try {
    const tokenRef = doc(collection(db, 'oauthTokens'));
    const now = new Date().toISOString();
    
    const tokenData: OAuthToken = {
      ...token,
      id: tokenRef.id,
      createdAt: now,
      updatedAt: now,
    };
    
    await setDoc(tokenRef, {
      ...tokenData,
      createdAt: Timestamp.fromDate(new Date(tokenData.createdAt)),
      updatedAt: tokenData.updatedAt ? Timestamp.fromDate(new Date(tokenData.updatedAt)) : Timestamp.now(),
      expiresAt: Timestamp.fromDate(new Date(tokenData.expiresAt)),
      obtainedAt: Timestamp.fromDate(new Date(tokenData.obtainedAt)),
      lastUsedAt: tokenData.lastUsedAt ? Timestamp.fromDate(new Date(tokenData.lastUsedAt)) : null,
      lastRefreshedAt: tokenData.lastRefreshedAt ? Timestamp.fromDate(new Date(tokenData.lastRefreshedAt)) : null,
    });
    
    logger.info('OAuth token stored', {
      tokenId: tokenData.id,
      vendorId: token.vendorId,
      accountName: token.accountName,
    });
    
    return tokenData;
  } catch (error) {
    logger.error('Failed to store OAuth token', { error });
    throw error;
  }
}

/**
 * Get active OAuth token for a vendor
 * Returns the most recently used active token
 */
export async function getActiveToken(vendorId: string, accountName?: string): Promise<OAuthToken | null> {
  try {
    let q = query(
      collection(db, 'oauthTokens'),
      where('vendorId', '==', vendorId),
      where('status', '==', 'active'),
      orderBy('lastUsedAt', 'desc'),
      limit(1)
    );
    
    if (accountName) {
      q = query(
        collection(db, 'oauthTokens'),
        where('vendorId', '==', vendorId),
        where('accountName', '==', accountName),
        where('status', '==', 'active'),
        orderBy('lastUsedAt', 'desc'),
        limit(1)
      );
    }
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      logger.warn('No active token found', { vendorId, accountName });
      return null;
    }
    
    const tokenDoc = snapshot.docs[0];
    const tokenData = tokenDoc.data();
    
    return {
      id: tokenDoc.id,
      ...tokenData,
      createdAt: tokenData.createdAt.toDate().toISOString(),
      updatedAt: tokenData.updatedAt?.toDate().toISOString(),
      expiresAt: tokenData.expiresAt.toDate().toISOString(),
      obtainedAt: tokenData.obtainedAt.toDate().toISOString(),
      lastUsedAt: tokenData.lastUsedAt?.toDate().toISOString(),
      lastRefreshedAt: tokenData.lastRefreshedAt?.toDate().toISOString(),
    } as OAuthToken;
  } catch (error) {
    logger.error('Failed to get active token', { vendorId, accountName, error });
    throw error;
  }
}

/**
 * Get all tokens for a vendor (for multi-account support)
 */
export async function getAllTokens(vendorId: string): Promise<OAuthToken[]> {
  try {
    const q = query(
      collection(db, 'oauthTokens'),
      where('vendorId', '==', vendorId),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt.toDate().toISOString(),
        updatedAt: data.updatedAt?.toDate().toISOString(),
        expiresAt: data.expiresAt.toDate().toISOString(),
        obtainedAt: data.obtainedAt.toDate().toISOString(),
        lastUsedAt: data.lastUsedAt?.toDate().toISOString(),
        lastRefreshedAt: data.lastRefreshedAt?.toDate().toISOString(),
      } as OAuthToken;
    });
  } catch (error) {
    logger.error('Failed to get all tokens', { vendorId, error });
    throw error;
  }
}

/**
 * Check if token is expired or about to expire (within 5 minutes)
 */
export function isTokenExpired(token: OAuthToken, bufferMinutes: number = 5): boolean {
  const expiresAt = new Date(token.expiresAt).getTime();
  const now = Date.now();
  const bufferMs = bufferMinutes * 60 * 1000;
  
  return now >= (expiresAt - bufferMs);
}

/**
 * Refresh OAuth token
 * 
 * @param tokenId - ID of the token to refresh
 * @param refreshToken - Refresh token (if not stored in token record)
 * @returns Updated token
 */
export async function refreshOAuthToken(
  tokenId: string,
  refreshTokenOverride?: string
): Promise<OAuthToken> {
  try {
    const tokenRef = doc(db, 'oauthTokens', tokenId);
    const tokenSnap = await getDoc(tokenRef);
    
    if (!tokenSnap.exists()) {
      throw new Error(`Token ${tokenId} not found`);
    }
    
    const token = {
      id: tokenSnap.id,
      ...tokenSnap.data(),
    } as OAuthToken;
    
    const refreshToken = refreshTokenOverride || token.refreshToken;
    
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    
    // Get OAuth config for the vendor
    const config = await getOAuthConfig(token.vendorId);
    if (!config) {
      throw new Error(`OAuth config not found for vendor ${token.vendorId}`);
    }
    
    logger.info('Refreshing OAuth token', { tokenId, vendorId: token.vendorId });
    
    // Make token refresh request
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Token refresh failed', {
        status: response.status,
        error: errorText,
      });
      
      // Mark token as expired if refresh fails
      await updateDoc(tokenRef, {
        status: 'expired',
        updatedAt: Timestamp.now(),
      });
      
      throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
    }
    
    const refreshData = await response.json();
    
    // Calculate new expiration time
    const expiresInSeconds = refreshData.expires_in || 3600;
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    
    // Update token in Firestore
    const now = new Date();
    await updateDoc(tokenRef, {
      accessToken: refreshData.access_token,
      refreshToken: refreshData.refresh_token || refreshToken, // Keep old if not provided
      expiresAt: Timestamp.fromDate(expiresAt),
      lastRefreshedAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
      status: 'active',
    });
    
    logger.info('OAuth token refreshed successfully', {
      tokenId,
      expiresAt: expiresAt.toISOString(),
    });
    
    // Return updated token
    return {
      ...token,
      accessToken: refreshData.access_token,
      refreshToken: refreshData.refresh_token || refreshToken,
      expiresAt: expiresAt.toISOString(),
      lastRefreshedAt: now.toISOString(),
      updatedAt: now.toISOString(),
      status: 'active',
    };
  } catch (error) {
    logger.error('Failed to refresh token', { tokenId, error });
    throw error;
  }
}

/**
 * Revoke OAuth token
 * Marks token as revoked and attempts to revoke with provider
 */
export async function revokeOAuthToken(tokenId: string): Promise<void> {
  try {
    const tokenRef = doc(db, 'oauthTokens', tokenId);
    const tokenSnap = await getDoc(tokenRef);
    
    if (!tokenSnap.exists()) {
      throw new Error(`Token ${tokenId} not found`);
    }
    
    const token = {
      id: tokenSnap.id,
      ...tokenSnap.data(),
    } as OAuthToken;
    
    logger.info('Revoking OAuth token', { tokenId, vendorId: token.vendorId });
    
    // Get OAuth config
    const config = await getOAuthConfig(token.vendorId);
    
    // Attempt to revoke with provider if revocation endpoint is available
    if (config && config.tokenUrl) {
      try {
        // Most OAuth providers support token revocation
        const revokeUrl = config.tokenUrl.replace('/token', '/revoke');
        
        await fetch(revokeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            token: token.accessToken,
            token_type_hint: 'access_token',
            client_id: config.clientId,
            client_secret: config.clientSecret,
          }),
        });
        
        logger.info('Token revoked with provider', { tokenId });
      } catch (error) {
        logger.warn('Failed to revoke token with provider (continuing with local revocation)', {
          tokenId,
          error,
        });
      }
    }
    
    // Mark as revoked in Firestore
    await updateDoc(tokenRef, {
      status: 'revoked',
      updatedAt: Timestamp.now(),
    });
    
    logger.info('OAuth token revoked successfully', { tokenId });
  } catch (error) {
    logger.error('Failed to revoke token', { tokenId, error });
    throw error;
  }
}

/**
 * Get valid token, refreshing if necessary
 * This is the main method to use when you need a token for API calls
 */
export async function getValidToken(
  vendorId: string,
  accountName?: string
): Promise<OAuthToken | null> {
  try {
    const token = await getActiveToken(vendorId, accountName);
    
    if (!token) {
      logger.warn('No token available', { vendorId, accountName });
      return null;
    }
    
    // Check if token is expired or about to expire
    if (isTokenExpired(token)) {
      logger.info('Token expired, refreshing', { tokenId: token.id });
      
      try {
        const refreshedToken = await refreshOAuthToken(token.id);
        
        // Update last used timestamp
        await updateDoc(doc(db, 'oauthTokens', refreshedToken.id), {
          lastUsedAt: Timestamp.now(),
        });
        
        return refreshedToken;
      } catch (error) {
        logger.error('Token refresh failed', { tokenId: token.id, error });
        return null;
      }
    }
    
    // Update last used timestamp
    await updateDoc(doc(db, 'oauthTokens', token.id), {
      lastUsedAt: Timestamp.now(),
    });
    
    return token;
  } catch (error) {
    logger.error('Failed to get valid token', { vendorId, accountName, error });
    throw error;
  }
}

/**
 * Exchange authorization code for access token
 * This is called from the OAuth callback handler
 */
export async function exchangeCodeForToken(
  vendorId: string,
  code: string,
  createdBy: string,
  accountName?: string,
  metadata?: OAuthToken['metadata']
): Promise<OAuthToken> {
  try {
    const config = await getOAuthConfig(vendorId);
    if (!config) {
      throw new Error(`OAuth config not found for vendor ${vendorId}`);
    }
    
    logger.info('Exchanging authorization code for token', { vendorId });
    
    // Exchange code for token
    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Token exchange failed', {
        status: response.status,
        error: errorText,
      });
      throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
    }
    
    const tokenData = await response.json();
    
    // Calculate expiration time
    const expiresInSeconds = tokenData.expires_in || 3600;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInSeconds * 1000);
    
    // Store token in Firestore
    const token = await storeOAuthToken({
      vendorId,
      accountName: accountName || 'default',
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenType: tokenData.token_type || 'Bearer',
      expiresAt: expiresAt.toISOString(),
      obtainedAt: now.toISOString(),
      scope: tokenData.scope ? tokenData.scope.split(' ') : config.scope,
      status: 'active',
      createdBy,
      metadata: {
        ...metadata,
        authorizationCode: code,
      },
    });
    
    logger.info('Token obtained and stored successfully', {
      tokenId: token.id,
      vendorId,
      expiresAt: expiresAt.toISOString(),
    });
    
    return token;
  } catch (error) {
    logger.error('Failed to exchange code for token', { vendorId, error });
    throw error;
  }
}

/**
 * Generate OAuth authorization URL
 */
export function generateAuthorizationUrl(
  config: OAuthConfig,
  state?: string
): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scope.join(' '),
    state: state || Math.random().toString(36).substring(7),
  });
  
  return `${config.authorizationUrl}?${params.toString()}`;
}
