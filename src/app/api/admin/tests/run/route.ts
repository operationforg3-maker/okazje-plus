/**
 * API Endpoint: Uruchomienie testów
 * POST /api/admin/tests/run
 */

import { NextRequest, NextResponse } from 'next/server';
import { runAllTests } from '@/lib/test-service';

export async function POST(request: NextRequest) {
  try {
    // TODO: Add proper admin authentication
    // For now, basic check (should use Firebase Auth + role check)
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🧪 Starting test suite execution...');
    
    // Uruchom wszystkie testy
    const results = await runAllTests();
    
    console.log(`✅ Test suite completed: ${results.passed}/${results.totalTests} passed`);
    
    return NextResponse.json({
      success: true,
      data: results
    });
  } catch (error: any) {
    console.error('❌ Test execution error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Test execution failed', 
        message: error.message 
      },
      { status: 500 }
    );
  }
}

// GET endpoint dla statusu testów (opcjonalnie)
export async function GET() {
  return NextResponse.json({
    message: 'Test endpoint is ready',
    availableTests: {
      technical: [
        'Firestore Connection',
        'Collections Exist',
        'Firestore Indexes'
      ],
      functional: [
        'Deals CRUD Operations',
        'Products CRUD Operations',
        'Comments Counter Accuracy',
        'Voting System Logic',
        'Categories Structure'
      ],
      business: [
        'Approved Content Availability',
        'Moderation Queue Status',
        'User Activity Metrics',
        'Hot Deals Presence',
        'Data Quality Check'
      ]
    }
  });
}
