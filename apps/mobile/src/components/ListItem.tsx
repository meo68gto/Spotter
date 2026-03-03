import React, { type ReactNode } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../theme/tokens/colors';
import { spaceXs, spaceSm, spaceMd } from '../theme/tokens/spacing';
import { elevation } from '../theme/tokens/elevation';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ListItemVariant = 'default' | 'inset' | 'card';

export interface ListItemProps {
  title:         string;
  subtitle?:     string;
  caption?:      string;
  /** Ionicons icon name or custom node */
  leadingIcon?:  keyof typeof Ionicons.glyphMap;
  leadingNode?:  ReactNode;
  trailingIcon?: keyof typeof Ionicons.glyphMap;
  trailingNode?: ReactNode;
  trailingText?: string;
  onPress?:      () => void;
  variant?:      ListItemVariant;
  /** Show a bottom divider (default true for 'default' variant) */
  showDivider?:  boolean;
  disabled?:     boolean;
  style?:        ViewStyle;
}

// ─── ListItem Component ─────────────────────────────────────────────────────

export const ListItem: React.FC<ListItemProps> = ({
  title,
  subtitle,
  caption,
  leadingIcon,
  leadingNode,
  trailingIcon = 'chevron-forward',
  trailingNode,
  trailingText,
  onPress,
  variant      = 'default',
  showDivider  = variant === 'default',
  disabled     = false,
  style,
}) => {
  const isCard = variant === 'card';
  const isInset = variant === 'inset';

  const containerStyle = [
    styles.container,
    isCard && styles.card,
    isCard && (elevation.sm as ViewStyle),
    disabled && styles.disabled,
    style,
  ];

  const inner = (
    <View style={styles.inner}>
      {/* Leading */}
      {(leadingNode ?? leadingIcon) && (
        <View style={[styles.leading, isCard && styles.leadingCard]}>
          {leadingNode ?? (
            <View style={styles.iconBg}>
              <Ionicons name={leadingIcon!} size={20} color={palette.navy600} />
            </View>
          )}
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle && <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>}
        {caption  && <Text style={styles.caption}  numberOfLines={1}>{caption}</Text>}
      </View>

      {/* Trailing */}
      <View style={styles.trailing}>
        {trailingNode ? trailingNode : (
          <>
            {trailingText && <Text style={styles.trailingText}>{trailingText}</Text>}
            {onPress && !trailingNode && (
              <Ionicons name={trailingIcon} size={16} color={palette.ink300} />
            )}
          </>
        )}
      </View>
    </View>
  );

  return (
    <View>
      {onPress ? (
        <Pressable
          onPress={disabled ? undefined : onPress}
          style={({ pressed }) => [
            ...containerStyle,
            pressed && styles.pressed,
          ]}
        >
          {inner}
        </Pressable>
      ) : (
        <View style={containerStyle}>{inner}</View>
      )}
      {showDivider && !isCard && (
        <View
          style={[
            styles.divider,
            isInset && { marginLeft: 72 },
          ]}
        />
      )}
    </View>
  );
};

export default ListItem;

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.white,
    paddingHorizontal: spaceMd,
    paddingVertical: spaceMd,
  },
  card: {
    borderRadius: 12,
    marginHorizontal: spaceMd,
    marginVertical: spaceXs,
    paddingHorizontal: spaceMd,
    paddingVertical: spaceMd,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceMd,
  },
  leading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  leadingCard: {
    width: 40,
  },
  iconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: palette.navy50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.ink900,
  },
  subtitle: {
    fontSize: 13,
    color: palette.ink500,
    lineHeight: 18,
  },
  caption: {
    fontSize: 11,
    color: palette.ink400,
    marginTop: 1,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spaceXs,
  },
  trailingText: {
    fontSize: 14,
    color: palette.ink500,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.ink200,
    marginLeft: spaceMd,
  },
  pressed: {
    backgroundColor: palette.gray50,
  },
  disabled: {
    opacity: 0.45,
  },
});
