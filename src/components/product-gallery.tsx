import Image from 'next/image';

interface ProductGalleryProps {
  images: { src: string; alt?: string }[];
}

export function ProductGallery({ images }: ProductGalleryProps) {
  const validImages = Array.isArray(images)
    ? images.filter((img): img is { src: string; alt?: string } => typeof img?.src === 'string' && img.src.length > 0)
    : [];
  
  if (validImages.length === 0) return null;
  
  // Pokazujemy pierwsze zdjęcie w pełnym rozmiarze
  const mainImage = validImages[0];
  
  return (
    <div className="relative w-full aspect-square bg-muted">
      <Image
        src={mainImage.src}
        alt={typeof mainImage.alt === 'string' ? mainImage.alt : 'Zdjęcie produktu'}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        className="object-contain"
        priority
      />
      {/* Badge z liczbą zdjęć jeśli jest więcej niż 1 */}
      {validImages.length > 1 && (
        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
          1/{validImages.length}
        </div>
      )}
    </div>
  );
}
