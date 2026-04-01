/**
 * BIPAConsentScreen — Step 4 of Spotter onboarding
 *
 * Displays BIPA (Illinois Biometric Information Privacy Act) disclosure before
 * Eagle AI biometric data processing (pose keypoints from swing videos).
 *
 * Trigger logic (caller decides when to show):
 *   - Show if isIllinois === true  (geo-IP or user-provided location detected Illinois)
 *   - Show if locationDenied === true  (worst-case: treat ALL users as Illinois)
 *
 * If the user declines, they can still use the app but video AI analysis is disabled.
 * The app should check `bipa_consent_given` before enabling Eagle AI features.
 *
 * Refs:
 *   - Eagle AI Privacy Addendum §8:  ~/.openclaw/batcave/docs/LEGAL/EAGLE_AI_PRIVACY.md
 *   - DATA_RETENTION.md §3:  90-day video retention
 *   - Spotter legal audit (Diana):  ~/.openclaw/batcave/research/spotter-legal-audit.md
 */

import { useState } from 'react';
import {
  Alert,
  ImageBackground,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { Button } from '../../components/Button';
import { invokeFunction } from '../../lib/api';
import { trackEvent } from '../../lib/analytics';
import { supabase } from '../../lib/supabase';
import { stockPhotos } from '../../lib/stockPhotos';
import { useTheme } from '../../theme/provider';

// BIPA disclosure version — increment whenever disclosure text changes
export const BIPA_VERSION = '1.0';

export type BIPAConsentResult = {
  bipa_accepted: boolean;
  is_illinois: boolean;
  location_denied: boolean;
  bipa_version: string;
};

type Props = {
  /**
   * True when the user is detected as an Illinois resident via geo-IP or
   * self-reported location. When false AND locationDenied is false, this
   * screen should not render at all.
   */
  isIllinois: boolean;

  /**
   * True when the device blocked location access. Per BIPA worst-case
   * guidance, all such users are treated as Illinois and must see this
   * screen before biometric processing.
   */
  locationDenied: boolean;

  /** Called when the user has finished interacting (accept or decline). */
  onComplete: (result: BIPAConsentResult) => void;
};

/**
 * Illinois state FIPS code — used if Supabase ever stores state-level location.
 */
export const ILLINOIS_FIPS = '17';

export function BIPAConsentScreen({ isIllinois, locationDenied, onComplete }: Props) {
  const { tokens } = useTheme();
  const [loading, setLoading] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);

  const recordAndComplete = async (accepted: boolean) => {
    setLoading(true);
    try {
      await invokeFunction('bipa-consent', {
        method: 'POST',
        body: {
          bipa_accepted: accepted,
          is_illinois: isIllinois,
          location_denied: locationDenied,
          bipa_version: BIPA_VERSION,
        },
      });

      const authUser = (await supabase.auth.getUser()).data.user;
      if (authUser) {
        await trackEvent(
          accepted ? 'bipa_consent_accepted' : 'bipa_consent_declined',
          authUser.id,
          {
            is_illinois: isIllinois,
            location_denied: locationDenied,
            bipa_version: BIPA_VERSION,
          }
        );
      }

      onComplete({
        bipa_accepted: accepted,
        is_illinois: isIllinois,
        location_denied: locationDenied,
        bipa_version: BIPA_VERSION,
      });
    } catch (err) {
      Alert.alert(
        'Consent failed',
        err instanceof Error ? err.message : 'An unknown error occurred. Please try again.',
        [
          {
            text: 'Retry',
            onPress: () => recordAndComplete(accepted),
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    if (!consentChecked) {
      Alert.alert('Consent required', 'Please check the box to confirm your consent before continuing.');
      return;
    }
    recordAndComplete(true);
  };

  const handleDecline = () => {
    Alert.alert(
      'AI Analysis Disabled',
      'You can still use Spotter without AI swing analysis. You may enable AI coaching anytime from Settings.',
      [
        { text: 'I Understand', onPress: () => recordAndComplete(false) },
        { text: 'Go Back', style: 'cancel' },
      ]
    );
  };

  return (
    <ImageBackground
      source={{ uri: stockPhotos.onboardingSport }}
      style={styles.bg}
      imageStyle={styles.bgImage}
    >
      <View style={styles.overlay}>
        <Animated.View
          entering={FadeInRight.duration(220)}
          style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
        >
          {/* Header */}
          <Text style={[styles.progress, { color: tokens.textMuted }]}>Step 4 of 4</Text>
          <Text style={[styles.title, { color: tokens.text }]}>Biometric Data Notice</Text>
          {locationDenied && (
            <View style={[styles.noticeBanner, { backgroundColor: tokens.warning + '20', borderColor: tokens.warning }]}>
              <Text style={[styles.noticeBannerText, { color: tokens.warning }]}>
                Location access was denied — you are receiving this notice as a precaution.
              </Text>
            </View>
          )}

          <ScrollView style={styles.panel} showsVerticalScrollIndicator={false}>
            {/* What is collected */}
            <Text style={[styles.sectionHeading, { color: tokens.text }]}>
              What biometric data we collect
            </Text>
            <Text style={[styles.bodyText, { color: tokens.textSecondary }]}>
              To provide AI-powered golf coaching, Spotter's Eagle AI feature analyzes your
              swing videos and extracts pose keypoints — body position data including joint
              angles, skeletal geometry, and swing plane measurements. This is biometric-adjacent
              data under Illinois law.
            </Text>

            {/* Illinois-specific notice */}
            <View style={[styles.legalBox, { borderColor: tokens.primary }]}>
              <Text style={[styles.legalBoxTitle, { color: tokens.primary }]}>
                Illinois Residents — BIPA Notice
              </Text>
              <Text style={[styles.bodyText, { color: tokens.textSecondary }]}>
                Under the Illinois Biometric Information Privacy Act (BIPA), pose keypoints
                extracted from your swing video may constitute biometric identifiers. Spotter
                will not collect, store, or use this data without your explicit written consent.
              </Text>
            </View>

            {/* How it's used */}
            <Text style={[styles.sectionHeading, { color: tokens.text }]}>
              How we use it
            </Text>
            <Text style={[styles.bodyText, { color: tokens.textSecondary }]}>
              Your biometric data is used solely to generate AI-powered golf coaching
              recommendations — swing tips, drill suggestions, and corrective cues. It is{' '}
              <Text style={styles.bold}>never sold or shared</Text> with third parties.
              Video frames are processed locally via Ollama on Spotter's servers; no data
              is sent to external AI providers.
            </Text>

            {/* Retention */}
            <Text style={[styles.sectionHeading, { color: tokens.text }]}>
              How long we retain it
            </Text>
            <View style={[styles.retentionBox, { backgroundColor: tokens.backgroundElevated, borderColor: tokens.border }]}>
              <View style={styles.retentionRow}>
                <Text style={[styles.retentionLabel, { color: tokens.textSecondary }]}>Swing videos</Text>
                <Text style={[styles.retentionValue, { color: tokens.text }]}>90 days</Text>
              </View>
              <View style={styles.retentionRow}>
                <Text style={[styles.retentionLabel, { color: tokens.textSecondary }]}>Pose keypoints & coaching data</Text>
                <Text style={[styles.retentionValue, { color: tokens.text }]}>2 years</Text>
              </View>
            </View>
            <Text style={[styles.bodyText, { color: tokens.textMuted, fontSize: 12 }]}>
              Auto-deleted after each period. You can also delete at any time via Settings → Privacy.
            </Text>

            {/* Your rights */}
            <Text style={[styles.sectionHeading, { color: tokens.text }]}>
              Your rights
            </Text>
            {[
              'Delete your biometric data at any time (Settings → Privacy)',
              'Request a data export (contact privacy@spotter.golf)',
              'Withdraw consent at any time — AI features will be disabled',
              'Aggregated anonymized data cannot be deleted (de-identified)',
            ].map((right, i) => (
              <View key={i} style={styles.rightRow}>
                <Text style={[styles.rightBullet, { color: tokens.success }]}>✓</Text>
                <Text style={[styles.rightText, { color: tokens.textSecondary }]}>{right}</Text>
              </View>
            ))}

            {/* Consent checkbox */}
            <View style={[styles.consentRow, { borderColor: tokens.primary }]}>
              <TouchableOpacity
                style={styles.checkboxArea}
                onPress={() => setConsentChecked((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consentChecked }}
                accessibilityLabel="I consent to biometric data processing for AI coaching"
              >
                <View
                  style={[
                    styles.checkbox,
                    { borderColor: consentChecked ? tokens.primary : tokens.borderStrong },
                    consentChecked && { backgroundColor: tokens.primary },
                  ]}
                >
                  {consentChecked && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={[styles.consentLabel, { color: tokens.text }]}>
                  I consent to Spotter collecting and processing my biometric data
                  (pose keypoints) for AI golf coaching. I understand I can withdraw
                  this consent at any time.
                </Text>
              </TouchableOpacity>
            </View>

            {/* Legal reference links */}
            <View style={styles.linkRow}>
              <TouchableOpacity
                onPress={() => Linking.openURL('https://spotter.golf/legal/eagle-ai-privacy')}
              >
                <Text style={[styles.linkText, { color: tokens.primary }]}>
                  Eagle AI Privacy Policy
                </Text>
              </TouchableOpacity>
              <Text style={{ color: tokens.textMuted }}> · </Text>
              <TouchableOpacity
                onPress={() => Linking.openURL('https://spotter.golf/legal/eagle-ai-terms')}
              >
                <Text style={[styles.linkText, { color: tokens.primary }]}>
                  Eagle AI Terms
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <Button
              title={loading ? 'Saving...' : 'I Consent — Enable AI Coaching'}
              onPress={handleAccept}
              disabled={loading}
            />
            <TouchableOpacity
              style={styles.declineButton}
              onPress={handleDecline}
              disabled={loading}
              accessibilityLabel="I do not consent to biometric data processing"
            >
              <Text style={[styles.declineText, { color: tokens.textMuted }]}>
                I do not consent — continue without AI analysis
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  bgImage: { resizeMode: 'cover' },
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
    maxHeight: '92%',
  },
  progress: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 8,
  },
  noticeBanner: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  noticeBannerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  panel: {
    marginTop: 4,
    marginBottom: 6,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 19,
  },
  bold: { fontWeight: '700' },
  legalBox: {
    marginTop: 10,
    padding: 12,
    borderWidth: 1,
    borderRadius: 10,
  },
  legalBoxTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  retentionBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    marginBottom: 4,
  },
  retentionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  retentionLabel: { fontSize: 13 },
  retentionValue: { fontSize: 13, fontWeight: '700' },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  rightBullet: { marginRight: 8, fontSize: 13, fontWeight: '700', marginTop: 1 },
  rightText: { flex: 1, fontSize: 13, lineHeight: 18 },
  consentRow: {
    marginTop: 14,
    padding: 12,
    borderWidth: 1,
    borderRadius: 10,
  },
  checkboxArea: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
    flexShrink: 0,
  },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '900' },
  consentLabel: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  actions: {
    marginTop: 8,
  },
  declineButton: {
    marginTop: 8,
    alignItems: 'center',
    padding: 6,
  },
  declineText: {
    fontSize: 13,
  },
});
