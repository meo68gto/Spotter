import { useCallback, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../theme/provider';
import { spacing, radius, shadows } from '../theme/design';
import { Button } from './Button';
import { useUpgrade } from '../hooks/useUpgrade';
import type { TierSlug } from '@spotter/types';

interface UpgradeModalProps {
  visible: boolean;
  onClose: () => void;
  currentTier: TierSlug;
}

interface TierOption {
  slug: TierSlug;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
}

const TIER_OPTIONS: TierOption[] = [
  {
    slug: 'free',
    name: 'Free',
    description: 'Get started with basic features',
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      '3 matches per month',
      '5 sessions per month',
      'Basic profile',
      'Standard support',
    ],
  },
  {
    slug: 'select',
    name: 'Select',
    description: 'Unlock unlimited matches and sessions',
    priceMonthly: 999,
    priceYearly: 9990,
    features: [
      'Unlimited matches',
      'Unlimited sessions',
      '10 video analyses per month',
      'Priority matching',
      'Advanced analytics',
      'Direct coach messaging',
      'Event access',
      'Profile badges',
      'Ad-free experience',
    ],
  },
  {
    slug: 'summit',
    name: 'Summit',
    description: 'Elite tier with unlimited everything',
    priceMonthly: 2999,
    priceYearly: 29990,
    features: [
      'Everything in Select',
      'Unlimited video analysis',
      'Early access to features',
      'Boosted visibility',
      'Group session hosting',
      'VIP support',
      'Exclusive events',
    ],
  },
];

