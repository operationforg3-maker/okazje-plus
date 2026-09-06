import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

async function generatePWAIcons() {
  const publicDir = path.resolve(__dirname, '../public');
  const svgPath = path.join(publicDir, 'icon_okazjeplus.svg');

  if (!fs.existsSync(svgPath)) {
    console.error('Błąd: Nie znaleziono pliku icon_okazjeplus.svg w folderze public!');
    process.exit(1);
  }

  const svgBuffer = fs.readFileSync(svgPath);

  // Paleta kolorów Okazje+
  const BG_COLOR = { r: 9, g: 13, b: 22, alpha: 1 }; // #090d16

  console.log('Generowanie ikon PWA...');

  // 1. Standardowa ikona 192x192 (Android / PWA)
  const icon192Size = 192;
  const emblem192Size = Math.round(icon192Size * 0.72); // ~138px
  const emblem192 = await sharp(svgBuffer)
    .resize(emblem192Size, emblem192Size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: icon192Size,
      height: icon192Size,
      channels: 4,
      background: BG_COLOR
    }
  })
    .composite([{ input: emblem192, gravity: 'center' }])
    .png()
    .toFile(path.join(publicDir, 'icon-192x192.png'));

  console.log('✓ Wygenerowano: public/icon-192x192.png');

  // 2. Duża ikona 512x512 (Splash screen / PWA / Google Play)
  const icon512Size = 512;
  const emblem512Size = Math.round(icon512Size * 0.72); // ~368px
  const emblem512 = await sharp(svgBuffer)
    .resize(emblem512Size, emblem512Size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: icon512Size,
      height: icon512Size,
      channels: 4,
      background: BG_COLOR
    }
  })
    .composite([{ input: emblem512, gravity: 'center' }])
    .png()
    .toFile(path.join(publicDir, 'icon-512x512.png'));

  console.log('✓ Wygenerowano: public/icon-512x512.png');

  // 3. Ikona Maskable 512x512 (Android Adaptive Icons - safe zone 60% aby krawędzie nie obcięły logo)
  const maskableEmblemSize = Math.round(icon512Size * 0.58); // ~297px (bezpieczna strefa koła/zaokrąglonego kwadratu)
  const emblemMaskable = await sharp(svgBuffer)
    .resize(maskableEmblemSize, maskableEmblemSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: icon512Size,
      height: icon512Size,
      channels: 4,
      background: BG_COLOR
    }
  })
    .composite([{ input: emblemMaskable, gravity: 'center' }])
    .png()
    .toFile(path.join(publicDir, 'icon-maskable-512x512.png'));

  console.log('✓ Wygenerowano: public/icon-maskable-512x512.png (maskable)');

  // 4. Apple Touch Icon 180x180
  const appleIconSize = 180;
  const emblemAppleSize = Math.round(appleIconSize * 0.72);
  const emblemApple = await sharp(svgBuffer)
    .resize(emblemAppleSize, emblemAppleSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: appleIconSize,
      height: appleIconSize,
      channels: 4,
      background: BG_COLOR
    }
  })
    .composite([{ input: emblemApple, gravity: 'center' }])
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));

  console.log('✓ Wygenerowano: public/apple-touch-icon.png');

  // 5. Podmiana bazowego public/icon_okazjeplus.png na wersję wysokiej jakości (512x512)
  await sharp({
    create: {
      width: icon512Size,
      height: icon512Size,
      channels: 4,
      background: BG_COLOR
    }
  })
    .composite([{ input: emblem512, gravity: 'center' }])
    .png()
    .toFile(path.join(publicDir, 'icon_okazjeplus.png'));

  console.log('✓ Zaktualizowano: public/icon_okazjeplus.png');
}

generatePWAIcons().catch((err) => {
  console.error('Błąd podczas generowania ikon:', err);
  process.exit(1);
});
