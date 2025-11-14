/**
 * Price Alert Subscription API Route
 * 
 * POST endpoint for users to subscribe to price alerts.
 * Requires authentication.
 * 
 * @module app/api/alerts/subscribe/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { createAlert } from '@/integrations/alerts/alertsService';
import { isPriceAlertsEnabled } from '@/lib/featureFlags';
import { m6Logger } from '@/lib/logger';
import { z } from 'zod';

/**
 * Request body validation schema
 */
const subscribeSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  targetPrice: z.number().positive('Target price must be positive'),
  condition: z.enum(['below', 'above', 'drops_by_percent', 'any_change']).optional().default('below'),
  percentThreshold: z.number().min(0).max(100).optional(),
  channels: z.array(z.enum(['email', 'web_push', 'in_app'])).optional().default(['in_app']),
});

type SubscribeRequest = z.infer<typeof subscribeSchema>;

/**
 * POST /api/alerts/subscribe
 * 
 * Subscribe to price alerts for a product
 * 
 * Request body:
 * ```json
 * {
 *   "productId": "prod_123",
 *   "targetPrice": 99.99,
 *   "condition": "below",
 *   "channels": ["email", "in_app"]
 * }
 * ```
 * 
 * Response:
 * ```json
 * {
 *   "success": true,
 *   "alertId": "alert_456",
 *   "message": "Alert created successfully"
 * }
 * ```
 */
export async function POST(request: NextRequest) {
  const logger = m6Logger.child({ endpoint: '/api/alerts/subscribe' });
  
  try {
    // Check if feature is enabled
    const isEnabled = await isPriceAlertsEnabled();
    if (!isEnabled) {
      logger.warn('Price alerts feature is disabled');
      return NextResponse.json(
        { 
          success: false,
          error: 'Price alerts feature is currently disabled' 
        },
        { status: 503 }
      );
    }
    
    // Get authentication token from headers
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Missing or invalid authorization header');
      return NextResponse.json(
        { 
          success: false,
          error: 'Authentication required. Please log in.' 
        },
        { status: 401 }
      );
    }
    
    // TODO M6: Implement proper auth verification
    // For now, we'll extract user ID from a custom header or JWT
    // In production, this should verify the Firebase ID token
    
    // Stub: Get user ID from request
    // const auth = getAuth(app);
    // const token = authHeader.substring(7);
    // const decodedToken = await auth.verifyIdToken(token);
    // const userId = decodedToken.uid;
    
    // For now, accept userId from request body (INSECURE - only for M6 bootstrap)
    const body = await request.json();
    const userId = body.userId || 'stub_user_id';
    
    logger.info('Processing alert subscription request', { userId });
    
    // Validate request body
    const validationResult = subscribeSchema.safeParse(body);
    
    if (!validationResult.success) {
      logger.warn('Invalid request body', {
        errors: validationResult.error.errors,
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }
    
    const data = validationResult.data;
    
    // Validate condition-specific requirements
    if (data.condition === 'drops_by_percent' && !data.percentThreshold) {
      return NextResponse.json(
        {
          success: false,
          error: 'percentThreshold is required for drops_by_percent condition',
        },
        { status: 400 }
      );
    }
    
    // Create alert
    const alertId = await createAlert(
      userId,
      data.productId,
      data.targetPrice,
      data.condition,
      data.channels
    );
    
    logger.info('Alert created successfully', {
      alertId,
      userId,
      productId: data.productId,
    });
    
    return NextResponse.json(
      {
        success: true,
        alertId,
        message: 'Alert created successfully',
      },
      { status: 201 }
    );
    
  } catch (error) {
    logger.error('Failed to create alert', {
      error: error instanceof Error ? error.message : String(error),
    });
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create alert. Please try again later.',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/alerts/subscribe
 * 
 * Get user's active alerts
 * 
 * TODO M6: Implement GET endpoint to list user's alerts
 */
export async function GET(request: NextRequest) {
  const logger = m6Logger.child({ endpoint: '/api/alerts/subscribe' });
  
  logger.warn('GET endpoint not yet implemented');
  
  return NextResponse.json(
    {
      success: false,
      error: 'GET endpoint not yet implemented',
      message: 'Use POST to create alerts. Alert management UI coming in M7.',
    },
    { status: 501 }
  );
}

/**
 * DELETE /api/alerts/subscribe
 * 
 * Cancel/delete an alert
 * 
 * TODO M6: Implement DELETE endpoint to cancel alerts
 */
export async function DELETE(request: NextRequest) {
  const logger = m6Logger.child({ endpoint: '/api/alerts/subscribe' });
  
  logger.warn('DELETE endpoint not yet implemented');
  
  return NextResponse.json(
    {
      success: false,
      error: 'DELETE endpoint not yet implemented',
      message: 'Alert cancellation will be available in M7.',
    },
    { status: 501 }
  );
}
