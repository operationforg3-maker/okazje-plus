import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Nieprawidłowy adres email' },
        { status: 400 }
      );
    }

    // TODO: Integrate with newsletter service (SendGrid, Mailchimp, etc.)
    // For now, just log it
    console.log('Newsletter subscription:', email);

    return NextResponse.json({ 
      success: true,
      message: 'Dziękujemy za zapisanie się!' 
    });
  } catch (error) {
    console.error('Newsletter subscription error:', error);
    return NextResponse.json(
      { error: 'Wystąpił błąd. Spróbuj ponownie.' },
      { status: 500 }
    );
  }
}
