'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Deal } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ChevronRight, ShoppingCart } from 'lucide-react';
import CommentSection from '@/components/comment-section';
import { VoteControls } from '@/components/vote-controls';

export default function DealDetailPage({ params }: { params: { id: string } }) {
  const [deal, setDeal] = useState<Deal | null>(null);

  useEffect(() => {
    async function fetchDeal() {
      const docRef = doc(db, "deals", params.id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setDeal({ id: docSnap.id, ...docSnap.data() } as Deal);
      } else {
        notFound();
      }
    }
    fetchDeal();
  }, [params.id]);

  if (!deal) {
    return <div>Loading...</div>; // Or a proper loading skeleton
  }

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="mb-6 flex items-center space-x-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-primary">Strona główna</Link>
        <ChevronRight className="h-4 w-4" />
        <Link href="/deals" className="hover:text-primary">Okazje</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-foreground">{deal.title}</span>
      </div>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        <div className="p-4 bg-card rounded-lg shadow-sm flex items-center justify-center">
          <Image
            src={deal.image}
            alt={deal.title}
            width={600}
            height={400}
            className="rounded-lg object-contain max-h-[500px]"
          />
        </div>
        <div className="flex flex-col justify-center">
          <h1 className="font-headline text-3xl font-bold tracking-tight md:text-4xl">
            {deal.title}
          </h1>
          <p className="mt-6 text-base text-muted-foreground leading-relaxed">
            {deal.description}
          </p>
          
          <div className="mt-8 flex items-center gap-4">
            <div>
              <div className="text-4xl font-bold text-primary">
                {deal.price} zł
              </div>
              {deal.originalPrice && <div className="text-xl text-muted-foreground line-through">
                {deal.originalPrice} zł
              </div>}
            </div>
            <VoteControls dealId={deal.id} initialVoteCount={deal.temperature} />
          </div>

          <div className="mt-8 flex gap-4">
            <Button size="lg" asChild className="bg-accent hover:bg-accent/90 flex-1">
              <a href={deal.link} target="_blank" rel="noopener noreferrer">
                <ShoppingCart className="mr-2 h-5 w-5" />
                Przejdź do okazji
              </a>
            </Button>
          </div>
        </div>
      </div>
      
      <CommentSection collectionName="deals" docId={params.id} />
    </div>
  );
}
