/**
 * Post Preview Component
 * Shows how the post will look on each social platform
 */

'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Facebook, Instagram, Twitter, Linkedin } from 'lucide-react';
import type { SocialPost, SocialPlatform } from '@/lib/types';

interface PostPreviewProps {
  post: Partial<SocialPost> & {
    platform: SocialPlatform;
    content: {
      text: string;
      imageUrl?: string;
      linkUrl: string;
      hashtags?: string[];
    };
    itemData: {
      title: string;
      price?: number;
      merchant?: string;
    };
  };
}

export function PostPreview({ post }: PostPreviewProps) {
  const platformConfig = {
    facebook: {
      name: 'Facebook',
      icon: Facebook,
      color: '#1877F2',
      dimensions: '1200x630',
    },
    instagram: {
      name: 'Instagram',
      icon: Instagram,
      color: '#E4405F',
      dimensions: '1080x1080',
    },
    twitter: {
      name: 'Twitter/X',
      icon: Twitter,
      color: '#1DA1F2',
      dimensions: '1200x675',
    },
    linkedin: {
      name: 'LinkedIn',
      icon: Linkedin,
      color: '#0A66C2',
      dimensions: '1200x627',
    },
    tiktok: {
      name: 'TikTok',
      icon: () => <span className="font-bold">TT</span>,
      color: '#000000',
      dimensions: '1080x1920',
    },
  };

  const config = platformConfig[post.platform];
  const Icon = config.icon;

  return (
    <Card className="max-w-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div 
              className="p-2 rounded" 
              style={{ backgroundColor: `${config.color}15` }}
            >
              <Icon className="h-5 w-5" style={{ color: config.color }} />
            </div>
            <div>
              <p className="font-semibold">{config.name}</p>
              <p className="text-xs text-muted-foreground">{config.dimensions}</p>
            </div>
          </div>
          <Badge variant="outline">Podgląd</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Platform-specific preview */}
        {post.platform === 'facebook' && <FacebookPreview post={post} />}
        {post.platform === 'instagram' && <InstagramPreview post={post} />}
        {post.platform === 'twitter' && <TwitterPreview post={post} />}
        {post.platform === 'linkedin' && <LinkedInPreview post={post} />}
        {post.platform === 'tiktok' && <TikTokPreview post={post} />}
      </CardContent>
    </Card>
  );
}

