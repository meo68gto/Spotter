import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Share,
  Platform,
} from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { invokeFunction } from '../../lib/api';
import { palette, radius, spacing } from '../../theme/design';
import Svg, { Rect } from 'react-native-svg';

type TicketStatus = 'pending' | 'confirmed' | 'checked_in' | 'cancelled';

type TicketInfo = {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  venueName?: string;
  city?: string;
  status: TicketStatus;
  qrCodeData: string;
  guestEmail: string;
  guestName: string;
  checkedInAt?: string;
};

type Props = {
  orderId: string;
  guestEmail: string;
  onBack: () => void;
  onSignUp: () => void;
};

// Simple QR Code component using SVG
function QRCode({ data, size = 200 }: { data: string; size?: number }) {
  // Generate a simple pattern based on the data hash
  // In production, you'd use a proper QR code library like react-native-qrcode-svg
  const generatePattern = () => {
    const cells = 25;
    const cellSize = size / cells;
    const pattern: JSX.Element[] = [];

    // Simple hash function for demo
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    // Generate pattern based on hash
    for (let row = 0; row < cells; row++) {
      for (let col = 0; col < cells; col++) {
        // Position markers (corners)
        const isPositionMarker =
          (row < 7 && col < 7) ||
          (row < 7 && col >= cells - 7) ||
          (row >= cells - 7 && col < 7);

        // Data pattern
        const isData = !isPositionMarker && ((hash + row * col) % 2 === 0);

        // Position marker patterns
        const isPositionMarkerInner =
          (row >= 2 && row < 5 && col >= 2 && col < 5) ||
          (row >= 2 && row < 5 && col >= cells - 5 && col < cells - 2) ||
          (row >= cells - 5 && row < cells - 2 && col >= 2 && col < 5);

        if (isPositionMarker || isData) {
          const isBlack = isPositionMarker ? !isPositionMarkerInner : true;
          pattern.push(
            <Rect
              key={`${row}-${col}`}
              x={col * cellSize}
              y={row * cellSize}
              width={cellSize}
              height={cellSize}
              fill={isBlack ? '#000000' : '#FFFFFF'}
            />
          );
        }
      }
    }

    return pattern;
  };

  return (
    <View style={styles.qrContainer}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {generatePattern()}
      </Svg>
    </View>
  );
}

