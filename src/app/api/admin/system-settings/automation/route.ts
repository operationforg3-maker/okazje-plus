import { NextResponse } from 'next/server';
import { getAutomationSettings, updateAutomationSettings } from '@/lib/system-settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = await getAutomationSettings();
    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    console.error('[API AutomationSettings] GET Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Nie udało się pobrać ustawień' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { settings, userId } = body;

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Nieprawidłowe dane wejściowe' },
        { status: 400 }
      );
    }

    const updated = await updateAutomationSettings(settings, userId);
    return NextResponse.json({ success: true, settings: updated });
  } catch (error: any) {
    console.error('[API AutomationSettings] POST Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Nie udało się zapisać ustawień' },
      { status: 500 }
    );
  }
}
