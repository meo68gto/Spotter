import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface RegistrationConfirmationEmailProps {
  to: string;
  registrantName: string;
  tournamentName: string;
  eventDate: string;
  courseName: string;
  entryFeeCents?: number;
  walletAddedCents?: number;
  confirmationCode: string;
  checkInUrl?: string;
}

function formatCents(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export function RegistrationConfirmationEmail({
  registrantName,
  tournamentName,
  eventDate,
  courseName,
  entryFeeCents,
  walletAddedCents,
  confirmationCode,
  checkInUrl,
}: RegistrationConfirmationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>You're registered for {tournamentName}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.header}>
            <Heading style={styles.logoText}>SPOTTER</Heading>
            <Text style={styles.headerSub}>Golf. Connected.</Text>
          </Section>

          {/* Main content */}
          <Section style={styles.main}>
            <Heading style={styles.heading}>Registration Confirmed! 🎉</Heading>
            <Text style={styles.greeting}>Hi {registrantName},</Text>
            <Text style={styles.text}>
              Your spot at <strong>{tournamentName}</strong> is confirmed. See you on the course!
            </Text>

            {/* Confirmation code */}
            <Section style={styles.codeBox}>
              <Text style={styles.codeLabel}>Confirmation Code</Text>
              <Text style={styles.codeValue}>{confirmationCode}</Text>
            </Section>

            {/* Event details */}
            <Section style={styles.detailsBox}>
              <Text style={styles.detailRow}>
                <strong>📅 Date:</strong> {eventDate}
              </Text>
              <Text style={styles.detailRow}>
                <strong>🏌️ Course:</strong> {courseName}
              </Text>
              <Text style={styles.detailRow}>
                <strong>🏆 Event:</strong> {tournamentName}
              </Text>
              {entryFeeCents !== undefined && entryFeeCents > 0 && (
                <Text style={styles.detailRow}>
                  <strong>💳 Entry Fee:</strong> {formatCents(entryFeeCents)}
                </Text>
              )}
            </Section>

            {/* Wallet credit if applicable */}
            {walletAddedCents && walletAddedCents > 0 && (
              <Section style={styles.walletBox}>
                <Text style={styles.walletTitle}>💰 Spotter Credits Added!</Text>
                <Text style={styles.walletText}>
                  <strong>{formatCents(walletAddedCents)}</strong> has been added to your Spotter wallet.
                  Use it toward future tournaments or pro shop purchases.
                </Text>
              </Section>
            )}

            {/* CTA */}
            {checkInUrl && (
              <Section style={styles.ctaSection}>
                <Button href={checkInUrl} style={styles.checkInButton}>
                  View My Registration
                </Button>
              </Section>
            )}

            <Text style={styles.smallText}>
              Need to cancel? Contact the tournament organizer at least 48 hours before the event for a refund.
            </Text>
          </Section>

          <Hr style={styles.hr} />
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              You're receiving this because you registered for a Spotter tournament.
            </Text>
            <Text style={styles.footerText}>
              <Link href="https://spotter.golf" style={styles.link}>
                spotter.golf
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: { backgroundColor: '#f5f5f5', fontFamily: 'sans-serif' },
  container: { backgroundColor: '#ffffff', borderRadius: '8px', margin: '40px auto', padding: '0', maxWidth: '600px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  header: { backgroundColor: '#1a1a2e', borderRadius: '8px 8px 0 0', padding: '32px', textAlign: 'center' as const },
  logoText: { color: '#e2c044', fontSize: '28px', fontWeight: '800', margin: '0', letterSpacing: '4px' },
  headerSub: { color: '#888', fontSize: '14px', margin: '4px 0 0' },
  main: { padding: '40px 48px' },
  heading: { fontSize: '26px', fontWeight: '700', color: '#1a1a2e', marginBottom: '20px' },
  greeting: { fontSize: '16px', color: '#444', marginBottom: '16px' },
  text: { fontSize: '16px', color: '#333', lineHeight: '1.6', marginBottom: '20px' },
  codeBox: { backgroundColor: '#1a1a2e', borderRadius: '8px', padding: '20px', textAlign: 'center' as const, marginBottom: '24px' },
  codeLabel: { color: '#888', fontSize: '12px', textTransform: 'uppercase' as const, letterSpacing: '1px', marginBottom: '8px' },
  codeValue: { color: '#e2c044', fontSize: '28px', fontWeight: '800', letterSpacing: '4px', margin: '0' },
  detailsBox: { backgroundColor: '#f5f5f5', borderRadius: '8px', padding: '24px', marginBottom: '24px' },
  detailRow: { fontSize: '15px', color: '#333', marginBottom: '10px' },
  walletBox: { backgroundColor: '#e8f5e9', borderLeft: '4px solid #4caf50', padding: '20px', borderRadius: '4px', marginBottom: '24px' },
  walletTitle: { fontSize: '16px', fontWeight: '700', color: '#2e7d32', marginBottom: '8px' },
  walletText: { fontSize: '15px', color: '#333', margin: '0', lineHeight: '1.5' },
  ctaSection: { textAlign: 'center' as const, marginBottom: '24px' },
  checkInButton: { backgroundColor: '#e2c044', color: '#1a1a2e', padding: '14px 32px', borderRadius: '6px', fontSize: '16px', fontWeight: '700', textDecoration: 'none' },
  smallText: { fontSize: '13px', color: '#888', textAlign: 'center' as const },
  hr: { borderColor: '#eee', margin: '32px 0' },
  footer: { padding: '0 48px 32px', textAlign: 'center' as const },
  footerText: { fontSize: '13px', color: '#aaa', marginBottom: '6px' },
  link: { color: '#e2c044', textDecoration: 'none' },
};
