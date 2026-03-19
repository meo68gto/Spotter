import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { Button } from './Button';
import { Card } from './Card';
import { palette, radius, spacing } from '../theme/design';

interface ConnectionCardProps {
  id: string;
  name: string;
  avatarUrl?: string;
  company?: string;
  role?: string;
  mutualConnections: number;
  onAccept: () => void;
  onDecline: () => void;
  loading?: boolean;
}

export function ConnectionCard({
  id,
  name,
  avatarUrl,
  company,
  role,
  mutualConnections,
  onAccept,
  onDecline,
  loading = false,
}: ConnectionCardProps) {
  return (
    <Card>
      <View style={styles.container}>
        <View style={styles.avatarSection}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.name}>{name}</Text>
          {(role || company) && (
            <Text style={styles.role}>
              {role}{role && company ? ' at ' : ''}{company}
            </Text>
          )}
          <Text style={styles.mutualConnections}>
            {mutualConnections} mutual connection{mutualConnections !== 1 ? 's' : ''}
          </Text>
        </View>

        <View style={styles.actions}>
          <Button
            title={loading ? '...' : 'Accept'}
            onPress={onAccept}
            disabled={loading}
            accessibilityLabel={`Accept connection from ${name}`}
          />
          <Button
            title="Decline"
            onPress={onDecline}
            disabled={loading}
            tone="secondary"
            accessibilityLabel={`Decline connection from ${name}`}
          />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarSection: {
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: palette.navy600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: palette.white,
    fontSize: 24,
    fontWeight: '700',
  },
  infoSection: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.ink900,
  },
  role: {
    fontSize: 14,
    color: palette.ink700,
    marginTop: 2,
  },
  mutualConnections: {
    fontSize: 12,
    color: palette.ink500,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
