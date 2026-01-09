'use client';

import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { GalleryItem } from '@/lib/schema';
import { Play, Pause, Volume2, VolumeX, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MediaGalleryProps {
  gallery?: GalleryItem[]; // ProductCore.gallery
  images?: string[]; // ProductCore.images (fallback)
  videoUrl?: string; // ProductCore.videoUrl (fallback)
  productTitle?: string;
}

export function MediaGallery({ gallery, images, videoUrl, productTitle = 'Product' }: MediaGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  // Build gallery from either structured gallery or legacy images/videoUrl
  const galleryItems = gallery || [
    ...(videoUrl ? [{ url: videoUrl, type: 'VIDEO' as const, thumbnail: images?.[0], alt: 'Video' }] : []),
    ...(images || []).map((url, i) => ({ url, type: 'IMAGE' as const, alt: `${productTitle} ${i + 1}` }))
  ];
  
  if (!galleryItems || galleryItems.length === 0) {
    return (
      <div className="w-full aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
        <p className="text-gray-400">Brak zdjęć</p>
      </div>
    );
  }
  
  const activeItem = galleryItems[activeIndex];
  const isVideo = activeItem?.type === 'VIDEO';
  
  return (
    <div className="space-y-4">
      {/* Main View */}
      <div className="relative w-full aspect-square bg-gray-50 rounded-lg overflow-hidden group">
        {isVideo ? (
          <div className="relative w-full h-full">
            <video
              src={activeItem.url}
              poster={activeItem.thumbnail}
              className="w-full h-full object-contain"
              loop
              muted={isMuted}
              autoPlay={isPlaying}
              controls={false}
            />
            
            {/* Video Controls Overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex gap-2">
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="rounded-full"
                >
                  {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                </Button>
                
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={() => setIsMuted(!isMuted)}
                  className="rounded-full"
                >
                  {isMuted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
                </Button>
                
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={() => setLightboxOpen(true)}
                  className="rounded-full"
                >
                  <Maximize2 className="h-6 w-6" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <img
            src={activeItem.url}
            alt={activeItem.alt || productTitle}
            className="w-full h-full object-contain cursor-zoom-in"
            onClick={() => setLightboxOpen(true)}
          />
        )}
      </div>
      
      {/* Thumbnail Strip */}
      {galleryItems.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {galleryItems.map((item, index) => (
            <button
              key={index}
              onClick={() => setActiveIndex(index)}
              className={`
                relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all
                ${activeIndex === index ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200 hover:border-gray-300'}
              `}
            >
              {item.type === 'VIDEO' ? (
                <div className="relative w-full h-full bg-gray-100">
                  <img
                    src={item.thumbnail}
                    alt={`Video ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Play className="h-6 w-6 text-white" fill="white" />
                  </div>
                </div>
              ) : (
                <img
                  src={item.url}
                  alt={item.alt || `${productTitle} ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              )}
            </button>
          ))}
        </div>
      )}
      
      {/* Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0">
          <div className="relative w-full h-[80vh]">
            {isVideo ? (
              <video
                src={activeItem.url}
                poster={activeItem.thumbnail}
                className="w-full h-full object-contain"
                controls
                autoPlay
              />
            ) : (
              <img
                src={activeItem.url}
                alt={activeItem.alt || productTitle}
                className="w-full h-full object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
