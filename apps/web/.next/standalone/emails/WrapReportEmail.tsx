import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface WrapReportEmailProps {
  to: string;
  operatorName: string;
  tournamentName: string;
  eventDate: string;
  totalRegistrations: number;
  paidRegistrations: number;
  totalRevenueCents: number;
  sponsorRevenueCents: number;
  netRevenueCents: number;
  platformFeeCents: number;
  checkInCount: number;
  noShowCount: number;
  pdfUrl?: string;
  photosUrl?: string;
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export function WrapReportEmail({
  operatorName,
  tournamentName,
  eventDate,
  totalRegistrations,
  paidRegistrations,
  totalRevenueCents,
  sponsorRevenueCents,
  netRevenueCents,
  platformFeeCents,
  checkInCount,
  noShowCount,
  pdfUrl,
  photosUrl,
}: WrapReportEmailProps) {
  const checkInRate = totalRegistrations > 0
    ? Math.round((checkInCount / totalRegistrations) * 100)
    : 0;

  return (
    <Html>
      <Head />
      <Preview>Event Wrap Report: {tournamentName}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.header}>
            <Heading style={styles.logoText}>SPOTTER</Heading>
            <Text style={styles.headerSub}>Event Wrap Report</Text>
          </Section>

          {/* Main content */}
          <Section style={styles.main}>
            <Heading style={styles.heading}>📊 {tournamentName}</Heading>
            <Text style={styles.subheading}>{eventDate}</Text>
            <Text style={styles.greeting}>Hi {operatorName},</Text>
            <Text style={styles.text}>
              Your event has concluded. Here is the full financial and operational summary.
            </Text>

            {/* Stats grid */}
            <Section style={styles.statsGrid}>
              <div style={styles.statBox}>
                <Text style={styles.statValue}>{totalRegistrations}</Text>
                <Text style={styles.statLabel}>Total Registrations</Text>
              </div>
              <div style={styles.statBox}>
                <Text style={styles.statValue}>{paidRegistrations}</Text>
                <Text style={styles.statLabel}>Paid Registrations</Text>
              </div>
              <div style={styles.statBox}>
                <Text style={styles.statValue}>{checkInCount}</Text>
                <Text style={styles.statLabel}>Checked In</Text>
              </div>
              <div style={styles.statBox}>
                <Text style={styles.statValue}>{checkInRate}%</Text>
                <Text style={styles.statLabel}>Attendance Rate</Text>
              </div>
            </Section>

            {/* Financial summary */}
            <Section style={styles.financialBox}>
              <Text style={styles.financialTitle}>💰 Financial Summary</Text>
              <div style={styles.financialRow}>
                <Text style={styles.financialLabel}>Registration Revenue</Text>
                <Text style={styles.financialValue}>{formatCents(totalRevenueCents)}</Text>
              </div>
              <div style={styles.financialRow}>
                <Text style={styles.financialLabel}>Sponsor Revenue</Text>
                <Text style={styles.financialValue}>{formatCents(sponsorRevenueCents)}</Text>
              </div>
              <div style={styles.financialRow}>
                <Text style={styles.financialLabel}>Platform Fee (Spotter)</Text>
                <Text style={styles.financialNegative}>-{formatCents(platformFeeCents)}</Text>
              </div>
              <Hr style={styles.financialHr} />
              <div style={styles.financialRow}>
                <Text style={styles.financialTotalLabel}>Net Revenue</Text>
                <Text style={styles.financialTotalValue}>{formatCents(netRevenueCents)}</Text>
              </div>
            </Section>

            {/* Notes */}
            <Section style={styles.notesBox}>
              <Text style={styles.notesTitle}>📋 Attendance Notes</Text>
              <Text style={styles.notesText}>
                {noShowCount > 0
                  ? `${noShowCount} registrants did not check in. Consider following up.`
                  : 'All registered players checked in. Great turnout!'}
              </Text>
            </Section>

            {/* CTAs */}
            {pdfUrl && (
              <Section style={styles.ctaSection}>
                <Button href={pdfUrl} style={styles.pdfButton}>
                  📄 Download Full Wrap Report (PDF)
                </Button>
              </Section>
            )}

            {photosUrl && (
              <Section style={styles.ctaSection}>
                <Button href={photosUrl} style={styles.photosButton}>
                  📸 View Event Photos
                </Button>
              </Section>
            )}

            <Text style={styles.smallText}>
              This report was auto-generated by Spotter based on your event data.
              Data is available in your operator dashboard.
            </Text>
          </Section>

          <Hr style={styles.hr} />
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Spotter · Operator Dashboard ·{' '}
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
  heading: { fontSize: '26px', fontWeight: '700', color: '#1a1a2e', marginBottom: '6px' },
  subheading: { fontSize: '15px', color: '#888', marginBottom: '20px' },
  greeting: { fontSize: '16px', color: '#444', marginBottom: '12px' },
  text: { fontSize: '15px', color: '#333', lineHeight: '1.6', marginBottom: '28px' },
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '28px' },
  statBox: { backgroundColor: '#f5f5f5', borderRadius: '8px', padding: '20px', textAlign: 'center' as const },
  statValue: { fontSize: '28px', fontWeight: '800', color: '#1a1a2e', marginBottom: '4px' },
  statLabel: { fontSize: '13px', color: '#888', textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
  financialBox: { backgroundColor: '#f5f5f5', borderRadius: '8px', padding: '24px', marginBottom: '24px' },
  financialTitle: { fontSize: '16px', fontWeight: '700', color: '#1a1a2e', marginBottom: '16px' },
  financialRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  financialLabel: { fontSize: '14px', color: '#555' },
  financialValue: { fontSize: '14px', color: '#222', fontWeight: '500' },
  financialNegative: { fontSize: '14px', color: '#c62828' },
  financialHr: { borderColor: '#ddd', margin: '14px 0' },
  financialTotalLabel: { fontSize: '16px', fontWeight: '700', color: '#1a1a2e' },
  financialTotalValue: { fontSize: '20px', fontWeight: '800', color: '#4caf50' },
  notesBox: { backgroundColor: '#fff8e1', borderLeft: '4px solid #e2c044', padding: '16px 20px', borderRadius: '4px', marginBottom: '28px' },
  notesTitle: { fontSize: '14px', fontWeight: '700', color: '#555', marginBottom: '8px' },
  notesText: { fontSize: '14px', color: '#333', margin: '0', lineHeight: '1.5' },
  ctaSection: { textAlign: 'center' as const, marginBottom: '16px' },
  pdfButton: { backgroundColor: '#1a1a2e', color: '#e2c044', padding: '14px 28px', borderRadius: '6px', fontSize: '15px', fontWeight: '700', textDecoration: 'none' },
  photosButton: { backgroundColor: 'transparent', color: '#1a1a2e', padding: '14px 28px', borderRadius: '6px', fontSize: '15px', textDecoration: 'none', border: '2px solid #1a1a2e' },
  smallText: { fontSize: '12px', color: '#aaa', textAlign: 'center' as const, lineHeight: '1.5' },
  hr: { borderColor: '#eee', margin: '32px 0' },
  footer: { padding: '0 48px 32px', textAlign: 'center' as const },
  footerText: { fontSize: '13px', color: '#aaa' },
  link: { color: '#e2c044', textDecoration: 'none' },
};
