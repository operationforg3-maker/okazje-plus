import { getTranslations, setRequestLocale } from 'next-intl/server';
import { adminDb } from '@/lib/firebase-admin';
import { Article } from '@/lib/types';
import Link from 'next/link';
import Image from 'next/image';
import { Clock, User } from 'lucide-react';
import { Metadata } from 'next';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { locale: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const t = await getTranslations({ locale: resolvedParams.locale, namespace: 'common' });
  
  return {
    title: `Blog | Okazje+`,
    description: 'Najnowsze poradniki, testy i zestawienia ofert na Okazje+',
  };
}

async function getArticles(): Promise<Article[]> {
  try {
    const snap = await adminDb
      .collection('articles')
      .where('status', '==', 'published')
      .orderBy('publishedAt', 'desc')
      .limit(20)
      .get();
      
    return snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
      } as Article;
    });
  } catch (error) {
    console.error('Error fetching articles:', error);
    return [];
  }
}

export default async function BlogPage({ params }: PageProps) {
  const resolvedParams = await params;
  setRequestLocale(resolvedParams.locale);
  const locale = resolvedParams.locale as 'pl' | 'en' | 'de';
  
  const articles = await getArticles();
  
  return (
    <div className="page-container py-8 max-w-6xl mx-auto min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl md:text-4xl font-headline font-bold text-foreground">
          Blog Okazje+
        </h1>
      </div>
      
      {articles.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground bg-card rounded-2xl border border-border/40">
          <p className="text-lg">Wkrótce pojawią się tu pierwsze artykuły!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((article) => {
            const title = article.title[locale] || article.title.pl;
            const excerpt = article.excerpt[locale] || article.excerpt.pl;
            
            return (
              <Link 
                href={`/${locale}/blog/${article.slug}`} 
                key={article.id}
                className="group ux-card-container flex flex-col h-full bg-card overflow-hidden hover:shadow-lg transition-all border border-border/40 rounded-xl"
              >
                {article.coverImage && (
                  <div className="relative w-full aspect-video overflow-hidden">
                    <Image 
                      src={article.coverImage} 
                      alt={title || 'Blog article cover'} 
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                )}
                
                <div className="p-5 flex-grow flex flex-col">
                  <h2 className="text-xl font-headline font-bold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">
                    {title}
                  </h2>
                  <p className="text-muted-foreground text-sm mb-4 line-clamp-3 flex-grow">
                    {excerpt}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border/50">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      <span>{article.authorName}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{article.publishedAt ? new Date(article.publishedAt).toLocaleDateString(locale) : ''}</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
