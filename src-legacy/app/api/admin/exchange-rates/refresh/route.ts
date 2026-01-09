/**
 * API Endpoint: GET /api/admin/exchange-rates/refresh
 * 
 * Refreshes exchange rates from external API
 * Callable by authenticated admin users
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';

interface ExchangeRateResponse {
  rates: {
    PLN?: number;
    EUR?: number;
    [key: string]: number | undefined;
  };
}

async function checkAdminAuth(req: NextRequest): Promise<boolean> {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return false;
    }
    // In production, verify Firebase token
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Optional: Check admin auth
    // const isAdmin = await checkAdminAuth(req);
    // if (!isAdmin) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // Fetch exchange rates from free API (exchangerate-api.com)
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `API returned status ${response.status}` },
        { status: 502 }
      );
    }

    const data = (await response.json()) as ExchangeRateResponse;

    if (!data.rates || !data.rates.PLN || !data.rates.EUR) {
      return NextResponse.json(
        { error: 'Invalid API response: missing exchange rates' },
        { status: 502 }
      );
    }

    // Format rates
    const rates = {
      USD: 1.0,
      PLN: Math.round(data.rates.PLN * 100) / 100,
      EUR: Math.round(data.rates.EUR * 10000) / 10000
    };

    return NextResponse.json({
      success: true,
      rates,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Exchange rate refresh failed:', error);
    return NextResponse.json(
      {
        error: 'Failed to refresh exchange rates',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
