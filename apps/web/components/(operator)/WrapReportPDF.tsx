'use client';

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';

// Register a clean font (Helvetica is built-in to react-pdf)
Font.register({ family: 'Helvetica', fonts: [] });

// ---------------------------------------------------------------------------
// Data types for the wrap report
// ---------------------------------------------------------------------------

export interface WrapReportData {
  tournamentName: string;
  eventDate: string;
  courseName: string;
  organizerName: string;
  operatorEmail: string;

  // Registration stats
  totalRegistrations: number;
  paidRegistrations: number;
  waitlistedCount: number;
  checkedInCount: number;
  noShowCount: number;
  cancelledCount: number;
  checkInRate: number;

  // Financial summary (all in cents)
  registrationRevenueCents: number;
  sponsorRevenueCents: number;
  totalRevenueCents: number;
  platformFeeCents: number;
  netRevenueCents: number;

  // Sponsor fulfillment
  sponsors: SponsorFulfillmentRow[];

  // Contest results
  contests: ContestResultRow[];

  // Photos (URLs — will be listed as a grid reference in the PDF)
  photoUrls?: string[];
}

// ---------------------------------------------------------------------------
// Sub-types
// ---------------------------------------------------------------------------

export interface SponsorFulfillmentRow {
  sponsorName: string;
  tier: string;
  contractValueCents: number;
  deliverables: DeliverableRow[];
}

export interface DeliverableRow {
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'missed';
  deliveryDate?: string;
}

