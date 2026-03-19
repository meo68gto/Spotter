import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ImageBackground,
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
import { invokeFunction } from '../../lib/api';
import { trackEvent } from '../../lib/analytics';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../theme/provider';
import type { TierSlug } from '../../components/TierBadge';

// ============================================================================
// Phase 1: Golf-Focused Onboarding Wizard
// Replaces multi-sport onboarding with tier-based golf networking flow
// ============================================================================

const STORAGE_KEY = 'spotter:onboarding-phase1-draft';

// Tier definitions for display
const TIER_OPTIONS: { slug: TierSlug; name: string; price: string; description: string }[] = [
  {
    slug: 'free',
    name: 'Free',
    price: '$0',
    description: 'Connect with other golfers in your area. Limited to same-tier members.',
  },
  {
    slug: 'select',
    name: 'Select',
    price: '$1,000/year',
    description: 'Full access to unlimited connections within your tier. Premium networking.',
  },
  {
    slug: 'summit',
    name: 'Summit',
    price: '$10,000 lifetime',
    description: 'Lifetime unlimited access with priority boosts and exclusive features.',
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

// Cart preferences
const CART_PREFS = [
  { value: 'walking', label: 'Walking' },
  { value: 'cart', label: 'Riding' },
  { value: 'either', label: 'Either' },
];

// Play frequency
const PLAY_FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'occasionally', label: 'Occasionally' },
];

// Step configuration
const STEPS = [
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
  
  // Golf identity
  handicapBand: string;
  typicalScore: number;
  homeCourse: string;
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
  preferredArea: string;
  
  // Location
  city: string;
  timezone: string;
}

const initialDraft: OnboardingDraft = {
  tierSlug: 'free',
  handicapBand: '',
  typicalScore: 0,
  homeCourse: '',
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
  preferredArea: '',
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
      case 0: // Tier
        if (!draft.tierSlug) {
          Alert.alert('Select a tier', 'Choose your membership level to continue.');
          return false;
        }
        return true;
        
      case 1: // Golf Identity
        if (!draft.handicapBand) {
          Alert.alert('Select skill level', 'Choose your handicap band to continue.');
          return false;
        }
        return true;
        
      case 2: // Professional
        // Optional step - allow skipping
        return true;
        
      case 3: // Networking
        if (!draft.networkingIntent) {
          Alert.alert('Select networking intent', 'Let us know what you\'re looking for.');
          return false;
        }
        return true;
        
      default:
        return true;
    }
  };

  // Submit onboarding data
  const submit = async () => {
    if (!validateStep()) return;
    setLoading(true);
    
    try {
      // Build the onboarding payload
      const payload = {
        // Tier selection
        tierSlug: draft.tierSlug,
        
        // Golf identity
        golfIdentity: {
          handicapBand: draft.handicapBand,
          typicalScore: draft.typicalScore,
          homeCourse: draft.homeCourse || null,
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
        
        // Networking preferences
        networkingPreferences: {
          networkingIntent: draft.networkingIntent,
          openToIntros: draft.openToIntros,
          openToSendingIntros: draft.openToIntros, // Same for now
          openToRecurringRounds: draft.openToRecurring,
          preferredGroupSize: draft.preferredGroupSize,
          cartPreference: draft.cartPreference,
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
              Choose your membership tier. You can only connect with members in the same tier.
            </Text>
            
            {TIER_OPTIONS.map((tier) => {
              const active = draft.tierSlug === tier.slug;
              return (
                <TouchableOpacity
                  key={tier.slug}
                  style={[
                    styles.tierCard,
                    { 
                      borderColor: active ? tokens.primary : tokens.border,
                      backgroundColor: active ? tokens.primary + '15' : tokens.surface,
                    },
                  ]}
                  onPress={() => setDraft((prev) => ({ ...prev, tierSlug: tier.slug }))}
                >
                  <View style={styles.tierHeader}>
                    <Text style={[styles.tierName, { color: tokens.text }]}>
                      {tier.name}
                    </Text>
                    <Text style={[styles.tierPrice, { color: tokens.primary }]}>
                      {tier.price}
                    </Text>
                  </View>
                  <Text style={[styles.tierDescription, { color: tokens.textSecondary }]}>
                    {tier.description}
                  </Text>
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
        
      case 1:
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
        
      case 2:
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
        
      case 3:
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
              Cart Preference
            </Text>
            <View style={styles.optionsGrid}>
              {CART_PREFS.map((pref) => {
                const active = draft.cartPreference === pref.value;
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
                    onPress={() => setDraft((prev) => ({ ...prev, cartPreference: pref.value }))}
                  >
                    <Text style={[styles.gridOptionText, { color: tokens.text }]}>
                      {pref.label}
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
    borderWidth: 2,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
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
  tierPrice: {
    fontSize: 16,
    fontWeight: '700',
  },
  tierDescription: {
    fontSize: 13,
    lineHeight: 18,
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
  // Actions
  actions: {
    marginTop: 8,
    marginBottom: 4,
  },
});
