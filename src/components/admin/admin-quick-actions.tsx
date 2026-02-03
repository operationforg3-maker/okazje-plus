'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Sparkles, MoreHorizontal, ExternalLink } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/auth';
import { refineProductAction } from '@/app/actions/refine-product-action';
import { toast } from 'sonner';

interface AdminQuickActionsProps {
  productId: string;
  onEdit?: () => void;
  className?: string;
  itemType?: 'product' | 'deal';
}

export function AdminQuickActions({ 
  productId, 
  onEdit, 
  className = '',
  itemType = 'product'
}: AdminQuickActionsProps) {
  const { user } = useAuth();
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || !user || user.role !== 'admin') return null;

  const handleRefine = async () => {
    setLoading(true);
    toast.info("Starting AI Refiner (Human-Like)...");
    try {
      const res = await refineProductAction(productId);
      if (res.success) {
        toast.success("Product successfully refined!");
        // Optional: Trigger a router refresh or just reload window
        window.location.reload();
      } else {
        toast.error("Refiner failed: " + res.error);
      }
    } catch (e: any) {
      toast.error("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className} onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            size="icon" 
            variant="secondary" 
            className="h-8 w-8 rounded-full shadow-md bg-white/90 hover:bg-white"
            aria-label="Akcje administratora"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <Pencil className="h-4 w-4 text-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuLabel>Admin Actions ({itemType})</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {onEdit && (
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <Pencil className="mr-2 h-4 w-4" />
              Szybka edycja
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRefine(); }} disabled={loading}>
            <Sparkles className="mr-2 h-4 w-4 text-green-500" />
            {loading ? 'Przetwarzanie...' : 'Refiner (Human Like)'}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={() => window.open(`/admin/products?search=${productId}`, '_blank')}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Otwórz w panelu
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
