import { useCallback } from 'react';
import { hasAccess, type FeatureKey, type TierSlug } from '@spotter/types';

/**
 * Tier access checking hook.
 * Evaluates whether the current user's tier grants access to a given feature.
 *
 * @example
 * const { can, isLoading } = useTierAccess('select', 'huntMode');
 * if (can) { ... }
 */
export function useTierAccess(userTier: TierSlug, feature: FeatureKey) {
  const canAccess = useCallback(
    (featureKey: FeatureKey): boolean => hasAccess(userTier, featureKey),
    [userTier],
  );

  const check = useCallback(
    (featureKey: FeatureKey): boolean => hasAccess(userTier, featureKey),
    [userTier],
  );

  return {
    tier: userTier,
    can: hasAccess(userTier, feature),
    canAccess,
    check,
    isFree: userTier === 'free',
    isSelect: userTier === 'select',
    isSummit: userTier === 'summit',
    isPaid: userTier !== 'free',
  };
}
