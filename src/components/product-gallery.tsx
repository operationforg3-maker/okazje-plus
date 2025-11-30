import Image from 'next/image';

interface ProductGalleryProps {
  images: { src: string; alt?: string }[];
}

export function ProductGallery({ images }: ProductGalleryProps) {
  const validImages = Array.isArray(images)
    ? images.filter((img): img is { src: string; alt?: string } => typeof img?.src === 'string' && img.src.length > 0)
    : [];
  if (validImages.length === 0) return null;
  // TODO: Zastąpić prostą listę karuzelą (np. Swiper, Embla)
  return (
    <div className="flex gap-2 overflow-x-auto py-2">
      {validImages.map((img, i) => (
        <div key={`gallery-${img.src}-${i}`} className="min-w-[120px] max-w-[200px]">
          <Image
            src={img.src}
            alt={typeof img.alt === 'string' ? img.alt : ''}
            width={200}
            height={200}
            className="rounded border object-cover"
          />
        </div>
      ))}
    </div>
  );
}