export function UpgradeModal({ visible, onClose, currentTier }: UpgradeModalProps) {
  const { tokens } = useTheme();
  const { initiateUpgrade, loading, error } = useUpgrade();
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [success, setSuccess] = useState(false);

  const handleUpgrade = useCallback(
    async (targetTier: TierSlug) => {
      if (targetTier === 'free' || targetTier === currentTier) return;

      const result = await initiateUpgrade(targetTier, billingInterval);
      
      if (result.success) {
        setSuccess(true);
        // Reset after 2 seconds
        setTimeout(() => {
          setSuccess(false);
          onClose();
        }, 2000);
      }
    },
    [currentTier, billingInterval, initiateUpgrade, onClose]
  );

  const formatPrice = (cents: number, interval: 'monthly' | 'yearly') => {
    if (cents === 0) return 'Free';
    const dollars = (cents / 100).toFixed(2);
    const period = interval === 'yearly' ? '/year' : '/month';
    return `$${dollars}${period}`;
  };

  const getSavings = (tier: TierOption) => {
    if (tier.priceYearly === 0) return null;
    const monthlyCost = tier.priceMonthly * 12;
    const savings = monthlyCost - tier.priceYearly;
    const savingsPercent = Math.round((savings / monthlyCost) * 100);
    return savingsPercent;
  };

  const getAvailableTiers = () => {
    const currentIndex = TIER_OPTIONS.findIndex((t) => t.slug === currentTier);
    return TIER_OPTIONS.slice(currentIndex + 1);
  };

  const availableTiers = getAvailableTiers();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: tokens.overlay }]}>
        <View style={[styles.container, { backgroundColor: tokens.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: tokens.text }]}>
              Upgrade Your Plan
            </Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={[styles.closeText, { color: tokens.textMuted }]}>
                ✕
              </Text>
            </Pressable>
          </View>

          {success ? (
            <View style={styles.successContainer}>
              <Text style={[styles.successText, { color: tokens.success }]}>
                ✓ Upgrade initiated! Check your email to complete payment.
              </Text>
            </View>
          ) : (
            <>
              {/* Billing Toggle */}
              <View style={[styles.billingToggle, { backgroundColor: tokens.backgroundMuted }]}>
                <Pressable
                  style={[
                    styles.billingButton,
                    billingInterval === 'monthly' && [
                      styles.billingButtonActive,
                      { backgroundColor: tokens.surface },
                    ],
                  ]}
                  onPress={() => setBillingInterval('monthly')}
                >
                  <Text
                    style={[
                      styles.billingText,
                      { color: billingInterval === 'monthly' ? tokens.text : tokens.textMuted },
                    ]}
                  >
                    Monthly
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.billingButton,
                    billingInterval === 'yearly' && [
                      styles.billingButtonActive,
                      { backgroundColor: tokens.surface },
                    ],
                  ]}
                  onPress={() => setBillingInterval('yearly')}
                >
                  <Text
                    style={[
                      styles.billingText,
                      { color: billingInterval === 'yearly' ? tokens.text : tokens.textMuted },
                    ]}
                  >
                    Yearly
                    {billingInterval === 'yearly' && (
                      <Text style={[styles.savingsBadge, { color: tokens.success }]}>
                        {' '}Save 17%
                      </Text>
                    )}
                  </Text>
                </Pressable>
              </View>

              {error && (
                <Text style={[styles.errorText, { color: tokens.danger }]}>
                  {error}
                </Text>
              )}

              {/* Tier Comparison */}
              <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                <View style={styles.comparisonSection}>
                  <Text style={[styles.sectionTitle, { color: tokens.text }]}>
                    Current Plan: {TIER_OPTIONS.find((t) => t.slug === currentTier)?.name}
                  </Text>
                </View>

                {availableTiers.length === 0 ? (
                  <Text style={[styles.noUpgradeText, { color: tokens.textMuted }]}>
                    You're already on our highest tier!
                  </Text>
                ) : (
                  availableTiers.map((tier) => {
                    const savings = getSavings(tier);
                    return (
                      <View
                        key={tier.slug}
                        style={[
                          styles.tierCard,
                          { backgroundColor: tokens.backgroundMuted, borderColor: tokens.border },
                        ]}
                      >
                        <View style={styles.tierHeader}>
                          <View>
                            <Text style={[styles.tierName, { color: tokens.text }]}>
                              {tier.name}
                            </Text>
                            <Text style={[styles.tierDescription, { color: tokens.textMuted }]}>
                              {tier.description}
                            </Text>
                          </View>
                          <View style={styles.priceContainer}>
                            <Text style={[styles.price, { color: tokens.text }]}>
                              {formatPrice(
                                billingInterval === 'yearly' ? tier.priceYearly : tier.priceMonthly,
                                billingInterval
                              )}
                            </Text>
                            {billingInterval === 'yearly' && savings && (
                              <Text style={[styles.savingsText, { color: tokens.success }]}>
                                Save {savings}%
                              </Text>
                            )}
                          </View>
                        </View>

                        <View style={styles.featuresList}>
                          {tier.features.map((feature, index) => (
                            <View key={index} style={styles.featureItem}>
                              <Text style={[styles.featureCheck, { color: tokens.success }]}>
                                ✓
                              </Text>
                              <Text style={[styles.featureText, { color: tokens.text }]}>
                                {feature}
                              </Text>
                            </View>
                          ))}
                        </View>

                        <Button
                          title={loading ? 'Processing...' : `Upgrade to ${tier.name}`}
                          onPress={() => handleUpgrade(tier.slug)}
                          disabled={loading}
                          tone="primary"
                        />
                        {loading && <ActivityIndicator style={styles.loader} color={tokens.primary} />}
                      </View>
                    );
                  })
                )}

                {/* Current Plan Features */}
                <View style={styles.currentPlanSection}>
                  <Text style={[styles.sectionTitle, { color: tokens.text }]}>
                    Your Current Features
                  </Text>
                  {TIER_OPTIONS.find((t) => t.slug === currentTier)?.features.map((feature, index) => (
                    <View key={index} style={styles.featureItem}>
                      <Text style={[styles.featureCheck, { color: tokens.textMuted }]}>
                        •
                      </Text>
                      <Text style={[styles.featureText, { color: tokens.textMuted }]}>
                        {feature}
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: spacing.sm,
  },
  closeText: {
    fontSize: 20,
    fontWeight: '600',
  },
  billingToggle: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing.md,
  },
  billingButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.pill,
  },
  billingButtonActive: {
    ...shadows.card,
  },
  billingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  savingsBadge: {
    fontSize: 12,
    fontWeight: '600',
  },
  errorText: {
    textAlign: 'center',
    marginBottom: spacing.sm,
    fontSize: 14,
  },
  scrollView: {
    maxHeight: '70%',
  },
  comparisonSection: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  noUpgradeText: {
    textAlign: 'center',
    fontSize: 16,
    marginVertical: spacing.lg,
  },
  tierCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  tierName: {
    fontSize: 18,
    fontWeight: '700',
  },
  tierDescription: {
    fontSize: 14,
    marginTop: 2,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
  },
  savingsText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  featuresList: {
    marginBottom: spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  featureCheck: {
    fontSize: 14,
    marginRight: spacing.sm,
    width: 20,
  },
  featureText: {
    fontSize: 14,
  },
  currentPlanSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  successContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  successText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  loader: {
    marginTop: spacing.sm,
  },
});
