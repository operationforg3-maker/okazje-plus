import Image from 'next/image';

interface ProductGalleryProps {
  images: { src: string; alt?: string }[];
}

export function ProductGallery({ images }: ProductGalleryProps) {
  if (!images || images.length === 0) return null;
  // TODO: Zastąpić prostą listę karuzelą (np. Swiper, Embla)
  return (
    <div className="flex gap-2 overflow-x-auto py-2">
      {images.map((img, i) => (
        <div key={`gallery-${img.src}-${i}`} className="min-w-[120px] max-w-[200px]">
          <Image
            src={img.src}
            alt={img.alt || ''}
            width={200}
            height={200}
            className="rounded border object-cover"
          />
        </div>
      ))}
    </div>
  );
}
