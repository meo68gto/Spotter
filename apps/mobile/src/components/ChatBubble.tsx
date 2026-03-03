import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { palette } from '../theme/tokens/colors';
import { radiusMd, radiusLg, radiusSm } from '../theme/tokens/radius';
import { spaceXs, spaceSm, spaceMd } from '../theme/tokens/spacing';
import { typography } from '../theme/tokens/typography';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChatBubbleVariant = 'sent' | 'received' | 'system';
export type ChatBubbleStatus  = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface ChatBubbleProps {
  message:    string;
  variant:    ChatBubbleVariant;
  timestamp?: string;
  status?:    ChatBubbleStatus;
  /** Show sender name above bubble (for group chats) */
  senderName?: string;
  style?: ViewStyle;
}

// ─── Status Icon ───────────────────────────────────────────────────────────

const STATUS_TEXT: Record<ChatBubbleStatus, string> = {
  sending:   '◦',
  sent:      '✓',
  delivered: '✓✓',
  read:      '✓✓',
  failed:    '!',
};

const STATUS_COLOR: Record<ChatBubbleStatus, string> = {
  sending:   palette.ink400,
  sent:      palette.ink400,
  delivered: palette.ink400,
  read:      palette.mint500,
  failed:    palette.red500,
};

// ─── ChatBubble Component ────────────────────────────────────────────────────

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  variant,
  timestamp,
  status,
  senderName,
  style,
}) => {
  const isSent     = variant === 'sent';
  const isSystem   = variant === 'system';

  if (isSystem) {
    return (
      <View style={[styles.systemWrapper, style]}>
        <Text style={styles.systemText}>{message}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, isSent ? styles.wrapperSent : styles.wrapperReceived, style]}>
      {senderName && !isSent && (
        <Text style={styles.senderName}>{senderName}</Text>
      )}

      <View
        style={[
          styles.bubble,
          isSent ? styles.bubbleSent : styles.bubbleReceived,
        ]}
      >
        <Text style={[styles.messageText, isSent ? styles.messageTextSent : styles.messageTextReceived]}>
          {message}
        </Text>

        <View style={styles.meta}>
          {timestamp && (
            <Text style={[styles.timestamp, isSent ? styles.timestampSent : styles.timestampReceived]}>
              {timestamp}
            </Text>
          )}
          {status && isSent && (
            <Text style={[styles.statusMark, { color: STATUS_COLOR[status] }]}>
              {STATUS_TEXT[status]}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
};

export default ChatBubble;

const styles = StyleSheet.create({
  wrapper: {
    maxWidth: '80%',
    marginVertical: spaceXs / 2,
  },
  wrapperSent: {
    alignSelf: 'flex-end',
  },
  wrapperReceived: {
    alignSelf: 'flex-start',
  },
  bubble: {
    paddingHorizontal: spaceMd,
    paddingVertical:   spaceSm,
    borderRadius: radiusLg,
  },
  bubbleSent: {
    backgroundColor: palette.navy600,
    borderBottomRightRadius: radiusSm,
  },
  bubbleReceived: {
    backgroundColor: palette.white,
    borderBottomLeftRadius: radiusSm,
    borderWidth: 1,
    borderColor: palette.ink200,
  },
  senderName: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.ink500,
    marginBottom: 2,
    marginLeft: spaceSm,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextSent: {
    color: palette.white,
  },
  messageTextReceived: {
    color: palette.ink900,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 3,
  },
  timestamp: {
    fontSize: 10,
  },
  timestampSent: {
    color: 'rgba(255,255,255,0.6)',
  },
  timestampReceived: {
    color: palette.ink400,
  },
  statusMark: {
    fontSize: 10,
    fontWeight: '700',
  },
  systemWrapper: {
    alignSelf: 'center',
    paddingHorizontal: spaceMd,
    paddingVertical: spaceXs,
    backgroundColor: palette.gray100,
    borderRadius: radiusMd,
    marginVertical: spaceSm,
  },
  systemText: {
    fontSize: 11,
    color: palette.ink500,
    textAlign: 'center',
  },
});
