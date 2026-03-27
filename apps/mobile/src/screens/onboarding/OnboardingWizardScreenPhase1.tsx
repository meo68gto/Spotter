import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { Button } from '../../components/Button';
import { showToast } from '../../components/ToastHost';
import { stockPhotos } from '../../lib/stockPhotos';
import { invokeFunction } from '../lib/api';
import { trackEvent } from '../../lib/analytics';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../theme/provider';
import type { TierSlug } from '../../components/TierBadge';

// ============================================================================
// Phase 1: Golf-Focused Onboarding Wizard
// Replaces multi-sport onboarding with tier-based golf networking flow
// ============================================================================

const STORAGE_KEY = 'spotter:onboarding-phase1-draft';

// Tier definitions for display - Epic 1: Enhanced with premium styling
const TIER_OPTIONS: {
  slug: TierSlug;
  name: string;
  price: string;
  description: string;
  features: string[];
  highlight?: string;
  gradient?: [string, string];
}[] = [
  {
    slug: 'free',
    name: 'Free',
    price: '$0',
    description: 'Connect with other golfers in your area',
    features: ['Limited to same-tier members', '3 matches/month', 'Basic profile'],
  },
  {
    slug: 'select',
    name: 'Select',
    price: '$1,000/year',
    description: 'Full access to unlimited connections within your tier',
    features: ['Unlimited connections', 'Video analysis', 'Priority matching', 'Event access'],
    highlight: 'Most Popular',
  },
  {
    slug: 'summit',
    name: 'Summit',
    price: '$10,000 lifetime',
    description: 'The ultimate experience with all features unlocked',
    features: ['Lifetime access', 'All features unlocked', 'Group sessions', 'Early access', 'Ad-free experience'],
    gradient: ['#FFD700', '#FFA500'], // Gold gradient for Summit
  },
];

// Handicap bands for self-assessment
const HANDICAP_BANDS = [
  { label: 'Beginner (25+)', value: 'beginner', maxHandicap: 54, typical: 30 },
  { label: 'Intermediate (10-24)', value: 'intermediate', maxHandicap: 24, typical: 18 },
  { label: 'Advanced (0-9)', value: 'advanced', maxHandicap: 9, typical: 5 },
  { label: 'Expert (Pro/Scratch)', value: 'expert', maxHandicap: 0, typical: 0 },
];

// Networking intent options
const NETWORKING_INTENTS = [
  { value: 'business', label: 'Business', description: 'Build professional relationships' },
  { value: 'social', label: 'Social', description: 'Meet new people' },
  { value: 'competitive', label: 'Competitive', description: 'Find serious golfers' },
  { value: 'business_social', label: 'Both', description: 'Professional + social' },
];

// Group size preferences
const GROUP_SIZES = [
  { value: '2', label: 'Twosome' },
  { value: '3', label: 'Threesome' },
  { value: '4', label: 'Foursome' },
  { value: 'any', label: 'Any size' },
];

// Cart preferences (legacy) + Epic 1 Mobility preferences
const MOBILITY_PREFERENCES = [
  { value: 'walking', label: 'Walking', icon: '🚶' },
  { value: 'walking_preferred', label: 'Walking Preferred', icon: '🚶' },
  { value: 'cart', label: 'Cart', icon: '🛒' },
  { value: 'cart_preferred', label: 'Cart Preferred', icon: '🛒' },
  { value: 'either', label: 'Either', icon: '↔️' },
];

// Epic 1: Round frequency for onboarding preferences
const ROUND_FREQUENCIES = [
  { value: 'multiple_per_week', label: 'Multiple/week' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'occasionally', label: 'Occasionally' },
  { value: 'rarely', label: 'Rarely' },
];

// Epic 1: Tee time preferences (expanded)
const TEE_TIME_PREFERENCES = [
  { value: 'early_bird', label: 'Early Bird', description: 'Before 9am' },
  { value: 'mid_morning', label: 'Mid-Morning', description: '9am-12pm' },
  { value: 'afternoon', label: 'Afternoon', description: '12pm-4pm' },
  { value: 'twilight', label: 'Twilight', description: 'After 4pm' },
  { value: 'weekends_only', label: 'Weekends', description: 'Only weekends' },
  { value: 'flexible', label: 'Flexible', description: 'No preference' },
];

