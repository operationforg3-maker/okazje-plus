'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { withImageProxy } from '@/lib/image-proxy';
import { 
  ChevronLeft, 
  ChevronRight, 
  Flame, 
  Sparkles, 
  ShieldCheck, 
  AlertTriangle, 
  Package, 
  Play 
} from 'lucide-react';

interface GalleryImage {
  id: string;
  src: string;
  alt: string;
}

interface DetailGalleryProps {
  images: GalleryImage[];
  title: string;
  isHot?: boolean;
  isNew?: boolean;
  discount?: number | null;
  verified?: boolean;
  stockAlert?: string | null;
  videoUrl?: string | null;
}

export function DetailGallery({
  images,
  title,
  isHot,
  isNew,
  discount,
  verified,
  stockAlert,
  videoUrl,
}: DetailGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentImage = images && images.length > 0 ? images[currentIndex] : null;

  const nextImage = () => {
    if (!images || images.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    if (!images || images.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <div className="sticky top-20 z-20 space-y-4 self-start">
      {/* Main Image Box */}
      <div className="relative aspect-[4/3] sm:aspect-[16/11] min-h-[340px] sm:min-h-[440px] bg-card rounded-2xl shadow-lg overflow-hidden border border-border/60 group">
          {currentImage ? (
            <Image
              src={withImageProxy(currentImage.src)}
              alt={title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
              className="object-contain p-4 md:p-6 transition-transform duration-500 group-hover:scale-105"
              priority
            />
          ) : (
            <div className="w-full h-full bg-muted/40 flex items-center justify-center">
              <Package className="h-12 w-12 text-muted-foreground/50" />
            </div>
          )}

          {/* Navigation Arrows */}
          {images && images.length > 1 && (
            <>
              <Button
                size="icon"
                variant="secondary"
                className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full shadow-md bg-background/80 hover:bg-background backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={prevImage}
                aria-label="Poprzednie zdjęcie"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full shadow-md bg-background/80 hover:bg-background backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={nextImage}
                aria-label="Następne zdjęcie"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>

              {/* Counter Badge */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/75 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-semibold tracking-wider">
                {currentIndex + 1} / {images.length}
              </div>
            </>
          )}

          {/* Top-Right Badges */}
          <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5 z-10">
            {isHot && (
              <Badge className="bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-md font-bold text-xs px-2.5 py-1">
                <Flame className="mr-1 h-3.5 w-3.5 fill-current" />
                Hot
              </Badge>
            )}
            {isNew && (
              <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md font-bold text-xs px-2.5 py-1">
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                Nowość
              </Badge>
            )}
            {typeof discount === 'number' && discount > 0 && (
              <Badge variant="destructive" className="shadow-md text-sm font-black px-2.5 py-0.5 rounded-lg">
                -{discount}%
              </Badge>
            )}
            {verified && (
              <Badge className="bg-emerald-600 text-white shadow-md font-bold text-xs px-2.5 py-1">
                <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                Zweryfikowane
              </Badge>
            )}
          </div>

          {/* Top-Left Stock Alert */}
          {stockAlert && (
            <Badge
              variant="outline"
              className={`absolute top-4 left-4 shadow-sm backdrop-blur-sm font-bold text-xs px-2.5 py-1 ${
                stockAlert === 'ending-soon'
                  ? 'border-red-500 text-red-600 bg-red-500/10'
                  : stockAlert === 'limited'
                  ? 'border-orange-500 text-orange-600 bg-orange-500/10'
                  : 'border-yellow-500 text-yellow-600 bg-yellow-500/10'
              }`}
            >
              <AlertTriangle className="mr-1 h-3.5 w-3.5" />
              {stockAlert === 'ending-soon'
                ? 'Kończy się'
                : stockAlert === 'limited'
                ? 'Limitowana'
                : 'Niski stan'}
            </Badge>
          )}

          {/* Video Badge */}
          {videoUrl && (
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-4 left-4 z-10 bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg transition-transform hover:scale-105"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Oglądaj wideo</span>
            </a>
          )}
        </div>

        {/* Thumbnail Selector */}
        {images && images.length > 1 && (
          <div className="flex gap-2.5 overflow-x-auto pb-1 pt-1 scrollbar-thin">
            {images.map((img, idx) => (
              <button
                key={img.id || idx}
                onClick={() => setCurrentIndex(idx)}
                className={`relative flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-2 overflow-hidden transition-all duration-200 ${
                  idx === currentIndex
                    ? 'border-primary shadow-md scale-105'
                    : 'border-border/60 hover:border-primary/50 opacity-70 hover:opacity-100'
                }`}
              >
                <Image
                  src={withImageProxy(img.src)}
                  alt={title}
                  fill
                  sizes="80px"
                  className="object-contain p-1.5"
                />
              </button>
            ))}
          </div>
        )}
    </div>
  );
}