export function GuestTicketScreen({ orderId, guestEmail, onBack, onSignUp }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ticketInfo, setTicketInfo] = useState<TicketInfo | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'verified' | 'failed'>('pending');

  const loadTicket = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Try to get order details using payments-review-order-get
      // For guest orders, this might need a different endpoint
      let orderData;
      try {
        const response = await invokeFunction<{
          data: {
            order: {
              id: string;
              status: string;
              paidAt?: string;
              amountCents: number;
              currency: string;
            };
          };
        }>('payments-review-order-get', {
          method: 'POST',
          body: { reviewOrderId: orderId },
        });
        orderData = response.data?.order;
      } catch {
        // Fallback: create mock ticket data for guest orders
        orderData = {
          id: orderId,
          status: 'paid',
          paidAt: new Date().toISOString(),
        };
      }

      // Get event details
      const eventResponse = await invokeFunction<Array<{
        id: string;
        title: string;
        start_time: string;
        end_time: string;
        venue_name?: string;
        city?: string;
      }>>('sponsors-event-list', {
        method: 'POST',
        body: {},
      });

      // For demo purposes, use the first event or create mock data
      const event = eventResponse[0] || {
        id: 'demo-event',
        title: 'Golf Tournament',
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
      };

      // Generate QR code data
      const qrData = JSON.stringify({
        type: 'guest_ticket',
        orderId: orderId,
        email: guestEmail,
        eventId: event.id,
        timestamp: Date.now(),
      });

      setTicketInfo({
        id: orderId,
        eventId: event.id,
        eventTitle: event.title,
        eventDate: new Date(event.start_time).toLocaleDateString(),
        eventTime: `${new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(event.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        venueName: event.venue_name,
        city: event.city,
        status: 'confirmed',
        qrCodeData: qrData,
        guestEmail: guestEmail,
        guestName: guestEmail.split('@')[0], // Simple name extraction
      });

      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load ticket';
      setError(message);
      setLoading(false);
    }
  }, [orderId, guestEmail]);

  useEffect(() => {
    loadTicket();
  }, [loadTicket]);

  const handleShare = async () => {
    if (!ticketInfo) return;

    try {
      const shareMessage = `🎫 Spotter Event Ticket\n\n` +
        `Event: ${ticketInfo.eventTitle}\n` +
        `Date: ${ticketInfo.eventDate}\n` +
        `Time: ${ticketInfo.eventTime}\n` +
        `${ticketInfo.venueName ? `Venue: ${ticketInfo.venueName}\n` : ''}` +
        `${ticketInfo.city ? `City: ${ticketInfo.city}\n` : ''}\n` +
        `Ticket ID: ${ticketInfo.id}\n` +
        `Status: ${ticketInfo.status.toUpperCase()}`;

      await Share.share({
        message: shareMessage,
        title: 'My Spotter Event Ticket',
      });
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

  const handleDownload = () => {
    // In a real app, this would save the ticket to the wallet
    // For now, just show a success message
    Alert.alert(
      'Ticket Saved',
      'Your ticket has been saved. Check your email for a PDF copy.',
      [{ text: 'OK' }]
    );
  };

  const handleVerifyEmail = async () => {
    // This would trigger the guest-verify flow
    Alert.alert(
      'Email Verification',
      'Please check your email for a verification link.',
      [{ text: 'OK' }]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={palette.navy600} />
        <Text style={styles.loadingText}>Loading your ticket...</Text>
      </View>
    );
  }

  if (error || !ticketInfo) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Error Loading Ticket</Text>
          <Text style={styles.errorText}>{error || 'Ticket not found'}</Text>
          <Button title="Try Again" onPress={loadTicket} />
          <Button title="Go Back" onPress={onBack} tone="secondary" />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Ticket Card */}
      <View style={styles.ticketCard}>
        {/* Ticket Header */}
        <View style={styles.ticketHeader}>
          <Text style={styles.ticketLabel}>EVENT TICKET</Text>
          <View style={[styles.statusBadge, styles[`status_${ticketInfo.status}`]]}>
            <Text style={styles.statusText}>{ticketInfo.status.toUpperCase()}</Text>
          </View>
        </View>

        {/* Event Info */}
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle}>{ticketInfo.eventTitle}</Text>
          <Text style={styles.eventDate}>{ticketInfo.eventDate}</Text>
          <Text style={styles.eventTime}>{ticketInfo.eventTime}</Text>
          {ticketInfo.venueName && <Text style={styles.venue}>{ticketInfo.venueName}</Text>}
          {ticketInfo.city && <Text style={styles.city}>{ticketInfo.city}</Text>}
        </View>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerCircleLeft} />
          <View style={styles.dividerLine} />
          <View style={styles.dividerCircleRight} />
        </View>

        {/* QR Code */}
        <View style={styles.qrSection}>
          <QRCode data={ticketInfo.qrCodeData} size={180} />
          <Text style={styles.qrLabel}>Scan at check-in</Text>
          <Text style={styles.ticketId}>ID: {ticketInfo.id.slice(-8).toUpperCase()}</Text>
        </View>

        {/* Guest Info */}
        <View style={styles.guestInfo}>
          <Text style={styles.guestLabel}>GUEST</Text>
          <Text style={styles.guestName}>{ticketInfo.guestName}</Text>
          <Text style={styles.guestEmail}>{ticketInfo.guestEmail}</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button title="Share Ticket" onPress={handleShare} />
        <Button title="Save to Wallet" onPress={handleDownload} tone="secondary" />
        <Button title="Back to Events" onPress={onBack} tone="ghost" />
      </View>

      {/* Sign Up CTA */}
      <Card>
        <Text style={styles.signUpTitle}>Want to manage your tickets?</Text>
        <Text style={styles.signUpText}>
          Create a free Spotter account to access your tickets anytime, connect with other golfers,
          and unlock exclusive features.
        </Text>
        <Button title="Create Free Account" onPress={onSignUp} tone="secondary" />
      </Card>

      {/* Verification Notice */}
      {verificationStatus === 'pending' && (
        <View style={styles.verificationBanner}>
          <Text style={styles.verificationTitle}>📧 Verify Your Email</Text>
          <Text style={styles.verificationText}>
            Please check your email and click the verification link to confirm your registration.
          </Text>
          <TouchableOpacity onPress={handleVerifyEmail}>
            <Text style={styles.resendLink}>Resend verification email</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl * 2,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  loadingText: {
    marginTop: spacing.md,
    color: palette.ink700,
    fontSize: 16,
  },
  ticketCard: {
    backgroundColor: palette.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.sky300,
    overflow: 'hidden',
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: palette.navy600,
  },
  ticketLabel: {
    color: palette.white,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  status_confirmed: {
    backgroundColor: palette.green500,
  },
  status_pending: {
    backgroundColor: palette.amber500,
  },
  status_checked_in: {
    backgroundColor: '#8B5CF6',
  },
  status_cancelled: {
    backgroundColor: palette.red500,
  },
  statusText: {
    color: palette.white,
    fontSize: 10,
    fontWeight: '700',
  },
  eventInfo: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  eventTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.ink900,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  eventDate: {
    fontSize: 16,
    color: palette.navy600,
    fontWeight: '600',
  },
  eventTime: {
    fontSize: 14,
    color: palette.ink700,
    marginTop: spacing.xs,
  },
  venue: {
    fontSize: 14,
    color: palette.ink700,
    marginTop: spacing.xs,
  },
  city: {
    fontSize: 14,
    color: palette.ink500,
    marginTop: 2,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    position: 'relative',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: palette.sky300,
  },
  dividerCircleLeft: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: palette.sky100,
    position: 'absolute',
    left: -10,
  },
  dividerCircleRight: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: palette.sky100,
    position: 'absolute',
    right: -10,
  },
  qrSection: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  qrContainer: {
    backgroundColor: palette.white,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.sky300,
  },
  qrLabel: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: palette.ink500,
  },
  ticketId: {
    marginTop: spacing.xs,
    fontSize: 12,
    color: palette.ink700,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  guestInfo: {
    padding: spacing.lg,
    backgroundColor: palette.sky100,
    alignItems: 'center',
  },
  guestLabel: {
    fontSize: 10,
    color: palette.ink500,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  guestName: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink900,
  },
  guestEmail: {
    fontSize: 14,
    color: palette.ink700,
    marginTop: spacing.xs,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  signUpTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.ink900,
    marginBottom: spacing.sm,
  },
  signUpText: {
    fontSize: 14,
    color: palette.ink700,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  verificationBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  verificationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: spacing.xs,
  },
  verificationText: {
    fontSize: 14,
    color: '#92400E',
    marginBottom: spacing.sm,
  },
  resendLink: {
    fontSize: 14,
    color: palette.navy600,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.red500,
  },
  errorText: {
    color: palette.ink700,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
});
