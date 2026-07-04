import { 
  Laptop, 
  Shirt, 
  Dumbbell, 
  Home, 
  Car, 
  Sparkles, 
  BookOpen, 
  Heart, 
  Gamepad2, 
  Baby, 
  MoreHorizontal, 
  ShoppingBag,
  LucideIcon
} from 'lucide-react';
import { Category } from './types';

export interface CategoryStyle {
  icon: LucideIcon | string;
  gradient: string;
  bg: string;
  border: string;
  accent: string;
}

const CATEGORY_STYLES_MAP: Record<string, CategoryStyle> = {
  'elektronika': { icon: Laptop, bg: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-200 dark:border-blue-900', accent: 'text-blue-600 dark:text-blue-400', gradient: 'from-blue-500 to-cyan-500' },
  'moda': { icon: Shirt, bg: 'from-purple-500/20 to-pink-500/20', border: 'border-purple-200 dark:border-purple-900', accent: 'text-purple-600 dark:text-purple-400', gradient: 'from-purple-500 to-pink-500' },
  'sport': { icon: Dumbbell, bg: 'from-green-500/20 to-emerald-500/20', border: 'border-green-200 dark:border-green-900', accent: 'text-green-600 dark:text-green-400', gradient: 'from-green-500 to-emerald-500' },
  'dom-i-ogrod': { icon: Home, bg: 'from-amber-500/20 to-orange-500/20', border: 'border-amber-200 dark:border-amber-900', accent: 'text-amber-600 dark:text-amber-400', gradient: 'from-amber-500 to-orange-500' },
  'motoryzacja': { icon: Car, bg: 'from-gray-500/20 to-slate-500/20', border: 'border-gray-200 dark:border-gray-900', accent: 'text-gray-600 dark:text-gray-400', gradient: 'from-gray-500 to-slate-500' },
  'uroda-i-zdrowie': { icon: Heart, bg: 'from-red-500/20 to-pink-500/20', border: 'border-red-200 dark:border-red-900', accent: 'text-red-600 dark:text-red-400', gradient: 'from-red-500 to-pink-500' },
  'rozrywka-i-gry': { icon: Gamepad2, bg: 'from-indigo-500/20 to-purple-500/20', border: 'border-indigo-200 dark:border-indigo-900', accent: 'text-indigo-600 dark:text-indigo-400', gradient: 'from-indigo-500 to-purple-500' },
  'dla-dzieci': { icon: Baby, bg: 'from-teal-500/20 to-cyan-500/20', border: 'border-teal-200 dark:border-teal-900', accent: 'text-teal-600 dark:text-teal-400', gradient: 'from-teal-500 to-cyan-500' },
};

const DEFAULT_STYLE: CategoryStyle = {
  icon: ShoppingBag,
  bg: 'from-orange-500/20 to-red-500/20',
  border: 'border-orange-200 dark:border-orange-900',
  accent: 'text-orange-600 dark:text-orange-400',
  gradient: 'from-orange-500 to-red-500'
};

export function getCategoryStyle(category: Category | null | undefined): CategoryStyle {
  if (!category) return DEFAULT_STYLE;
  
  const slug = (category.slug || category.id || '').toLowerCase();
  let style = CATEGORY_STYLES_MAP[slug];
  
  if (!style) {
    if (category.icon) {
      style = {
        ...DEFAULT_STYLE,
        icon: category.icon,
      };
    } else {
      style = DEFAULT_STYLE;
    }
  } else if (category.icon) {
    style = {
      ...style,
      icon: category.icon,
    };
  }

  // Dynamic styling overrides from Firestore
  const catTheme = (category as any).uxTheme || (category as any).layoutType;
  if (catTheme) {
    if (catTheme === 'v4' || catTheme === 'amber') {
      style = {
        ...style,
        gradient: 'from-amber-500 to-orange-500',
        bg: 'from-amber-500/20 to-orange-500/20',
        border: 'border-amber-200 dark:border-amber-900',
        accent: 'text-amber-600 dark:text-amber-400',
      };
    } else if (catTheme === 'v5' || catTheme === 'teal') {
      style = {
        ...style,
        gradient: 'from-teal-500 to-cyan-500',
        bg: 'from-teal-500/20 to-cyan-500/20',
        border: 'border-teal-200 dark:border-teal-900',
        accent: 'text-teal-600 dark:text-teal-400',
      };
    } else if (catTheme === 'neon') {
      style = {
        ...style,
        gradient: 'from-green-400 to-emerald-500',
        bg: 'from-green-400/20 to-emerald-500/20',
        border: 'border-green-300 dark:border-green-900',
        accent: 'text-green-500 dark:text-green-400',
      };
    }
  }

  return style;
}
