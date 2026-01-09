import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Okazje+ - Najlepsze okazje zakupowe w Polsce';
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 128,
          background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 96,
            fontWeight: 'bold',
            color: 'white',
            marginBottom: 24,
          }}
        >
          Okazje+
        </div>
        <div
          style={{
            fontSize: 36,
            color: 'rgba(255, 255, 255, 0.9)',
          }}
        >
          Najlepsze okazje zakupowe w Polsce
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
