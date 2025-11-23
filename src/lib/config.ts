export const FEATURES = {
  MEGA_MENU_FILTER_SHORTCUTS: (process.env.NEXT_PUBLIC_FEATURE_MEGA_MENU_FILTER_SHORTCUTS ?? 'true') === 'true',
  DEALS_TYPE_FILTER: (process.env.NEXT_PUBLIC_FEATURE_DEALS_TYPE_FILTER ?? 'true') === 'true',
  DEALS_FREE_SHIPPING_FILTER: (process.env.NEXT_PUBLIC_FEATURE_DEALS_FREE_SHIPPING_FILTER ?? 'true') === 'true',
  PRICE_ALERTS: (process.env.NEXT_PUBLIC_FEATURE_PRICE_ALERTS ?? 'true') === 'true',
  GAMIFICATION: (process.env.NEXT_PUBLIC_FEATURE_GAMIFICATION ?? 'true') === 'true',
  SOCIAL_FEATURES: (process.env.NEXT_PUBLIC_FEATURE_SOCIAL ?? 'true') === 'true',
};
