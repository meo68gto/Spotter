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

interface TournamentInviteEmailProps {
  to: string;
  tournamentName: string;
  inviterName: string;
  eventDate: string;
  courseName: string;
  acceptUrl: string;
  declineUrl?: string;
  message?: string;
}

export function TournamentInviteEmail({
  tournamentName,
  inviterName,
  eventDate,
  courseName,
  acceptUrl,
  declineUrl,
  message,
}: TournamentInviteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>You've been invited to {tournamentName}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.header}>
            <Heading style={styles.logoText}>SPOTTER</Heading>
            <Text style={styles.headerSub}>Golf. Connected.</Text>
          </Section>

          {/* Main content */}
          <Section style={styles.main}>
            <Heading style={styles.heading}>You're Invited!</Heading>
            <Text style={styles.greeting}>Hi there,</Text>
            <Text style={styles.text}>
              <strong>{inviterName}</strong> has invited you to participate in{' '}
              <strong>{tournamentName}</strong>.
            </Text>

            {message && (
              <Section style={styles.messageBox}>
                <Text style={styles.messageText}>"{message}"</Text>
              </Section>
            )}

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
            </Section>

            {/* CTA */}
            <Section style={styles.ctaSection}>
              <Button href={acceptUrl} style={styles.acceptButton}>
                Accept Invitation
              </Button>
              {declineUrl && (
                <Button href={declineUrl} style={styles.declineButton}>
                  Decline
                </Button>
              )}
            </Section>

            <Text style={styles.smallText}>
              This invitation expires in 7 days. If you have questions, contact your tournament organizer.
            </Text>
          </Section>

          <Hr style={styles.hr} />
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              You're receiving this because you were invited to join a Spotter tournament.
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
  text: { fontSize: '16px', color: '#333', lineHeight: '1.6', marginBottom: '16px' },
  messageBox: { backgroundColor: '#f9f9f9', borderLeft: '4px solid #e2c044', padding: '16px 20px', borderRadius: '4px', marginBottom: '24px' },
  messageText: { fontStyle: 'italic', color: '#555', fontSize: '15px', margin: '0' },
  detailsBox: { backgroundColor: '#f5f5f5', borderRadius: '8px', padding: '24px', marginBottom: '32px' },
  detailRow: { fontSize: '15px', color: '#333', marginBottom: '10px' },
  ctaSection: { textAlign: 'center' as const, marginBottom: '24px' },
  acceptButton: { backgroundColor: '#e2c044', color: '#1a1a2e', padding: '14px 32px', borderRadius: '6px', fontSize: '16px', fontWeight: '700', textDecoration: 'none', marginRight: '12px' },
  declineButton: { backgroundColor: 'transparent', color: '#888', padding: '14px 24px', borderRadius: '6px', fontSize: '16px', textDecoration: 'none', border: '1px solid #ccc' },
  smallText: { fontSize: '13px', color: '#888', textAlign: 'center' as const },
  hr: { borderColor: '#eee', margin: '32px 0' },
  footer: { padding: '0 48px 32px', textAlign: 'center' as const },
  footerText: { fontSize: '13px', color: '#aaa', marginBottom: '6px' },
  link: { color: '#e2c044', textDecoration: 'none' },
};
