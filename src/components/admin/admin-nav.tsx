'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Layers,
  FileBarChart,
  Settings,
  Search,
  AlertTriangle,
  TrendingUp,
  Database,
  ChevronRight,
  Share2,
  Wrench,
  Rocket,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';



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
    title: 'Moderacja',
    icon: ShieldCheck,
    items: [
      { title: 'Panel moderacji', href: '/admin/moderation', icon: AlertTriangle },
      { title: 'Zarządzanie kategoriami', href: '/admin/categories', icon: Layers },
      { title: 'Wykrywanie duplikatów', href: '/admin/duplicates', icon: Search },
      { title: 'Kategorie forum', href: '/admin/forum/categories', icon: Layers },
    ],
  },
  {
    title: 'Import & Pipeline',
    icon: Rocket,
    items: [
      {
        title: 'Centrum importu',
        href: '/admin/import',
        icon: Wrench,
        badge: 'AliExpress',
        badgeVariant: 'secondary',
      },
      {
        title: 'Ręczny import (Kreator)',
        href: '/admin/m6-import-dashboard',
        icon: Search,
      },
      { title: 'Presety harvestera', href: '/admin/harvester-presets', icon: Layers },
    ],
  },
  {
    title: 'Analityka',
    icon: FileBarChart,
    items: [
      { title: 'Analityka', href: '/admin/analytics', icon: TrendingUp },
      { title: 'Statystyki', href: '/admin/stats', icon: FileBarChart },
      { title: 'Zakupy AliExpress', href: '/admin/aliexpress-purchases', icon: ShoppingCart },
      { title: 'Baza danych', href: '/admin/database', icon: Database },
      { title: 'Social media', href: '/admin/social-media', icon: Share2 },
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
    title: 'Konfiguracja',
    icon: Settings,
    items: [
      { title: 'Ustawienia', href: '/admin/settings', icon: Settings },
      { title: 'OAuth', href: '/admin/settings/oauth', icon: Settings },
    ],
  },
  // DevTools — dostępne przez URL, ukryte w nawigacji:
  // /admin/m6-import-dashboard, /admin/m6-pipeline-visualizer,
  // /admin/m6-ui-guide, /admin/typesense-queue, /admin/ux-preview/*
];


export function AdminNav() {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const localePrefix = (() => {
    const first = pathname.split('/')[1];
    return ['pl', 'en', 'de'].includes(first) ? `/${first}` : '';
  })();

  const resolveHref = (href: string) => `${localePrefix}${href}`;

  const toggleGroup = (title: string) => {
    setOpenGroups(prev =>
      prev.includes(title)
        ? prev.filter(t => t !== title)
        : [...prev, title]
    );
  };

  const isActive = (href: string) => {
    const target = resolveHref(href);
    if (href === '/admin') {
      return pathname === target;
    }
    return pathname.startsWith(target);
  };

  const filteredNavStructure = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return navStructure;

    const result: (NavItem | NavGroup)[] = [];
    for (const item of navStructure) {
      if ('items' in item) {
        const filteredItems = item.items.filter((subItem) =>
          `${subItem.title} ${subItem.href}`.toLowerCase().includes(normalizedQuery)
        );
        if (filteredItems.length > 0) {
          result.push({ ...item, items: filteredItems });
        }
      } else if (`${item.title} ${item.href}`.toLowerCase().includes(normalizedQuery)) {
        result.push(item);
      }
    }
    return result;
  }, [query]);

  return (
    <nav className="space-y-2">
      <div className="px-2 pb-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Szukaj sekcji admina..."
          className="h-9"
          aria-label="Szukaj sekcji panelu administratora"
        />
      </div>

      {filteredNavStructure.map((item) => {
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
                  'hover:bg-muted',
                  hasActiveChild && 'text-primary'
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
                    href={resolveHref(subItem.href)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive(subItem.href)
                        ? 'bg-primary/20 text-primary font-semibold'
                        : 'hover:bg-muted'
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
              href={resolveHref(item.href)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive(item.href)
                  ? 'bg-primary/20 text-primary font-semibold'
                  : 'hover:bg-muted'
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