function FacebookPreview({ post }: { post: PostPreviewProps['post'] }) {
  return (
    <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="p-3 flex items-center gap-2">
        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
          OP
        </div>
        <div>
          <p className="font-semibold text-sm">Okazje Plus</p>
          <p className="text-xs text-gray-500">Teraz · 🌍</p>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 pb-3">
        <p className="text-sm whitespace-pre-wrap">{post.content.text}</p>
      </div>

      {/* Image */}
      {post.content.imageUrl && (
        <div className="relative aspect-[1200/630] bg-gray-100 dark:bg-gray-800">
          <img
            src={post.content.imageUrl}
            alt={post.itemData.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Link Preview */}
      <div className="p-3 bg-gray-50 dark:bg-gray-800 border-t">
        <p className="text-xs text-gray-500 uppercase">OKAZJE.PLUS</p>
        <p className="font-semibold text-sm">{post.itemData.title}</p>
        {post.itemData.price && (
          <p className="text-sm text-green-600 dark:text-green-400 font-semibold">
            {post.itemData.price} zł
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="p-2 border-t flex justify-around text-gray-600 dark:text-gray-400">
        <button className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
          <span>👍</span> <span className="text-sm">Lubię to</span>
        </button>
        <button className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
          <span>💬</span> <span className="text-sm">Komentuj</span>
        </button>
        <button className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
          <span>↗️</span> <span className="text-sm">Udostępnij</span>
        </button>
      </div>
    </div>
  );
}

function InstagramPreview({ post }: { post: PostPreviewProps['post'] }) {
  return (
    <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-900 max-w-md mx-auto">
      {/* Header */}
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 p-[2px]">
            <div className="w-full h-full rounded-full bg-white dark:bg-gray-900 flex items-center justify-center text-xs font-semibold">
              OP
            </div>
          </div>
          <p className="font-semibold text-sm">okazje_plus</p>
        </div>
        <button className="text-xl">⋯</button>
      </div>

      {/* Image */}
      {post.content.imageUrl && (
        <div className="relative aspect-square bg-gray-100 dark:bg-gray-800">
          <img
            src={post.content.imageUrl}
            alt={post.itemData.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Actions */}
      <div className="p-3 space-y-2">
        <div className="flex justify-between">
          <div className="flex gap-4 text-xl">
            <button>❤️</button>
            <button>💬</button>
            <button>↗️</button>
          </div>
          <button>🔖</button>
        </div>
        <p className="font-semibold text-sm">123 polubień</p>

        {/* Caption */}
        <div className="text-sm">
          <span className="font-semibold">okazje_plus</span>{' '}
          <span className="whitespace-pre-wrap">
            {post.content.text.split('\n').slice(0, 2).join('\n')}
            {post.content.text.split('\n').length > 2 && '... '}
          </span>
          {post.content.text.split('\n').length > 2 && (
            <button className="text-gray-500">więcej</button>
          )}
        </div>

        <p className="text-xs text-gray-500">2 godz. temu</p>
      </div>
    </div>
  );
}

function TwitterPreview({ post }: { post: PostPreviewProps['post'] }) {
  return (
    <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="p-3 flex gap-3">
        <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
          OP
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="font-bold text-sm">Okazje Plus</p>
            <span className="text-blue-500">✓</span>
            <p className="text-gray-500 text-sm">@okazje_plus · 2g</p>
          </div>

          {/* Content */}
          <p className="text-sm mt-1 whitespace-pre-wrap">{post.content.text}</p>

          {/* Image */}
          {post.content.imageUrl && (
            <div className="mt-3 relative aspect-[1200/675] bg-gray-100 dark:bg-gray-800 rounded-2xl overflow-hidden border">
              <img
                src={post.content.imageUrl}
                alt={post.itemData.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Link Card */}
          <div className="mt-3 border rounded-2xl overflow-hidden">
            <div className="p-3">
              <p className="text-xs text-gray-500">🔗 okazje.plus</p>
              <p className="font-semibold text-sm mt-1">{post.itemData.title}</p>
              {post.itemData.merchant && (
                <p className="text-xs text-gray-500 mt-1">{post.itemData.merchant}</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between mt-3 text-gray-500 text-sm">
            <button className="flex items-center gap-2 hover:text-blue-500">
              <span>💬</span> 12
            </button>
            <button className="flex items-center gap-2 hover:text-green-500">
              <span>🔁</span> 34
            </button>
            <button className="flex items-center gap-2 hover:text-red-500">
              <span>❤️</span> 89
            </button>
            <button className="flex items-center gap-2 hover:text-blue-500">
              <span>📊</span> 1.2K
            </button>
            <button className="hover:text-blue-500">↗️</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LinkedInPreview({ post }: { post: PostPreviewProps['post'] }) {
  return (
    <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="p-3 flex items-start gap-2">
        <div className="w-12 h-12 rounded-full bg-blue-700 flex items-center justify-center text-white font-semibold flex-shrink-0">
          OP
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">Okazje Plus</p>
          <p className="text-xs text-gray-500">1234 obserwujących</p>
          <p className="text-xs text-gray-500">2 godz. · 🌍</p>
        </div>
        <button className="text-gray-500">⋯</button>
      </div>

      {/* Content */}
      <div className="px-3 pb-3">
        <p className="text-sm whitespace-pre-wrap">{post.content.text}</p>
      </div>

      {/* Image */}
      {post.content.imageUrl && (
        <div className="relative aspect-[1200/627] bg-gray-100 dark:bg-gray-800">
          <img
            src={post.content.imageUrl}
            alt={post.itemData.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Link Preview */}
      <div className="p-3 bg-gray-50 dark:bg-gray-800 border-t">
        <p className="font-semibold text-sm">{post.itemData.title}</p>
        <p className="text-xs text-gray-500 mt-1">okazje.plus</p>
      </div>

      {/* Stats */}
      <div className="px-3 py-2 border-t flex items-center justify-between text-xs text-gray-500">
        <span>👍 ❤️ 💡 45</span>
        <span>12 komentarzy · 23 udostępnienia</span>
      </div>

      {/* Actions */}
      <div className="border-t flex text-gray-600 dark:text-gray-400">
        <button className="flex-1 flex items-center justify-center gap-2 py-3 hover:bg-gray-100 dark:hover:bg-gray-800">
          <span>👍</span> <span className="text-sm font-semibold">Lubię to</span>
        </button>
        <button className="flex-1 flex items-center justify-center gap-2 py-3 hover:bg-gray-100 dark:hover:bg-gray-800">
          <span>💬</span> <span className="text-sm font-semibold">Skomentuj</span>
        </button>
        <button className="flex-1 flex items-center justify-center gap-2 py-3 hover:bg-gray-100 dark:hover:bg-gray-800">
          <span>🔁</span> <span className="text-sm font-semibold">Udostępnij</span>
        </button>
        <button className="flex-1 flex items-center justify-center gap-2 py-3 hover:bg-gray-100 dark:hover:bg-gray-800">
          <span>↗️</span> <span className="text-sm font-semibold">Wyślij</span>
        </button>
      </div>
    </div>
  );
}

function TikTokPreview({ post }: { post: PostPreviewProps['post'] }) {
  return (
    <div className="border rounded-lg overflow-hidden bg-black text-white max-w-sm mx-auto">
      {/* Vertical video placeholder */}
      {post.content.imageUrl ? (
        <div className="relative aspect-[9/16] bg-gray-900">
          <img
            src={post.content.imageUrl}
            alt={post.itemData.title}
            className="w-full h-full object-cover"
          />
          
          {/* Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80">
            <p className="text-sm mb-2">{post.content.text}</p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-pink-500 flex items-center justify-center text-xs font-bold">
                OP
              </div>
              <p className="font-semibold text-sm">@okazje_plus</p>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="absolute right-2 bottom-20 flex flex-col gap-4">
            <button className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                ❤️
              </div>
              <span className="text-xs mt-1">12.3K</span>
            </button>
            <button className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                💬
              </div>
              <span className="text-xs mt-1">234</span>
            </button>
            <button className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                🔖
              </div>
              <span className="text-xs mt-1">567</span>
            </button>
            <button className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                ↗️
              </div>
              <span className="text-xs mt-1">1.2K</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="aspect-[9/16] bg-gray-900 flex items-center justify-center">
          <p className="text-gray-500">Brak zdjęcia/wideo</p>
        </div>
      )}
    </div>
  );
}
