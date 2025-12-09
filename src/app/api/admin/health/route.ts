import { NextResponse } from 'next/server';
import { healthChecks, HealthCheckResult } from '@/lib/health/tests';

export async function GET() {
  const results = await Promise.all(healthChecks.map(check => check()));

  const overallStatus = results.some(r => r.status === 'failed')
    ? 'failed'
    : results.some(r => r.status === 'warning')
    ? 'warning'
    : 'passed';

  return NextResponse.json({
    status: overallStatus,
    results,
  });
}
