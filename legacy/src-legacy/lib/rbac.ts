/**
 * Role-Based Access Control (RBAC) utilities
 * 
 * Defines authorization guards for different user roles in the system.
 * Roles hierarchy: admin > moderator > specjalista > user
 */

import { User } from '@/lib/types';

/**
 * User role hierarchy levels
 */
const ROLE_LEVELS = {
  'admin': 4,
  'moderator': 3,
  'specjalista': 2,
  'user': 1
} as const;

/**
 * Check if user has admin privileges
 */
export function isAdmin(user: User | null): boolean {
  return user?.role === 'admin';
}

/**
 * Check if user has moderator or higher privileges
 */
export function isModerator(user: User | null): boolean {
  if (!user) return false;
  const level = ROLE_LEVELS[user.role];
  return level >= ROLE_LEVELS['moderator'];
}

/**
 * Check if user has specjalista or higher privileges
 */
export function isSpecjalista(user: User | null): boolean {
  if (!user) return false;
  const level = ROLE_LEVELS[user.role];
  return level >= ROLE_LEVELS['specjalista'];
}

/**
 * Check if user can moderate content (approve/reject deals, products)
 * Requires: moderator or admin role
 */
export function canModerate(user: User | null): boolean {
  return isModerator(user);
}

/**
 * Check if user can manage imports (create profiles, run imports)
 * Requires: admin role
 * 
 * TODO: In future, may allow 'specjalista' role to manage imports
 */
export function canManageImports(user: User | null): boolean {
  return isAdmin(user);
}

/**
 * Check if user can manage users (edit roles, permissions)
 * Requires: admin role
 */
export function canManageUsers(user: User | null): boolean {
  return isAdmin(user);
}

/**
 * Check if user can access admin panel
 * Requires: specjalista or higher
 */
export function canAccessAdminPanel(user: User | null): boolean {
  return isSpecjalista(user);
}

/**
 * Check if user can create content (deals, products)
 * All authenticated users can create content
 */
export function canCreateContent(user: User | null): boolean {
  return user !== null;
}

/**
 * Get user role display name in Polish
 */
export function getRoleDisplayName(role: User['role']): string {
  const roleNames: Record<User['role'], string> = {
    'admin': 'Administrator',
    'moderator': 'Moderator',
    'specjalista': 'Specjalista',
    'user': 'Użytkownik'
  };
  return roleNames[role];
}

/**
 * Get list of all available roles
 */
export function getAllRoles(): Array<User['role']> {
  return ['admin', 'moderator', 'specjalista', 'user'];
}

/**
 * Check if a role exists and is valid
 */
export function isValidRole(role: string): role is User['role'] {
  return ['admin', 'moderator', 'specjalista', 'user'].includes(role);
}