// Step configuration
const STEPS = [
  { key: 'age', name: 'Age Verification', photo: stockPhotos.onboardingSport },
  { key: 'tier', name: 'Membership', photo: stockPhotos.onboardingSport },
  { key: 'golf', name: 'Golf Identity', photo: stockPhotos.onboardingSkill },
  { key: 'professional', name: 'Professional', photo: stockPhotos.onboardingLocation },
  { key: 'networking', name: 'Networking', photo: stockPhotos.onboardingAvailability },
] as const;

type StepKey = typeof STEPS[number]['key'];

// Draft state type
interface OnboardingDraft {
  // Tier selection
  tierSlug: TierSlug;

  // COPPA age verification
  dateOfBirth: string; // ISO date string 'YYYY-MM-DD'
  ageVerified: boolean; // true once age gate passed

  // Golf identity
  handicapBand: string;
  typicalScore: number;
  homeCourse: string;
  homeCourseArea: string; // Epic 1: Alternative to course ID
  playFrequency: string;
  yearsPlaying: string;

  // Professional identity
  role: string;
  company: string;
  industry: string;
  linkedinUrl: string;

  // Networking preferences
  networkingIntent: string;
  openToIntros: boolean;
  openToRecurring: boolean;
  preferredGroupSize: string;
  cartPreference: string;
  mobilityPreference: string; // Epic 1: Enhanced mobility preference
  preferredArea: string;
  roundFrequency: string; // Epic 1: How often user wants to play
  preferredTeeTimeWindow: string; // Epic 1: Preferred tee time

  // Location
  city: string;
  timezone: string;
}

