/**
 * Spotter Component Library — Barrel Export
 *
 * Import any component from this single entry point:
 *
 *   import { Button, Card, Avatar, Badge } from '../components';
 *
 * Or with explicit path for tree-shaking:
 *
 *   import { Button } from '../components/Button';
 */

// ─── Avatar ────────────────────────────────────────────────────────────────────
export { Avatar } from './Avatar';
export type { AvatarProps, AvatarSize, AvatarVariant, AvatarStatus } from './Avatar';

// ─── Badge ────────────────────────────────────────────────────────────────────
export { Badge } from './Badge';
export type { BadgeProps, BadgeVariant, BadgeSize } from './Badge';

// ─── BottomSheet ──────────────────────────────────────────────────────────────
export { BottomSheet } from './BottomSheet';
export type { BottomSheetProps } from './BottomSheet';

// ─── Button ────────────────────────────────────────────────────────────────────
export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

// ─── Card ────────────────────────────────────────────────────────────────────
export { Card, PlayerCard, CoachCard, EventCard, StatCard as CardStatCard } from './Card';
export type {
  CardProps, CardVariant,
  PlayerCardProps,
  CoachCardProps,
  EventCardProps,
  StatCardProps as CardStatCardProps,
} from './Card';

// ─── ChatBubble ───────────────────────────────────────────────────────────
export { ChatBubble } from './ChatBubble';
export type { ChatBubbleProps, ChatBubbleVariant, ChatBubbleStatus } from './ChatBubble';

// ─── CoachMark ───────────────────────────────────────────────────────────
export { CoachMark } from './CoachMark';
export type { CoachMarkProps, CoachMarkStep, CoachMarkPlacement } from './CoachMark';

// ─── EmptyState ───────────────────────────────────────────────────────────
export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

// ─── FilterChip ───────────────────────────────────────────────────────────
export { FilterChip } from './FilterChip';
export type { FilterChipProps, FilterChipVariant } from './FilterChip';

// ─── Header ────────────────────────────────────────────────────────────────────
export { Header } from './Header';
export type { HeaderProps, HeaderAction, HeaderVariant } from './Header';

// ─── Input ────────────────────────────────────────────────────────────────────
export { Input } from './Input';
export type { InputProps, InputVariant, InputSize } from './Input';

// ─── ListItem ───────────────────────────────────────────────────────────────────
export { ListItem } from './ListItem';
export type { ListItemProps, ListItemVariant } from './ListItem';

// ─── MapPin ───────────────────────────────────────────────────────────────────
export { MapPin } from './MapPin';
export type { MapPinProps, MapPinVariant } from './MapPin';

// ─── MatchCard ─────────────────────────────────────────────────────────────────
export { MatchCard } from './MatchCard';
export type { MatchCardProps, MatchStatus, MatchType } from './MatchCard';

// ─── ProgressRing ───────────────────────────────────────────────────────────
export { ProgressRing } from './ProgressRing';
export type { ProgressRingProps, ProgressRingSize } from './ProgressRing';

// ─── Rating ────────────────────────────────────────────────────────────────────
export { Rating } from './Rating';
export type { RatingProps, RatingSize } from './Rating';

// ─── SkeletonLoader ───────────────────────────────────────────────────────────
export { SkeletonLoader } from './SkeletonLoader';
export type { SkeletonLoaderProps, SkeletonVariant } from './SkeletonLoader';

// ─── StatCard ───────────────────────────────────────────────────────────────────
export { StatCard } from './StatCard';
export type { StatCardProps, StatCardVariant, StatCardTrend } from './StatCard';

// ─── TabBar ────────────────────────────────────────────────────────────────────
export { TabBar } from './TabBar';
export type { TabBarProps, TabBarTab } from './TabBar';

// ─── Toast ────────────────────────────────────────────────────────────────────
export { Toast } from './Toast';
export type { ToastProps, ToastVariant, ToastPosition } from './Toast';
