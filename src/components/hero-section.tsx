import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ArrowRight, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function HeroSection() {
  const heroImage = PlaceHolderImages.find((img) => img.id === 'hero');

  return (
    <section className="relative w-full h-[60vh] md:h-[70vh] flex items-center justify-center text-white">
      {heroImage && (
        <Image
          src={heroImage.imageUrl}
          alt={heroImage.description}
          data-ai-hint={heroImage.imageHint}
          fill
          className="object-cover"
          priority
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent" />
      <div className="absolute inset-0 bg-blue-900/40" />

      <div className="relative container mx-auto px-4 md:px-6 z-10 text-center">
        <h1 className="font-headline text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl !leading-tight">
          🗺️ Odkryj mapę najlepszych okazji w sieci
        </h1>
        <p className="mx-auto mt-4 max-w-[700px] text-lg text-gray-200 md:text-xl">
          Okazje+ to Twoje centrum najlepszych promocji i zniżek. Oszczędzaj na
          ulubionych produktach każdego dnia.
        </p>
        <div className="mt-8 flex w-full max-w-2xl mx-auto flex-col items-center gap-4 sm:flex-row">
            <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Czego dzisiaj szukasz?"
                    className="w-full pl-10 h-12 text-base text-foreground"
                />
            </div>
          <Button size="lg" className="w-full sm:w-auto h-12 bg-accent hover:bg-accent/90">
            Szukaj
          </Button>
        </div>
      </div>
    </section>
  );
}