const initialDraft: OnboardingDraft = {
  tierSlug: 'free',
  dateOfBirth: '',
  ageVerified: false,
  handicapBand: '',
  typicalScore: 0,
  homeCourse: '',
  homeCourseArea: '', // Epic 1
  playFrequency: '',
  yearsPlaying: '',
  role: '',
  company: '',
  industry: '',
  linkedinUrl: '',
  networkingIntent: '',
  openToIntros: true,
  openToRecurring: false,
  preferredGroupSize: 'any',
  cartPreference: 'either',
  mobilityPreference: 'either', // Epic 1
  preferredArea: '',
  roundFrequency: '', // Epic 1
  preferredTeeTimeWindow: '', // Epic 1
  city: '',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

export function OnboardingWizardScreenPhase1({ onComplete }: { onComplete: () => void }) {
  const { tokens } = useTheme();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<OnboardingDraft>(initialDraft);

  // Load saved draft on mount
  useEffect(() => {
    const load = async () => {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        setDraft({ ...initialDraft, ...JSON.parse(saved) });
      }
    };
    load();
  }, []);

  // Auto-save draft
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(draft)).catch(() => {
      // Silent fail - onboarding should be resilient
    });
  }, [draft]);

  const stepProgress = useMemo(() => `${step + 1}/${STEPS.length}`, [step]);
  const currentStep = STEPS[step];

  // Validation per step
  const validateStep = (): boolean => {
    switch (step) {
      case 0: // COPPA Age Gate
        if (!draft.dateOfBirth) {
          Alert.alert('Date of birth required', 'Please enter your date of birth to continue.');
          return false;
        }
        if (!draft.ageVerified) {
          // Calculate age
          const dob = new Date(draft.dateOfBirth);
          const today = new Date();
          let age = today.getFullYear() - dob.getFullYear();
          const monthDiff = today.getMonth() - dob.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
            age--;
          }
          if (age < 18) {
            Alert.alert(
              'Not eligible',
              'Spotter is available only to members who are 18 years of age or older. Please contact support@spotter.golf if you believe this is an error.',
              [{ text: 'OK' }]
            );
            return false;
          }
        }
        return true;

      case 1: // Tier
        if (!draft.tierSlug) {
          Alert.alert('Select a tier', 'Choose your membership level to continue.');
          return false;
        }
        return true;

      case 2: // Golf Identity
        if (!draft.handicapBand) {
          Alert.alert('Select skill level', 'Choose your handicap band to continue.');
          return false;
        }
        return true;

      case 3: // Professional
        // Optional step - allow skipping
        return true;

      case 4: // Networking
        if (!draft.networkingIntent) {
          Alert.alert('Select networking intent', 'Let us know what you\'re looking for.');
          return false;
        }
        return true;

      default:
        return true;
    }
  };

  // Submit onboarding data - Epic 1: Enhanced with all fields
  const submit = async () => {
    if (!validateStep()) return;
    setLoading(true);

    try {
      // Epic 1: Comprehensive onboarding payload
      const payload = {
        // COPPA age verification
        dateOfBirth: draft.dateOfBirth,
        ageVerified: draft.ageVerified,

        // Tier selection
        tierSlug: draft.tierSlug,

        // Golf identity
        golfIdentity: {
          handicapBand: draft.handicapBand,
          typicalScore: draft.typicalScore,
          homeCourse: draft.homeCourse || null,
          homeCourseArea: draft.homeCourseArea || null, // Epic 1
          playFrequency: draft.playFrequency || null,
          yearsPlaying: draft.yearsPlaying ? parseInt(draft.yearsPlaying, 10) : null,
        },

        // Professional identity (if provided)
        professionalIdentity: draft.role || draft.company ? {
          role: draft.role,
          company: draft.company,
          industry: draft.industry || null,
          linkedinUrl: draft.linkedinUrl || null,
        } : null,

        // Networking preferences - Epic 1: All fields
        networkingPreferences: {
          networkingIntent: draft.networkingIntent,
          industry: draft.industry || null,
          company: draft.company || null,
          titleOrRole: draft.role || null,
          openToIntros: draft.openToIntros,
          openToSendingIntros: draft.openToIntros, // Same for now
          openToRecurringRounds: draft.openToRecurring,
          preferredGroupSize: draft.preferredGroupSize,
          cartPreference: draft.cartPreference,
          mobilityPreference: draft.mobilityPreference, // Epic 1
          roundFrequency: draft.roundFrequency, // Epic 1
          preferredTeeTimeWindow: draft.preferredTeeTimeWindow, // Epic 1
          preferredGolfArea: draft.preferredArea || null,
        },

        // Location
        location: {
          city: draft.city,
          timezone: draft.timezone,
        },
      };

      // Call onboarding edge function
      await invokeFunction('onboarding-phase1', {
        method: 'POST',
        body: payload,
      });

      // Track completion
      const authUser = (await supabase.auth.getUser()).data.user;
      if (authUser) {
        await trackEvent('onboarding_phase1_completed', authUser.id, {
          tier_slug: draft.tierSlug,
          handicap_band: draft.handicapBand,
          networking_intent: draft.networkingIntent,
        });
      }

      // Clear draft and complete
      await AsyncStorage.removeItem(STORAGE_KEY);
      showToast({ type: 'success', title: 'Welcome to Spotter!' });
      onComplete();
    } catch (error) {
      console.error('Onboarding error:', error);
      Alert.alert(
        'Onboarding failed',
        error instanceof Error ? error.message : 'Please try again'
      );
    } finally {
      setLoading(false);
    }
  };

  const next = () => {
    if (!validateStep()) return;
    setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const back = () => setStep((prev) => Math.max(0, prev - 1));

  // Render step content
  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <ScrollView style={styles.panel} showsVerticalScrollIndicator={false}>
            <Text style={[styles.stepDescription, { color: tokens.textSecondary }]}>
              We are required to verify your age before creating an account, in compliance with applicable law.
            </Text>

            <Text style={[styles.sectionLabel, { color: tokens.text }]}>
              Date of Birth
            </Text>
            <Text style={[styles.helperText, { color: tokens.textMuted }]}>
              Spotter is available only to members 18 years of age or older.
            </Text>
            <TextInput
              value={draft.dateOfBirth}
              onChangeText={(text) => {
                // Auto-format as YYYY-MM-DD
                let cleaned = text.replace(/[^0-9]/g, '');
                let formatted = cleaned;
                if (cleaned.length > 4) {
                  formatted = cleaned.slice(0, 4) + '-' + cleaned.slice(4);
                }
                if (cleaned.length > 6) {
                  formatted = cleaned.slice(0, 4) + '-' + cleaned.slice(4, 6) + '-' + cleaned.slice(6, 8);
                }
                setDraft((prev) => ({ ...prev, dateOfBirth: formatted.slice(0, 10) }));
              }}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={tokens.textMuted}
              keyboardType="number-pad"
              maxLength={10}
              style={[
                styles.input,
                {
                  borderColor: tokens.borderStrong,
                  color: tokens.text,
                  backgroundColor: tokens.backgroundElevated,
                },
              ]}
            />

            <View style={[styles.ageGateDisclosure, { backgroundColor: tokens.backgroundElevated, borderColor: tokens.border }]}>
              <Text style={[styles.disclosureTitle, { color: tokens.text }]}>
                Privacy Notice
              </Text>
              <Text style={[styles.disclosureText, { color: tokens.textSecondary }]}>
                Your date of birth is collected solely to verify eligibility and is not used for any other purpose without your consent. We do not knowingly collect personal information from individuals under 18. For more information, see our{' '}
                <Text style={[styles.disclosureLink, { color: tokens.primary }]}>
                  Privacy Policy
                </Text>{' '}
                at spotter.golf/legal/privacy.
              </Text>
              <Text style={[styles.disclosureText, { color: tokens.textSecondary, marginTop: 8 }]}>
                You have the right to know what data we collect, to access it, and to request its deletion at any time. Contact us at{' '}
                <Text style={[styles.disclosureLink, { color: tokens.primary }]}>
                  privacy@spotter.golf
                </Text>{' '}
                for any privacy-related requests.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.verifyButton}
              onPress={() => {
                if (!draft.dateOfBirth) {
                  Alert.alert('Date of birth required', 'Please enter your date of birth to continue.');
                  return;
                }
                const dob = new Date(draft.dateOfBirth);
                const today = new Date();
                if (isNaN(dob.getTime())) {
                  Alert.alert('Invalid date', 'Please enter a valid date in YYYY-MM-DD format.');
                  return;
                }
                if (dob > today) {
                  Alert.alert('Invalid date', 'Date of birth cannot be in the future.');
                  return;
                }
                let age = today.getFullYear() - dob.getFullYear();
                const monthDiff = today.getMonth() - dob.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
                  age--;
                }
                if (age < 18) {
                  Alert.alert(
                    'Not eligible',
                    'Spotter is available only to members who are 18 years of age or older. Please contact support@spotter.golf if you believe this is an error.',
                    [{ text: 'OK' }]
                  );
                  return;
                }
                setDraft((prev) => ({ ...prev, ageVerified: true }));
                Alert.alert(
                  'Age verified',
                  `You are ${age} years old. Welcome to Spotter!`,
                  [{ text: 'Continue', onPress: () => setStep((prev) => Math.min(prev + 1, STEPS.length - 1)) }]
                );
              }}
            >
              <Text style={[styles.verifyButtonText, { color: '#fff' }]}>
                Verify Age
              </Text>
            </TouchableOpacity>
          </ScrollView>
        );

      case 1:
        return (
          <ScrollView style={styles.panel} showsVerticalScrollIndicator={false}>
            <Text style={[styles.stepDescription, { color: tokens.textSecondary }]}>
              Choose your membership tier. You can only connect with members in the same tier.
            </Text>

            {TIER_OPTIONS.map((tier, index) => {
              const active = draft.tierSlug === tier.slug;
              const isSummit = tier.slug === 'summit';
              const isSelect = tier.slug === 'select';

              return (
                <TouchableOpacity
                  key={tier.slug}
                  style={[
                    styles.tierCard,
                    isSummit && active && styles.tierCardSummitActive,
                    {
                      borderColor: active ? tokens.primary : tokens.border,
                      backgroundColor: active ? tokens.primary + '15' : tokens.surface,
                    },
                  ]}
                  onPress={() => setDraft((prev) => ({ ...prev, tierSlug: tier.slug }))}
                >
                  {/* Epic 1: Premium Summit styling */}
                  {isSummit && (
                    <View style={styles.summitBadge}>
                      <Text style={styles.summitBadgeText}>👑 LIFETIME</Text>
                    </View>
                  )}
                  {isSelect && tier.highlight && (
                    <View style={[styles.popularBadge, { backgroundColor: tokens.success }]}>
                      <Text style={styles.popularBadgeText}>{tier.highlight}</Text>
                    </View>
                  )}

                  <View style={styles.tierHeader}>
                    <Text style={[
                      styles.tierName,
                      isSummit && styles.tierNameSummit,
                      { color: tokens.text }
                    ]}>
                      {tier.name}
                    </Text>
                    <Text style={[
                      styles.tierPrice,
                      isSummit && styles.tierPriceSummit,
                      { color: tokens.primary }
                    ]}>
                      {tier.price}
                    </Text>
                  </View>

                  <Text style={[styles.tierDescription, { color: tokens.textSecondary }]}>
                    {tier.description}
                  </Text>

                  {/* Epic 1: Features list for better decision making */}
                  <View style={styles.tierFeatures}>
                    {tier.features.map((feature, i) => (
                      <View key={i} style={styles.featureRow}>
                        <Text style={[styles.featureCheck, { color: tokens.success }]}>✓</Text>
                        <Text style={[styles.featureText, { color: tokens.textSecondary }]}>
                          {feature}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {active && (
                    <View style={[styles.selectedBadge, { backgroundColor: tokens.primary }]}>
                      <Text style={styles.selectedText}>Selected</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        );

      case 2:
        return (
          <ScrollView style={styles.panel} showsVerticalScrollIndicator={false}>
            <Text style={[styles.stepDescription, { color: tokens.textSecondary }]}>
              Tell us about your golf game so we can match you with similar players.
            </Text>

            <Text style={[styles.sectionLabel, { color: tokens.text }]}>
              Skill Level
            </Text>
            {HANDICAP_BANDS.map((band) => {
              const active = draft.handicapBand === band.value;
              return (
                <TouchableOpacity
                  key={band.value}
                  style={[
                    styles.optionRow,
                    {
                      borderColor: active ? tokens.primary : tokens.border,
                      backgroundColor: active ? tokens.primary + '15' : tokens.surface,
                    },
                  ]}
                  onPress={() =>
                    setDraft((prev) => ({
                      ...prev,
                      handicapBand: band.value,
                      typicalScore: band.typical,
                    }))
                  }
                >
                  <Text style={[styles.optionText, { color: tokens.text }]}>
                    {band.label}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <Text style={[styles.sectionLabel, { color: tokens.text, marginTop: 20 }]}>
              Play Frequency
            </Text>
            <View style={styles.optionsGrid}>
              {PLAY_FREQUENCIES.map((freq) => {
                const active = draft.playFrequency === freq.value;
                return (
                  <TouchableOpacity
                    key={freq.value}
                    style={[
                      styles.gridOption,
                      {
                        borderColor: active ? tokens.primary : tokens.border,
                        backgroundColor: active ? tokens.primary + '15' : tokens.surface,
                      },
                    ]}
                    onPress={() => setDraft((prev) => ({ ...prev, playFrequency: freq.value }))}
                  >
                    <Text style={[styles.gridOptionText, { color: tokens.text }]}>
                      {freq.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { color: tokens.text, marginTop: 20 }]}>
              Home Course (Optional)
            </Text>
            <TextInput
              value={draft.homeCourse}
              onChangeText={(text) => setDraft((prev) => ({ ...prev, homeCourse: text }))}
              placeholder="e.g., TPC Scottsdale"
              placeholderTextColor={tokens.textMuted}
              style={[
                styles.input,
                {
                  borderColor: tokens.borderStrong,
                  color: tokens.text,
                  backgroundColor: tokens.backgroundElevated,
                },
              ]}
            />

            <Text style={[styles.sectionLabel, { color: tokens.text, marginTop: 12 }]}>
              Years Playing (Optional)
            </Text>
            <TextInput
              value={draft.yearsPlaying}
              onChangeText={(text) => setDraft((prev) => ({ ...prev, yearsPlaying: text }))}
              placeholder="e.g., 5"
              keyboardType="number-pad"
              placeholderTextColor={tokens.textMuted}
              style={[
                styles.input,
                {
                  borderColor: tokens.borderStrong,
                  color: tokens.text,
                  backgroundColor: tokens.backgroundElevated,
                },
              ]}
            />
          </ScrollView>
        );

      case 3:
        return (
          <ScrollView style={styles.panel} showsVerticalScrollIndicator={false}>
            <Text style={[styles.stepDescription, { color: tokens.textSecondary }]}>
              Add your professional information to enable business networking on the course.
              (Optional - you can skip this)
            </Text>

            <Text style={[styles.sectionLabel, { color: tokens.text }]}>
              Job Title
            </Text>
            <TextInput
              value={draft.role}
              onChangeText={(text) => setDraft((prev) => ({ ...prev, role: text }))}
              placeholder="e.g., CEO, Software Engineer"
              placeholderTextColor={tokens.textMuted}
              style={[
                styles.input,
                {
                  borderColor: tokens.borderStrong,
                  color: tokens.text,
                  backgroundColor: tokens.backgroundElevated,
                },
              ]}
            />

            <Text style={[styles.sectionLabel, { color: tokens.text, marginTop: 16 }]}>
              Company
            </Text>
            <TextInput
              value={draft.company}
              onChangeText={(text) => setDraft((prev) => ({ ...prev, company: text }))}
              placeholder="e.g., Acme Corp"
              placeholderTextColor={tokens.textMuted}
              style={[
                styles.input,
                {
                  borderColor: tokens.borderStrong,
                  color: tokens.text,
                  backgroundColor: tokens.backgroundElevated,
                },
              ]}
            />

            <Text style={[styles.sectionLabel, { color: tokens.text, marginTop: 16 }]}>
              Industry
            </Text>
            <TextInput
              value={draft.industry}
              onChangeText={(text) => setDraft((prev) => ({ ...prev, industry: text }))}
              placeholder="e.g., Technology, Finance"
              placeholderTextColor={tokens.textMuted}
              style={[
                styles.input,
                {
                  borderColor: tokens.borderStrong,
                  color: tokens.text,
                  backgroundColor: tokens.backgroundElevated,
                },
              ]}
            />

            <Text style={[styles.sectionLabel, { color: tokens.text, marginTop: 16 }]}>
              LinkedIn (Optional)
            </Text>
            <TextInput
              value={draft.linkedinUrl}
              onChangeText={(text) => setDraft((prev) => ({ ...prev, linkedinUrl: text }))}
              placeholder="https://linkedin.com/in/yourprofile"
              placeholderTextColor={tokens.textMuted}
              autoCapitalize="none"
              style={[
                styles.input,
                {
                  borderColor: tokens.borderStrong,
                  color: tokens.text,
                  backgroundColor: tokens.backgroundElevated,
                },
              ]}
            />
          </ScrollView>
        );

      case 4:
        return (
          <ScrollView style={styles.panel} showsVerticalScrollIndicator={false}>
            <Text style={[styles.stepDescription, { color: tokens.textSecondary }]}>
              Tell us what you're looking for so we can help you find the right golf partners.
            </Text>

            <Text style={[styles.sectionLabel, { color: tokens.text }]}>
              Networking Intent
            </Text>
            {NETWORKING_INTENTS.map((intent) => {
              const active = draft.networkingIntent === intent.value;
              return (
                <TouchableOpacity
                  key={intent.value}
                  style={[
                    styles.intentCard,
                    {
                      borderColor: active ? tokens.primary : tokens.border,
                      backgroundColor: active ? tokens.primary + '15' : tokens.surface,
                    },
                  ]}
                  onPress={() => setDraft((prev) => ({ ...prev, networkingIntent: intent.value }))}
                >
                  <Text style={[styles.intentLabel, { color: tokens.text }]}>
                    {intent.label}
                  </Text>
                  <Text style={[styles.intentDescription, { color: tokens.textSecondary }]}>
                    {intent.description}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <Text style={[styles.sectionLabel, { color: tokens.text, marginTop: 24 }]}>
              Round Preferences
            </Text>

            <Text style={[styles.subLabel, { color: tokens.textSecondary }]}>
              Preferred Group Size
            </Text>
            <View style={styles.optionsGrid}>
              {GROUP_SIZES.map((size) => {
                const active = draft.preferredGroupSize === size.value;
                return (
                  <TouchableOpacity
                    key={size.value}
                    style={[
                      styles.gridOption,
                      {
                        borderColor: active ? tokens.primary : tokens.border,
                        backgroundColor: active ? tokens.primary + '15' : tokens.surface,
                      },
                    ]}
                    onPress={() => setDraft((prev) => ({ ...prev, preferredGroupSize: size.value }))}
                  >
                    <Text style={[styles.gridOptionText, { color: tokens.text }]}>
                      {size.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.subLabel, { color: tokens.textSecondary, marginTop: 16 }]}>
              Mobility Preference
            </Text>
            <View style={styles.optionsGrid}>
              {MOBILITY_PREFERENCES.map((pref) => {
                const active = draft.mobilityPreference === pref.value;
                return (
                  <TouchableOpacity
                    key={pref.value}
                    style={[
                      styles.gridOption,
                      {
                        borderColor: active ? tokens.primary : tokens.border,
                        backgroundColor: active ? tokens.primary + '15' : tokens.surface,
                      },
                    ]}
                    onPress={() => setDraft((prev) => ({ ...prev, mobilityPreference: pref.value }))}
                  >
                    <Text style={[styles.gridOptionText, { color: tokens.text }]}>
                      {pref.icon} {pref.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Epic 1: Round Frequency */}
            <Text style={[styles.subLabel, { color: tokens.textSecondary, marginTop: 16 }]}>
              Round Frequency
            </Text>
            <Text style={[styles.helperText, { color: tokens.textMuted }]}>
              How often do you want to play?
            </Text>
            <View style={styles.optionsGrid}>
              {ROUND_FREQUENCIES.map((freq) => {
                const active = draft.roundFrequency === freq.value;
                return (
                  <TouchableOpacity
                    key={freq.value}
                    style={[
                      styles.gridOption,
                      {
                        borderColor: active ? tokens.primary : tokens.border,
                        backgroundColor: active ? tokens.primary + '15' : tokens.surface,
                      },
                    ]}
                    onPress={() => setDraft((prev) => ({ ...prev, roundFrequency: freq.value }))}
                  >
                    <Text style={[styles.gridOptionText, { color: tokens.text }]}>
                      {freq.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Epic 1: Preferred Tee Time Window */}
            <Text style={[styles.subLabel, { color: tokens.textSecondary, marginTop: 16 }]}>
              Preferred Tee Time
            </Text>
            <Text style={[styles.helperText, { color: tokens.textMuted }]}>
              When do you prefer to tee off?
            </Text>
            <View style={styles.teeTimeGrid}>
              {TEE_TIME_PREFERENCES.map((time) => {
                const active = draft.preferredTeeTimeWindow === time.value;
                return (
                  <TouchableOpacity
                    key={time.value}
                    style={[
                      styles.teeTimeOption,
                      {
                        borderColor: active ? tokens.primary : tokens.border,
                        backgroundColor: active ? tokens.primary + '15' : tokens.surface,
                      },
                    ]}
                    onPress={() => setDraft((prev) => ({ ...prev, preferredTeeTimeWindow: time.value }))}
                  >
                    <Text style={[styles.teeTimeLabel, { color: tokens.text }]}>
                      {time.label}
                    </Text>
                    <Text style={[styles.teeTimeDescription, { color: tokens.textMuted }]}>
                      {time.description}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { color: tokens.text, marginTop: 24 }]}>
              Preferences
            </Text>

            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setDraft((prev) => ({ ...prev, openToIntros: !prev.openToIntros }))}
            >
              <View style={[
                styles.toggle,
                { backgroundColor: draft.openToIntros ? tokens.primary : tokens.border }
              ]}>
                <View style={[
                  styles.toggleKnob,
                  { transform: [{ translateX: draft.openToIntros ? 20 : 0 }] }
                ]} />
              </View>
              <Text style={[styles.toggleLabel, { color: tokens.text }]}>
                Open to introductions
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setDraft((prev) => ({ ...prev, openToRecurring: !prev.openToRecurring }))}
            >
              <View style={[
                styles.toggle,
                { backgroundColor: draft.openToRecurring ? tokens.primary : tokens.border }
              ]}>
                <View style={[
                  styles.toggleKnob,
                  { transform: [{ translateX: draft.openToRecurring ? 20 : 0 }] }
                ]} />
              </View>
              <Text style={[styles.toggleLabel, { color: tokens.text }]}>
                Open to recurring rounds
              </Text>
            </TouchableOpacity>

            <Text style={[styles.sectionLabel, { color: tokens.text, marginTop: 24 }]}>
              Preferred Golf Area (Optional)
            </Text>
            <TextInput
              value={draft.preferredArea}
              onChangeText={(text) => setDraft((prev) => ({ ...prev, preferredArea: text }))}
              placeholder="e.g., Scottsdale, AZ"
              placeholderTextColor={tokens.textMuted}
              style={[
                styles.input,
                {
                  borderColor: tokens.borderStrong,
                  color: tokens.text,
                  backgroundColor: tokens.backgroundElevated,
                },
              ]}
            />

            <Text style={[styles.sectionLabel, { color: tokens.text, marginTop: 16 }]}>
              Your City
            </Text>
            <TextInput
              value={draft.city}
              onChangeText={(text) => setDraft((prev) => ({ ...prev, city: text }))}
              placeholder="e.g., Phoenix"
              placeholderTextColor={tokens.textMuted}
              style={[
                styles.input,
                {
                  borderColor: tokens.borderStrong,
                  color: tokens.text,
                  backgroundColor: tokens.backgroundElevated,
                },
              ]}
            />
          </ScrollView>
        );

      default:
        return null;
    }
  };

  return (
    <ImageBackground
      source={{ uri: currentStep.photo }}
      style={styles.bg}
      imageStyle={styles.bgImage}
    >
      <View style={styles.overlay}>
        <Animated.View
          entering={FadeInRight.duration(220)}
          style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
        >
          <Text style={[styles.progress, { color: tokens.textMuted }]}>
            Step {stepProgress}
          </Text>
          <Text style={[styles.title, { color: tokens.text }]}>
            {currentStep.name}
          </Text>

          {renderStepContent()}

          <View style={styles.actions}>
            <Button
              title="Back"
              onPress={back}
              tone="secondary"
              disabled={step === 0 || loading}
            />
            {step < STEPS.length - 1 ? (
              <Button title="Next" onPress={next} disabled={loading} />
            ) : (
              <Button
                title={loading ? 'Creating Profile...' : 'Complete'}
                onPress={submit}
                disabled={loading}
              />
            )}
          </View>
        </Animated.View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  bgImage: {
    resizeMode: 'cover',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(4, 10, 15, 0.42)',
    padding: 16,
    justifyContent: 'flex-end',
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    maxHeight: '86%',
  },
  progress: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
  },
  panel: {
    marginTop: 12,
    marginBottom: 6,
  },
  stepDescription: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  subLabel: {
    fontSize: 13,
    marginBottom: 8,
  },
  // Tier cards
  tierCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  tierCardSummitActive: {
    borderWidth: 2,
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  summitBadge: {
    position: 'absolute',
    top: -8,
    right: 12,
    backgroundColor: '#FFD700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  summitBadgeText: {
    color: '#1a1a1a',
    fontSize: 10,
    fontWeight: '800',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  tierName: {
    fontSize: 18,
    fontWeight: '800',
  },
  tierNameSummit: {
    fontSize: 20,
    fontWeight: '900',
  },
  tierPrice: {
    fontSize: 16,
    fontWeight: '700',
  },
  tierPriceSummit: {
    fontSize: 18,
    fontWeight: '800',
  },
  tierDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  tierFeatures: {
    marginTop: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  featureCheck: {
    marginRight: 8,
    fontSize: 12,
    fontWeight: '700',
  },
  featureText: {
    fontSize: 12,
  },
  selectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  selectedText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  // Options
  optionRow: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridOption: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  gridOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Intent cards
  intentCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  intentLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  intentDescription: {
    fontSize: 13,
  },
  // Inputs
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
  },
  // Toggles
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 2,
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  toggleLabel: {
    marginLeft: 12,
    fontSize: 15,
    fontWeight: '500',
  },
  // Epic 1: Helper text for field descriptions
  helperText: {
    fontSize: 12,
    marginTop: -4,
    marginBottom: 10,
  },
  // Epic 1: Tee time grid styles
  teeTimeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  teeTimeOption: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: '48%',
    alignItems: 'center',
  },
  teeTimeLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  teeTimeDescription: {
    fontSize: 11,
  },
  // Actions
  actions: {
    marginTop: 8,
    marginBottom: 4,
  },
  // COPPA Age Gate
  ageGateDisclosure: {
    marginTop: 20,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  disclosureTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  disclosureText: {
    fontSize: 12,
    lineHeight: 18,
  },
  disclosureLink: {
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  verifyButton: {
    marginTop: 20,
    backgroundColor: '#16a34a',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  verifyButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
