import { toast } from 'sonner';
import { Trophy, Star, Flame, Award, Zap, Target, Crown, Sparkles } from 'lucide-react';

/**
 * Achievement Toast Notification System
 * Beautiful animated toasts for gamification events
 */

interface AchievementToastProps {
  title: string;
  description: string;
  icon?: 'trophy' | 'star' | 'flame' | 'award' | 'zap' | 'target' | 'crown' | 'sparkles';
  iconColor?: string;
  points?: number;
  duration?: number;
}

const ICON_MAP = {
  trophy: Trophy,
  star: Star,
  flame: Flame,
  award: Award,
  zap: Zap,
  target: Target,
  crown: Crown,
  sparkles: Sparkles,
};

const DEFAULT_ICON_COLORS = {
  trophy: 'text-yellow-500',
  star: 'text-purple-500',
  flame: 'text-orange-500',
  award: 'text-blue-500',
  zap: 'text-amber-500',
  target: 'text-green-500',
  crown: 'text-yellow-600',
  sparkles: 'text-pink-500',
};

/**
 * Show achievement toast with custom styling
 */
export function showAchievementToast({
  title,
  description,
  icon = 'trophy',
  iconColor,
  points,
  duration = 5000,
}: AchievementToastProps) {
  const Icon = ICON_MAP[icon];
  const color = iconColor || DEFAULT_ICON_COLORS[icon];

  toast.custom(
    () => (
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-0.5 rounded-lg shadow-2xl animate-in slide-in-from-top-5">
        <div className="bg-background rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className={`${color} animate-bounce`}>
              <Icon className="h-8 w-8" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-lg bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                {title}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
              {points && (
                <div className="mt-2 inline-flex items-center gap-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                  <Sparkles className="h-4 w-4" />
                  +{points} punktów
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    ),
    { duration }
  );
}

/**
 * Show badge earned notification
 */
export function notifyBadgeEarned(badgeName: string, badgeDescription: string, points: number) {
  showAchievementToast({
    title: '🏆 Nowa odznaka!',
    description: `${badgeName} - ${badgeDescription}`,
    icon: 'trophy',
    points,
    duration: 6000,
  });
}

/**
 * Show level up notification
 */
export function notifyLevelUp(newLevel: number, levelName: string, levelIcon: string, points: number) {
  showAchievementToast({
    title: `${levelIcon} Awans na poziom ${newLevel}!`,
    description: `Gratulacje! Osiągnąłeś poziom: ${levelName}`,
    icon: 'star',
    points,
    duration: 7000,
  });
}

/**
 * Show milestone notification (e.g., 100th deal posted)
 */
export function notifyMilestone(milestone: string, description: string, points: number) {
  showAchievementToast({
    title: `🎯 ${milestone}`,
    description,
    icon: 'target',
    points,
    duration: 6000,
  });
}

/**
 * Show streak notification (e.g., 7 days login streak)
 */
export function notifyStreak(days: number, points: number) {
  showAchievementToast({
    title: `🔥 ${days} dni z rzędu!`,
    description: 'Utrzymujesz świetną passę aktywności',
    icon: 'flame',
    points,
    duration: 5000,
  });
}

/**
 * Show first achievement notification
 */
export function notifyFirstAchievement(achievementName: string, description: string, points: number) {
  showAchievementToast({
    title: `✨ Pierwsze ${achievementName}!`,
    description,
    icon: 'sparkles',
    points,
    duration: 6000,
  });
}

/**
 * Show special reward notification
 */
export function notifySpecialReward(rewardName: string, description: string) {
  showAchievementToast({
    title: `👑 ${rewardName}`,
    description,
    icon: 'crown',
    duration: 8000,
  });
}

/**
 * Show hot deal notification (when user's deal gets hot)
 */
export function notifyHotDeal(dealTitle: string, temperature: number, points: number) {
  showAchievementToast({
    title: '🔥 Twoja okazja jest gorąca!',
    description: `"${dealTitle}" osiągnęła ${temperature}°`,
    icon: 'flame',
    iconColor: 'text-orange-600',
    points,
    duration: 6000,
  });
}

/**
 * Show helpful vote notification (when user's comment gets many upvotes)
 */
export function notifyHelpfulComment(votes: number, points: number) {
  showAchievementToast({
    title: '👍 Pomocny komentarz!',
    description: `Twój komentarz otrzymał ${votes} pozytywnych głosów`,
    icon: 'award',
    points,
    duration: 5000,
  });
}

/**
 * Show quick responder notification
 */
export function notifyQuickResponder(points: number) {
  showAchievementToast({
    title: '⚡ Błyskawiczny!',
    description: 'Jeden z pierwszych komentujących tę okazję',
    icon: 'zap',
    points,
    duration: 5000,
  });
}
