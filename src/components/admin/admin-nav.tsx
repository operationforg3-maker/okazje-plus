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
  Share2,
  MessageCircle,
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
    title: 'Forum',
    icon: MessageCircle,
    items: [
      { title: 'Moderacja', href: '/admin/forum/moderation', icon: AlertTriangle, badge: '0' },
      { title: 'Kategorie', href: '/admin/forum/categories', icon: Layers },
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
    title: 'Marketing',
    icon: Share2,
    items: [
      { title: 'Social Media', href: '/admin/social-media', icon: Share2, badge: 'NEW', badgeVariant: 'default' },
    ],
  },
  {
    title: 'M6 System',
    icon: Zap,
    items: [
      { title: 'Import Dashboard', href: '/admin/m6-import-dashboard', icon: TrendingUp, badge: 'NEW', badgeVariant: 'default' },
      { title: 'Harvester Presets', href: '/admin/harvester-presets', icon: Combine, badge: 'NEW', badgeVariant: 'default' },
      { title: 'Pipeline Visualizer', href: '/admin/m6-pipeline-visualizer', icon: Layers, badge: 'NEW', badgeVariant: 'default' },
      { title: 'UI Guide', href: '/admin/m6-ui-guide', icon: FileBarChart, badge: 'DOCS', badgeVariant: 'secondary' },
    ],
  },
  {
    title: 'Konfiguracja',
    icon: Settings,
    items: [
      { title: 'Ustawienia', href: '/admin/settings', icon: Settings },
      { title: 'Setup & Seeding', href: '/admin/setup', icon: Database },
      { title: 'Baza Danych', href: '/admin/database', icon: Database, badge: 'CLEAN' },
      // { title: 'Nawigacja', href: '/admin/navigation', icon: Layers },
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
                    href={subItem.href}
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
              href={item.href}
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
