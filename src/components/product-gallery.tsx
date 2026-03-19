'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { withImageProxy } from '@/lib/image-proxy';

interface ProductGalleryProps {
  images: { src: string; alt?: string }[];
  priority?: boolean;
}

export function ProductGallery({ images, priority = false }: ProductGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const validImages = Array.isArray(images)
    ? images.filter((img): img is { src: string; alt?: string } => typeof img?.src === 'string' && img.src.length > 0)
    : [];
  
  if (validImages.length === 0) return null;

  // Fast path for card thumbnails: avoid carousel state/controls when there is only one image.
  if (validImages.length === 1) {
    const singleImage = {
      ...validImages[0],
      src: withImageProxy(validImages[0].src),
    };

    return (
      <div className="relative w-full">
        <div className="relative w-full aspect-square bg-muted">
          <Image
            src={singleImage.src}
            alt={typeof singleImage.alt === 'string' ? singleImage.alt : 'Zdjęcie produktu'}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-contain"
            priority={priority}
          />
        </div>
      </div>
    );
  }

  const proxiedImages = validImages.map((img) => ({
    ...img,
    src: withImageProxy(img.src),
  }));

  const currentImage = proxiedImages[currentIndex] || proxiedImages[0];
  const hasMultiple = validImages.length > 1;
  
  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? validImages.length - 1 : prev - 1));
  };
  
  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === validImages.length - 1 ? 0 : prev + 1));
  };
  
  const handleThumbnailClick = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex(index);
  };
  
  return (
    <div className="relative w-full">
      {/* Główne zdjęcie */}
      <div className="relative w-full aspect-square bg-muted">
        <Image
          src={currentImage.src}
          alt={typeof currentImage.alt === 'string' ? currentImage.alt : 'Zdjęcie produktu'}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-contain"
          priority={priority && currentIndex === 0}
        />
        
        {/* Nawigacja strzałkami (tylko jeśli jest więcej zdjęć) */}
        {hasMultiple && (
          <>
            <Button
              size="icon"
              variant="ghost"
              className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/60 text-white hover:bg-black/80 hover:text-white"
              onClick={handlePrev}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/60 text-white hover:bg-black/80 hover:text-white"
              onClick={handleNext}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </>
        )}
        
        {/* Licznik zdjęć */}
        {hasMultiple && (
          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
            {currentIndex + 1}/{validImages.length}
          </div>
        )}
      </div>
      
      {/* Miniaturki (tylko jeśli jest więcej niż 1 zdjęcie) */}
      {hasMultiple && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
          {proxiedImages.map((img, index) => (
            <button
              key={index}
              onClick={(e) => handleThumbnailClick(e, index)}
              className={`relative flex-shrink-0 w-16 h-16 rounded border-2 transition-all ${
                index === currentIndex 
                  ? 'border-primary ring-2 ring-primary/20' 
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <Image
                src={img.src}
                alt={typeof img.alt === 'string' ? img.alt : `Miniaturka ${index + 1}`}
                fill
                sizes="64px"
                className="object-contain"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
