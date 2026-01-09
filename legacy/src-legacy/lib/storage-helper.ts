/**
 * Helper do pobierania i przechowywania obrazów produktów w Firebase Storage.
 * Obsługuje pobieranie zdalnych obrazów i przesyłanie do skonfigurowanego bucket'a.
 */

import { getStorage, ref, uploadBytes } from 'firebase/storage';
import { app } from './firebase';

export type ImageUploadResult = {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
};

/**
 * Pobiera obraz ze zdalnego URL i przesyła go do Firebase Storage.
 * @param remoteUrl URL zdalnego obrazu
 * @param storagePath Ścieżka w Storage (np. 'products/product-123/image.jpg')
 * @returns Obiektu z wynikiem (URL lub błąd)
 */
export async function uploadRemoteImage(
  remoteUrl: string,
  storagePath: string
): Promise<ImageUploadResult> {
  try {
    if (!remoteUrl || !storagePath) {
      return { success: false, error: 'Missing remoteUrl or storagePath' };
    }

    // Pobierz obraz ze zdalnego URL
    const response = await fetch(remoteUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OkazjePlusBot/1.0)'
      }
    });

    if (!response.ok) {
      return { success: false, error: `Failed to fetch image: ${response.status}` };
    }

    const blob = await response.blob();

    // Przesyłanie do Firebase Storage
    const storage = getStorage(app);
    const fileRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(fileRef, blob, {
      contentType: blob.type || 'image/jpeg'
    });

    // Pobierz publicURL (w produkcji może wymagać logiki dostępu)
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${snapshot.ref.bucket}/o/${encodeURIComponent(snapshot.ref.fullPath)}?alt=media`;

    return { success: true, url: publicUrl, path: snapshot.ref.fullPath };
  } catch (err: any) {
    console.error('Image upload failed:', err);
    return {
      success: false,
      error: err?.message || 'Unknown error during image upload'
    };
  }
}

/**
 * Generuje bezpieczną ścieżkę do Storage dla produktu AliExpress.
 * @param externalId ID produktu na AliExpress
 * @param filename Nazwa pliku (np. image.jpg)
 * @returns Ścieżka w Storage
 */
export function generateStoragePath(externalId: string, filename: string = 'image.jpg'): string {
  const timestamp = Date.now();
  return `aliexpress-products/${externalId}/${timestamp}-${filename}`;
}
