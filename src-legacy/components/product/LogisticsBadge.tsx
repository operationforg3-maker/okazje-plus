'use client';

import { Logistics } from '@/lib/schema';
import { Package, Truck, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface LogisticsBadgeProps {
  logistics?: Logistics;
  compact?: boolean;
}

export function LogisticsBadge({ logistics, compact = false }: LogisticsBadgeProps) {
  if (!logistics) return null;
  
  const { deliveryDays, deliveryDaysMax, isFreeShipping, shippingCost } = logistics;
  
  // Compact version for cards
  if (compact) {
    return (
      <div className="flex flex-wrap gap-1">
        {isFreeShipping && (
          <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-200">
            <Truck className="h-3 w-3 mr-1" />
            Darmowa dostawa
          </Badge>
        )}
        
        {deliveryDays <= 3 && (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200">
            <Clock className="h-3 w-3 mr-1" />
            Szybka dostawa
          </Badge>
        )}
      </div>
    );
  }
  
  // Full version for product pages
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <h3 className="font-semibold flex items-center gap-2">
        <Package className="h-5 w-5 text-primary" />
        Dostawa
      </h3>
      
      <div className="space-y-2">
        {/* Delivery Time */}
        <div className="flex items-start gap-2">
          <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-sm font-medium">Czas dostawy</p>
            <p className="text-sm text-muted-foreground">
              {deliveryDaysMax 
                ? `${deliveryDays}-${deliveryDaysMax} dni roboczych`
                : `${deliveryDays} dni roboczych`
              }
            </p>
          </div>
        </div>
        
        {/* Shipping Cost */}
        <div className="flex items-start gap-2">
          <Truck className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-sm font-medium">Koszt wysyłki</p>
            {isFreeShipping ? (
              <p className="text-sm font-semibold text-green-600">
                Darmowa dostawa
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {shippingCost > 0 ? `${shippingCost.toFixed(2)} PLN` : 'Do ustalenia'}
              </p>
            )}
          </div>
        </div>
        
        {/* Fast Delivery Badge */}
        {deliveryDays <= 3 && (
          <Badge className="bg-blue-500 hover:bg-blue-600">
            ⚡ Ekspresowa dostawa
          </Badge>
        )}
      </div>
    </div>
  );
}
