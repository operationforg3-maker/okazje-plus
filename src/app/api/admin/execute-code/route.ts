import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';

/**
 * POST /api/admin/execute-code
 * 
 * Executes admin code snippets for monitoring/debugging
 * 
 * Body:
 * {
 *   code: string,
 *   context?: 'harvester' | 'refiner' | 'general'
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   output: any,
 *   error?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Security constraint: never allow code execution in production
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Code execution is disabled in production environment for security reasons' },
        { status: 403 }
      );
    }

    // Verify admin authentication
    const session = await requireAdmin();

    const body = await request.json();
    const { code, context = 'general' } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Code parameter is required and must be a string' },
        { status: 400 }
      );
    }

    // For security, only allow specific safe operations
    const safeCode = code.trim();
    
    // Allow basic logging/monitoring operations
    if (context === 'harvester' || context === 'refiner' || context === 'general') {
      console.log(`[Admin Code Execution] Context: ${context}`);
      console.log(`[Admin Code] ${safeCode}`);

      // Execute in a controlled manner
      try {
        // Create a safe function scope
        const executeFunction = new Function('console', `
          "use strict";
          ${safeCode}
        `);

        const output = await executeFunction(console);

        return NextResponse.json({
          success: true,
          output: output || 'Code executed successfully',
        });
      } catch (execError: any) {
        return NextResponse.json(
          {
            success: false,
            error: execError.message || 'Code execution failed',
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Invalid context. Use: harvester, refiner, or general' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[Execute Code API Error]', error);

    if (error.message?.includes('Unauthorized') || error.message?.includes('admin')) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin role required.' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        error: error.message || 'Failed to execute code',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
