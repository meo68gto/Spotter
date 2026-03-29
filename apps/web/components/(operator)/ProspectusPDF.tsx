import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TournamentInfo {
  name: string
  date: string
  location: string
  description: string
}

export interface OperatorInfo {
  name: string
  logo?: string
}

export interface SponsorTier {
  name: string
  price: number
  deliverables: string[]
}

export interface ProspectusStats {
  expectedPlayers: number
  reach: number
}

interface ProspectusPDFProps {
  tournament: TournamentInfo
  operator: OperatorInfo
  tiers: SponsorTier[]
  stats: ProspectusStats
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: { padding: 40 },
  title: { fontSize: 24, marginBottom: 20 },
  section: { marginBottom: 15 },
  subtitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 8 },
  text: { fontSize: 10 }
})

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProspectusPDF({ tournament, operator, tiers, stats }: ProspectusPDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{tournament.name} — Sponsorship Prospectus</Text>
        <View style={styles.section}>
          <Text style={styles.subtitle}>About the Event</Text>
          <Text style={styles.text}>{tournament.date} · {tournament.location}</Text>
          <Text style={styles.text}>{tournament.description}</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.subtitle}>Expected Reach</Text>
          <Text style={styles.text}>{stats.expectedPlayers} players + spectators</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.subtitle}>Sponsorship Tiers</Text>
          {tiers.map((tier) => (
            <View key={tier.name} style={{ marginBottom: 10 }}>
              <Text style={{ fontSize: 12, fontWeight: 'bold' }}>{tier.name} — ${tier.price}</Text>
              <Text style={styles.text}>{tier.deliverables.join(', ')}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  )
}
