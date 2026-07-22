import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebase-admin';
import { Article } from '@/lib/types';
import { setRequestLocale } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';
import { Clock, User, ChevronLeft } from 'lucide-react';
import { Metadata } from 'next';
import CommentSection from '@/components/comment-section';
import { getCommentsAdmin } from '@/lib/data-admin';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { locale: string; slug: string };
}

async function getArticleBySlug(slug: string): Promise<Article | null> {
  const snap = await adminDb
    .collection('articles')
    .where('slug', '==', slug)
    .where('status', '==', 'published')
    .limit(1)
    .get();

  if (snap.empty) {
    return null;
  }
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Article;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const article = await getArticleBySlug(resolvedParams.slug);
  
  if (!article) {
    return { title: 'Nie znaleziono' };
  }
  
  const locale = resolvedParams.locale as 'pl' | 'en' | 'de';
  const title = article.title[locale] || article.title.pl;
  const excerpt = article.excerpt[locale] || article.excerpt.pl;

  return {
    title: `${title} | Blog Okazje+`,
    description: excerpt,
    openGraph: {
      title,
      description: excerpt,
      images: article.coverImage ? [article.coverImage] : [],
      type: 'article',
      publishedTime: article.publishedAt,
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const resolvedParams = await params;
  setRequestLocale(resolvedParams.locale);
  const locale = resolvedParams.locale as 'pl' | 'en' | 'de';
  
  const article = await getArticleBySlug(resolvedParams.slug);
  
  if (!article) {
    notFound();
  }
  
  const title = article.title[locale] || article.title.pl;
  const content = article.content[locale] || article.content.pl;
  
  // JSON-LD dla Artykułu
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    image: article.coverImage ? [article.coverImage] : [],
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: [{
      '@type': 'Person',
      name: article.authorName
    }]
  };
  
  // Fetch comments SSR
  const initialComments = await getCommentsAdmin('articles', article.id, 50);
  
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="page-container py-8 max-w-4xl mx-auto min-h-screen">
        <Link href={`/${locale}/blog`} className="inline-flex items-center text-muted-foreground hover:text-primary mb-6 transition-colors">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Powrót do bloga
        </Link>
        
        <article className="bg-card rounded-2xl border border-border/40 shadow-sm overflow-hidden mb-12">
          {article.coverImage && (
            <div className="relative w-full aspect-video md:aspect-[21/9]">
              <Image 
                src={article.coverImage} 
                alt={title} 
                fill
                priority
                className="object-cover"
              />
            </div>
          )}
          
          <div className="p-6 md:p-10">
            <h1 className="text-3xl md:text-5xl font-headline font-bold text-foreground mb-6 leading-tight">
              {title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-8 pb-8 border-b border-border/50">
              <div className="flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-full">
                <User className="w-4 h-4" />
                <span className="font-medium text-foreground">{article.authorName}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span>{article.publishedAt ? new Date(article.publishedAt).toLocaleDateString(locale) : ''}</span>
              </div>
            </div>
            
            <div 
              className="prose prose-lg dark:prose-invert max-w-none prose-img:rounded-xl prose-headings:font-headline"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </div>
        </article>
        
        <div className="bg-card rounded-2xl p-6 md:p-10 border border-border/40 shadow-sm">
          <h2 className="text-2xl font-headline font-bold mb-6">Komentarze</h2>
          <CommentSection 
            collectionName="articles" 
            docId={article.id} 
            initialComments={initialComments} 
          />
        </div>
      </div>
    </>
  );
}
