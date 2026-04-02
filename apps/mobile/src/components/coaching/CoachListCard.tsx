import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card } from '../Card';

export type CoachListCardProps = {
  name: string;
  headline: string;
  city: string;
  specialties?: string[];
  ratingAvg?: number | null;
  ratingCount?: number;
  minPrice?: number;
  maxPrice?: number;
  avgResponseMinutes?: number | null;
  hasVideoReview?: boolean;
  serviceCount?: number;
  onPress: () => void;
};

function formatPrice(cents: number): string {
  return `$${Math.round(cents / 100)}`;
}

function formatResponseTime(minutes: number | null): string {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes}m response`;
  const hours = Math.round(minutes / 60);
  return `${hours}h response`;
}

export function CoachListCard({
  name,
  headline,
  city,
  specialties = [],
  ratingAvg,
  ratingCount = 0,
  minPrice = 0,
  maxPrice = 0,
  avgResponseMinutes,
  hasVideoReview = false,
  serviceCount = 0,
  onPress
}: CoachListCardProps) {
  const hasPricing = minPrice > 0 || maxPrice > 0;
  const priceDisplay = hasPricing
    ? minPrice === maxPrice
      ? formatPrice(minPrice)
      : `${formatPrice(minPrice)}-${formatPrice(maxPrice)}`
    : null;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Card>
        <View style={styles.header}>
          <View style={styles.nameSection}>
            <Text style={styles.name}>{name}</Text>
            {ratingAvg !== null && ratingAvg !== undefined && (
              <View style={styles.ratingBadge}>
                <Text style={styles.ratingText}>★ {ratingAvg.toFixed(1)}</Text>
                {ratingCount > 0 && (
                  <Text style={styles.ratingCount}>({ratingCount})</Text>
                )}
              </View>
            )}
          </View>
          {priceDisplay && (
            <Text style={styles.price}>{priceDisplay}</Text>
          )}
        </View>

        <Text style={styles.headline}>{headline}</Text>

        {specialties.length > 0 && (
          <View style={styles.specialtiesRow}>
            {specialties.slice(0, 3).map((specialty, idx) => (
              <View key={idx} style={styles.specialtyPill}>
                <Text style={styles.specialtyText}>{specialty}</Text>
              </View>
            ))}
            {specialties.length > 3 && (
              <Text style={styles.moreSpecialties}>+{specialties.length - 3}</Text>
            )}
          </View>
        )}

        <View style={styles.badgesRow}>
          {hasVideoReview ? (
            <View style={styles.videoReviewBadge}>
              <Text style={styles.videoReviewText}>Video Review</Text>
            </View>
          ) : null}
          {serviceCount > 0 ? <Text style={styles.serviceCount}>{serviceCount} services</Text> : null}
        </View>

        <View style={styles.footer}>
          <Text style={styles.city}>{city}</Text>
          {avgResponseMinutes && (
            <Text style={styles.responseTime}>
              {formatResponseTime(avgResponseMinutes)}
            </Text>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4
  },
  nameSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: '#102a43'
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0f4f8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0b3a53'
  },
  ratingCount: {
    fontSize: 11,
    color: '#627d98'
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0b3a53'
  },
  headline: {
    color: '#334e68',
    marginTop: 4,
    lineHeight: 20
  },
  specialtiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8
  },
  specialtyPill: {
    backgroundColor: '#eaf2f8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12
  },
  specialtyText: {
    fontSize: 11,
    color: '#0b3a53',
    fontWeight: '500'
  },
  moreSpecialties: {
    fontSize: 11,
    color: '#627d98',
    alignSelf: 'center'
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e1e8ed'
  },
  city: {
    color: '#627d98',
    fontSize: 13
  },
  responseTime: {
    color: '#486581',
    fontSize: 12,
    fontWeight: '500'
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8
  },
  videoReviewBadge: {
    backgroundColor: '#fee3b5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999
  },
  videoReviewText: {
    color: '#8d2b0b',
    fontWeight: '700',
    fontSize: 11
  },
  serviceCount: {
    color: '#627d98',
    fontSize: 12
  }
});
