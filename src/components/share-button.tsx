'use client';

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Share2, Facebook, Twitter, Link as LinkIcon, Check, MessageCircle, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trackShare } from "@/lib/analytics";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getApp } from "firebase/app";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface ShareButtonProps {
  type: 'deal' | 'product';
  itemId: string;
  title: string;
  url: string;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  onShared?: (method: 'facebook' | 'twitter' | 'copy_link' | 'whatsapp' | 'telegram') => void;
}

export default function ShareButton({ 
  type, 
  itemId, 
  title, 
  url,
  variant = 'outline',
  size = 'sm',
  className,
  onShared
}: ShareButtonProps) {
  const isIconOnly = size === 'icon';
  const [copied, setCopied] = useState(false);
  const t = useTranslations('common');

  const handleShare = async (method: 'facebook' | 'twitter' | 'copy_link' | 'whatsapp' | 'telegram') => {
    // Analytics tracking (client-side)
    trackShare(type, itemId, method);
    if (onShared) onShared(method);

    // Backend tracking (Cloud Function)
    try {
      const functions = getFunctions(getApp(), 'europe-west1');
      const trackShareStats = httpsCallable(functions, 'trackShareStats');
      await trackShareStats({
        itemType: type,
        itemId,
        platform: method,
      });
    } catch (error) {
      console.error('Failed to track share stats:', error);
      // Nie pokazujemy błędu użytkownikowi - tracking jest opcjonalny
    }

    const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
    const encodedUrl = encodeURIComponent(fullUrl);
    const encodedTitle = encodeURIComponent(title);

    switch (method) {
      case 'facebook':
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
          '_blank',
          'width=600,height=400'
        );
        toast.success(t('share.shareOpened', { platform: 'Facebook' }));
        break;

      case 'twitter':
        window.open(
          `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
          '_blank',
          'width=600,height=400'
        );
        toast.success(t('share.shareOpened', { platform: 'X' }));
        break;

      case 'whatsapp':
        window.open(
          `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
          '_blank',
          'width=600,height=400'
        );
        toast.success(t('share.shareOpened', { platform: 'WhatsApp' }));
        break;

      case 'telegram':
        window.open(
          `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
          '_blank',
          'width=600,height=400'
        );
        toast.success(t('share.shareOpened', { platform: 'Telegram' }));
        break;

      case 'copy_link':
        navigator.clipboard.writeText(fullUrl).then(() => {
          setCopied(true);
          toast.success(t('share.linkCopied'));
          setTimeout(() => setCopied(false), 2000);
        }).catch(() => {
          toast.error(t('share.copyError'));
        });
        break;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={cn(className)}>
          <Share2 className={`h-3.5 w-3.5${isIconOnly ? '' : ' mr-2'}`} />
          {!isIconOnly && t('share.share')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => handleShare('facebook')}>
          <Facebook className="h-4 w-4 mr-2 text-blue-600" />
          Facebook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleShare('twitter')}>
          <Twitter className="h-4 w-4 mr-2 text-sky-500" />
          X (Twitter)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleShare('whatsapp')}>
          <MessageCircle className="h-4 w-4 mr-2 text-green-600" />
          WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleShare('telegram')}>
          <Send className="h-4 w-4 mr-2 text-blue-500" />
          Telegram
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleShare('copy_link')}>
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-2 text-green-600" />
              {t('share.copied')}
            </>
          ) : (
            <>
              <LinkIcon className="h-4 w-4 mr-2" />
              {t('share.copyLink')}
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
