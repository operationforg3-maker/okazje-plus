'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GalleryM6Props {
  images: string[];
  title: string;
}

export default function GalleryM6({ images, title }: GalleryM6Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!images || images.length === 0) {
    return (
      <div className="w-full bg-gray-100 rounded-lg flex items-center justify-center h-96">
        <span className="text-gray-500">Brak zdjęć produktu</span>
      </div>
    );
  }

  const currentImage = images[selectedIndex];
  const hasMultipleImages = images.length > 1;

  const handlePrevious = () => {
    setSelectedIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setSelectedIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handleThumbnailClick = (index: number) => {
    setSelectedIndex(index);
  };

  return (
    <>
      {/* Main Image Viewer */}
      <div className="space-y-4">
        {/* Main Image */}
        <div className="relative w-full bg-gray-100 rounded-lg overflow-hidden group aspect-square md:aspect-auto md:h-96">
          <Image
            src={currentImage}
            alt={`${title} - zdjęcie ${selectedIndex + 1}`}
            fill
            className="object-contain p-4"
            priority={selectedIndex === 0}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            unoptimized
          />

          {/* Zoom Button */}
          <Button
            variant="outline"
            size="icon"
            className="absolute bottom-4 right-4 bg-white hover:bg-gray-50"
            onClick={() => setIsFullscreen(true)}
          >
            <ZoomIn className="w-4 h-4" />
          </Button>

          {/* Navigation Arrows */}
          {hasMultipleImages && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handlePrevious}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleNext}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </>
          )}

          {/* Image Counter */}
          {hasMultipleImages && (
            <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 rounded text-sm">
              {selectedIndex + 1} / {images.length}
            </div>
          )}
        </div>

        {/* Thumbnails */}
        {hasMultipleImages && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {images.map((image, index) => (
              <button
                key={index}
                onClick={() => handleThumbnailClick(index)}
                className={`flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden transition-colors ${
                  selectedIndex === index
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Image
                  src={image}
                  alt={`Miniatury - zdjęcie ${index + 1}`}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-4">
          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={() => setIsFullscreen(false)}
            aria-label="Zamknij galerię"
          >
            <X className="w-6 h-6" />
          </Button>

          {/* Image Container */}
          <div className="relative w-full h-full max-w-4xl max-h-[90vh] flex items-center justify-center">
            <Image
              src={currentImage}
              alt={`${title} - pełny rozmiar`}
              fill
              className="object-contain"
              sizes="100vw"
              unoptimized
            />

            {/* Navigation */}
            {hasMultipleImages && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 text-white hover:bg-white/20"
                  onClick={handlePrevious}
                >
                  <ChevronLeft className="w-8 h-8" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 text-white hover:bg-white/20"
                  onClick={handleNext}
                >
                  <ChevronRight className="w-8 h-8" />
                </Button>

                {/* Image Counter */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded text-sm">
                  {selectedIndex + 1} / {images.length}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
