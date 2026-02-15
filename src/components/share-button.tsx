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

interface ShareButtonProps {
  type: 'deal' | 'product';
  itemId: string;
  title: string;
  url: string;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  onShared?: (method: 'facebook' | 'twitter' | 'copy_link' | 'whatsapp' | 'telegram') => void;
}

export default function ShareButton({ 
  type, 
  itemId, 
  title, 
  url,
  variant = 'outline',
  size = 'sm',
  onShared
}: ShareButtonProps) {
  const isIconOnly = size === 'icon';
  const [copied, setCopied] = useState(false);

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
        toast.success("Otwarto okno udostępniania Facebook");
        break;

      case 'twitter':
        window.open(
          `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
          '_blank',
          'width=600,height=400'
        );
        toast.success("Otwarto okno udostępniania X (Twitter)");
        break;

      case 'whatsapp':
        window.open(
          `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
          '_blank',
          'width=600,height=400'
        );
        toast.success("Otwarto okno udostępniania WhatsApp");
        break;

      case 'telegram':
        window.open(
          `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
          '_blank',
          'width=600,height=400'
        );
        toast.success("Otwarto okno udostępniania Telegram");
        break;

      case 'copy_link':
        navigator.clipboard.writeText(fullUrl).then(() => {
          setCopied(true);
          toast.success("Link skopiowany do schowka!");
          setTimeout(() => setCopied(false), 2000);
        }).catch(() => {
          toast.error("Nie udało się skopiować linku");
        });
        break;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size}>
          <Share2 className={`h-4 w-4${isIconOnly ? '' : ' mr-2'}`} />
          {!isIconOnly && 'Udostępnij'}
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
              Skopiowano!
            </>
          ) : (
            <>
              <LinkIcon className="h-4 w-4 mr-2" />
              Kopiuj link
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
