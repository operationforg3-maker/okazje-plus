'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Flame,
  ShoppingCart,
  Users,
  Layers,
  FileBarChart,
  Settings,
  Upload,
  Download,
  Search,
  MessageSquare,
  AlertTriangle,
  TrendingUp,
  Database,
  Zap,
  ChevronRight,
  Sparkles,
  Combine,
  type LucideIcon,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  badgeVariant?: 'default' | 'destructive' | 'outline' | 'secondary';
}

interface NavGroup {
  title: string;
  icon: LucideIcon;
  items: NavItem[];
}

const navStructure: (NavItem | NavGroup)[] = [
  {
    title: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    title: 'Zawartość',
    icon: Database,
    items: [
      { title: 'Okazje', href: '/admin/deals', icon: Flame },
      { title: 'Produkty', href: '/admin/products', icon: ShoppingCart },
      { title: 'Kategorie', href: '/admin/categories', icon: Layers },
    ],
  },
  {
    title: 'Import & Export',
    icon: Upload,
    items: [
      { title: 'Konsola Import/Export', href: '/admin/import-export', icon: Combine, badge: 'NEW', badgeVariant: 'default' },
    ],
  },
  {
    title: 'Legacy (Importy)',
    icon: Download,
    items: [
      { title: 'Kombajn', href: '/admin/harvester', icon: Combine },
      { title: 'Auto-Import Kombajn', href: '/admin/auto-import', icon: Sparkles },
      { title: 'Import Monitor', href: '/admin/imports', icon: TrendingUp },
      { title: 'AliExpress', href: '/admin/aliexpress-import', icon: Search },
      { title: 'Allegro', href: '/admin/allegro-import', icon: Search },
      { title: 'Amazon', href: '/admin/amazon-import', icon: Search },
      { title: 'Convertiser', href: '/admin/convertiser-import', icon: Zap },
      { title: 'eBay', href: '/admin/ebay-import', icon: Search },
      { title: 'Bulk Import', href: '/admin/bulk-import', icon: Database },
      { title: 'Batch Import', href: '/admin/batch-import', icon: Layers },
    ],
  },
  {
    title: 'Moderacja',
    icon: AlertTriangle,
    items: [
      { title: 'Panel Moderacji', href: '/admin/moderation', icon: AlertTriangle, badge: '0' },
      { title: 'Duplikaty', href: '/admin/duplicates', icon: Search },
    ],
  },
  {
    title: 'Użytkownicy',
    icon: Users,
    items: [
      { title: 'Lista użytkowników', href: '/admin/users', icon: Users },
      { title: 'Pre-rejestracje', href: '/admin/pre-registrations', icon: Users },
    ],
  },
  {
    title: 'Analityka',
    icon: FileBarChart,
    items: [
      { title: 'Dashboard Analytics', href: '/admin/analytics', icon: TrendingUp },
      { title: 'Statystyki', href: '/admin/stats', icon: FileBarChart },
    ],
  },
  {
    title: 'Konfiguracja',
    icon: Settings,
    items: [
      { title: 'Ustawienia', href: '/admin/settings', icon: Settings },
      { title: 'Setup & Seeding', href: '/admin/setup', icon: Database },
      { title: 'Nawigacja', href: '/admin/navigation', icon: Layers },
    ],
  },
];

export function AdminNav() {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<string[]>([]);

  const toggleGroup = (title: string) => {
    setOpenGroups(prev =>
      prev.includes(title)
        ? prev.filter(t => t !== title)
        : [...prev, title]
    );
  };

  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === href || pathname === '/pl/admin';
    }
    return pathname.includes(href);
  };

  return (
    <nav className="space-y-1">
      {navStructure.map((item) => {
        if ('items' in item) {
          // Group with subitems
          const isOpen = openGroups.includes(item.title);
          const hasActiveChild = item.items.some(subItem => isActive(subItem.href));

          return (
            <Collapsible
              key={item.title}
              open={isOpen || hasActiveChild}
              onOpenChange={() => toggleGroup(item.title)}
            >
              <CollapsibleTrigger
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  hasActiveChild && 'bg-accent/50'
                )}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1 text-left">{item.title}</span>
                <ChevronRight
                  className={cn(
                    'h-4 w-4 transition-transform',
                    isOpen || hasActiveChild ? 'rotate-90' : ''
                  )}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="ml-4 mt-1 space-y-1 border-l pl-2">
                {item.items.map((subItem) => (
                  <Link
                    key={subItem.href}
                    href={subItem.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive(subItem.href)
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <subItem.icon className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1">{subItem.title}</span>
                    {subItem.badge && (
                      <Badge variant={subItem.badgeVariant || 'secondary'} className="ml-auto">
                        {subItem.badge}
                      </Badge>
                    )}
                  </Link>
                ))}
              </CollapsibleContent>
            </Collapsible>
          );
        } else {
          // Single item
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive(item.href)
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1">{item.title}</span>
              {item.badge && (
                <Badge variant={item.badgeVariant || 'secondary'} className="ml-auto">
                  {item.badge}
                </Badge>
              )}
            </Link>
          );
        }
      })}
    </nav>
  );
}