export interface ContestResultRow {
  contestName: string;
  contestType: string;
  winnerName?: string;
  prizeDescription?: string;
  prizeValueCents?: number;
  status: 'open' | 'closed' | 'cancelled';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  in_progress: '#3b82f6',
  completed: '#22c55e',
  missed: '#ef4444',
  open: '#3b82f6',
  closed: '#22c55e',
  cancelled: '#9ca3af',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  missed: 'Missed',
  open: 'Open',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1a1a2e',
  },
  // Header
  header: {
    backgroundColor: '#1a1a2e',
    padding: 24,
    marginBottom: 0,
  },
  headerTitle: {
    color: '#e2c044',
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 3,
  },
  headerSub: {
    color: '#aaa',
    fontSize: 9,
    marginTop: 4,
  },
  // Section headings
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#1a1a2e',
    borderBottom: '2px solid #e2c044',
    paddingBottom: 4,
    marginBottom: 12,
    marginTop: 28,
  },
  // Stats grid
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    padding: 12,
  },
  statValue: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#1a1a2e',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 8,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Tables
  table: {
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    padding: '8 10',
    borderRadius: 4,
    marginBottom: 4,
  },
  tableHeaderText: {
    color: '#e2c044',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    padding: '8 10',
    borderBottom: '1px solid #eee',
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: '#fafafa',
  },
  tableCell: {
    fontSize: 9,
    color: '#333',
  },
  tableCellBold: {
    fontSize: 9,
    color: '#1a1a2e',
    fontFamily: 'Helvetica-Bold',
  },
  // Financial box
  financialBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    padding: 16,
    marginBottom: 16,
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  financialLabel: {
    fontSize: 10,
    color: '#555',
  },
  financialValue: {
    fontSize: 10,
    color: '#222',
  },
  financialNegative: {
    fontSize: 10,
    color: '#c62828',
  },
  financialDivider: {
    borderBottom: '1px solid #ddd',
    marginVertical: 8,
  },
  financialTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  financialTotalLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#1a1a2e',
  },
  financialTotalValue: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#22c55e',
  },
  // Status badge
  statusBadge: {
    borderRadius: 3,
    padding: '2 6',
  },
  statusText: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#fff',
    textTransform: 'uppercase',
  },
  // Photos grid
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  photoPlaceholder: {
    width: 130,
    height: 90,
    backgroundColor: '#e5e5e5',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    fontSize: 8,
    color: '#aaa',
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: '1px solid #eee',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 8,
    color: '#aaa',
  },
  // Misc
  emptyState: {
    fontSize: 10,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  colName: { width: '25%' },
  colTier: { width: '10%' },
  colValue: { width: '15%' },
  colDesc: { width: '30%' },
  colStatus: { width: '12%' },
  colDate: { width: '13%' },
  // Registration col widths
  colRegName: { width: '30%' },
  colEmail: { width: '30%' },
  colStatusReg: { width: '20%' },
  colPaid: { width: '20%' },
  // Contest col widths
  colContestName: { width: '25%' },
  colContestType: { width: '20%' },
  colWinner: { width: '25%' },
  colPrize: { width: '20%' },
  colContestStatus: { width: '10%' },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WrapReportPDF({ data }: { data: WrapReportData }) {
  const {
    tournamentName,
    eventDate,
    courseName,
    organizerName,
    operatorEmail,
    totalRegistrations,
    paidRegistrations,
    waitlistedCount,
    checkedInCount,
    noShowCount,
    cancelledCount,
    checkInRate,
    registrationRevenueCents,
    sponsorRevenueCents,
    totalRevenueCents,
    platformFeeCents,
    netRevenueCents,
    sponsors,
    contests,
    photoUrls,
  } = data;

  return (
    <Document>
      {/* PAGE 1: Cover + Stats + Financials */}
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>SPOTTER</Text>
          <Text style={s.headerSub}>EVENT WRAP REPORT · CONFIDENTIAL</Text>
        </View>

        {/* Event title */}
        <View style={{ marginTop: 24, marginBottom: 4 }}>
          <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#1a1a2e' }}>
            {tournamentName}
          </Text>
          <Text style={{ fontSize: 11, color: '#555', marginTop: 4 }}>
            {fmtDate(eventDate)} · {courseName}
          </Text>
          <Text style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
            {organizerName} · {operatorEmail}
          </Text>
        </View>

        {/* Registration Stats */}
        <Text style={s.sectionTitle}>📋 Registration Summary</Text>
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <Text style={s.statValue}>{totalRegistrations}</Text>
            <Text style={s.statLabel}>Total Registered</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statValue}>{paidRegistrations}</Text>
            <Text style={s.statLabel}>Paid</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statValue}>{waitlistedCount}</Text>
            <Text style={s.statLabel}>Waitlisted</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statValue}>{checkedInCount}</Text>
            <Text style={s.statLabel}>Checked In</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statValue}>{checkInRate}%</Text>
            <Text style={s.statLabel}>Attendance</Text>
          </View>
        </View>
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <Text style={s.statValue}>{noShowCount}</Text>
            <Text style={s.statLabel}>No-Shows</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statValue}>{cancelledCount}</Text>
            <Text style={s.statLabel}>Cancelled</Text>
          </View>
        </View>

        {/* Financial Summary */}
        <Text style={s.sectionTitle}>💰 Financial Summary</Text>
        <View style={s.financialBox}>
          <View style={s.financialRow}>
            <Text style={s.financialLabel}>Registration Revenue</Text>
            <Text style={s.financialValue}>{fmt(registrationRevenueCents)}</Text>
          </View>
          <View style={s.financialRow}>
            <Text style={s.financialLabel}>Sponsor Revenue</Text>
            <Text style={s.financialValue}>{fmt(sponsorRevenueCents)}</Text>
          </View>
          <View style={s.financialRow}>
            <Text style={s.financialLabel}>Total Revenue</Text>
            <Text style={s.financialValue}>{fmt(totalRevenueCents)}</Text>
          </View>
          <View style={s.financialDivider} />
          <View style={s.financialRow}>
            <Text style={s.financialLabel}>Platform Fee (Spotter)</Text>
            <Text style={s.financialNegative}>−{fmt(platformFeeCents)}</Text>
          </View>
          <View style={s.financialDivider} />
          <View style={s.financialTotalRow}>
            <Text style={s.financialTotalLabel}>Net Revenue</Text>
            <Text style={s.financialTotalValue}>{fmt(netRevenueCents)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>Generated by Spotter · spotter.golf</Text>
          <Text style={s.footerText}>
            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>
      </Page>

      {/* PAGE 2: Sponsor Fulfillment */}
      <Page size="A4" style={s.page}>
        <Text style={s.sectionTitle}>🏆 Sponsor Fulfillment</Text>
        {sponsors.length === 0 ? (
          <Text style={s.emptyState}>No sponsor fulfillment data available.</Text>
        ) : (
          sponsors.map((sponsor, si) => (
            <View key={si} style={{ marginBottom: 20 }}>
              {/* Sponsor header */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 8,
                  gap: 10,
                }}
              >
                <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#1a1a2e' }}>
                  {sponsor.sponsorName}
                </Text>
                <Text style={{ fontSize: 8, color: '#888', textTransform: 'uppercase' }}>
                  {sponsor.tier}
                </Text>
                <Text style={{ fontSize: 9, color: '#555' }}>
                  {fmt(sponsor.contractValueCents)}
                </Text>
              </View>

              {/* Deliverables table */}
              <View style={s.table}>
                <View style={s.tableHeader}>
                  <Text style={[s.tableHeaderText, s.colDesc]}>Deliverable</Text>
                  <Text style={[s.tableHeaderText, s.colStatus]}>Status</Text>
                  <Text style={[s.tableHeaderText, s.colDate]}>Delivery</Text>
                </View>
                {sponsor.deliverables.map((d, di) => {
                  const color = STATUS_COLORS[d.status] ?? '#9ca3af';
                  const label = STATUS_LABELS[d.status] ?? d.status;
                  return (
                    <View
                      key={di}
                      style={[s.tableRow, di % 2 === 1 ? s.tableRowAlt : {}]}
                    >
                      <Text style={[s.tableCell, s.colDesc]}>{d.description}</Text>
                      <View style={[s.colStatus, { flexDirection: 'row', alignItems: 'center' }]}>
                        <View
                          style={[
                            s.statusBadge,
                            { backgroundColor: color },
                          ]}
                        >
                          <Text style={s.statusText}>{label}</Text>
                        </View>
                      </View>
                      <Text style={[s.tableCell, s.colDate]}>
                        {d.deliveryDate ? fmtDate(d.deliveryDate) : '—'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        )}

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>Generated by Spotter · spotter.golf</Text>
          <Text style={s.footerText}>
            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>
      </Page>

      {/* PAGE 3: Contest Results */}
      <Page size="A4" style={s.page}>
        <Text style={s.sectionTitle}>🏌️ Contest Results</Text>
        {contests.length === 0 ? (
          <Text style={s.emptyState}>No contest results recorded.</Text>
        ) : (
          <View style={s.table}>
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderText, s.colContestName]}>Contest</Text>
              <Text style={[s.tableHeaderText, s.colContestType]}>Type</Text>
              <Text style={[s.tableHeaderText, s.colWinner]}>Winner</Text>
              <Text style={[s.tableHeaderText, s.colPrize]}>Prize</Text>
              <Text style={[s.tableHeaderText, s.colContestStatus]}>Status</Text>
            </View>
            {contests.map((contest, ci) => {
              const color = STATUS_COLORS[contest.status] ?? '#9ca3af';
              const label = STATUS_LABELS[contest.status] ?? contest.status;
              return (
                <View
                  key={ci}
                  style={[s.tableRow, ci % 2 === 1 ? s.tableRowAlt : {}]}
                >
                  <Text style={[s.tableCellBold, s.colContestName]}>{contest.contestName}</Text>
                  <Text style={[s.tableCell, s.colContestType]}>
                    {contest.contestType.replace(/_/g, ' ')}
                  </Text>
                  <Text style={[s.tableCell, s.colWinner]}>
                    {contest.winnerName ?? '—'}
                  </Text>
                  <Text style={[s.tableCell, s.colPrize]}>
                    {contest.prizeValueCents
                      ? `${contest.prizeDescription ?? 'Prize'} · ${fmt(contest.prizeValueCents)}`
                      : contest.prizeDescription ?? '—'}
                  </Text>
                  <View style={[s.colContestStatus, { flexDirection: 'row', alignItems: 'center' }]}>
                    <View style={[s.statusBadge, { backgroundColor: color }]}>
                      <Text style={s.statusText}>{label}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Photos Grid */}
        {photoUrls && photoUrls.length > 0 && (
          <>
            <Text style={[s.sectionTitle, { marginTop: 32 }]}>📸 Event Photos</Text>
            <View style={s.photoGrid}>
              {photoUrls.slice(0, 12).map((url, pi) => (
                <View key={pi} style={s.photoPlaceholder}>
                  <Text style={s.photoPlaceholderText}>
                    Photo {pi + 1}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>Generated by Spotter · spotter.golf</Text>
          <Text style={s.footerText}>
            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
