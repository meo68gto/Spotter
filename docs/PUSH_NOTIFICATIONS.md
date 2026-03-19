# Push Notification Infrastructure - EPIC 12

## Overview

Complete push notification infrastructure for Spotter mobile app using Expo Notifications and Supabase Edge Functions.

## Files Created/Modified

### Database Migration
- **File**: `packages/db/migrations/0019_push_notifications.sql`
- **Tables Created**:
  - `push_tokens` - Stores device tokens per user
  - `user_notification_settings` - Per-user notification preferences
  - `notification_deliveries` - Delivery history log
- **Functions Created**:
  - `upsert_push_token()` - Handles token registration/updates
  - `deactivate_stale_push_tokens()` - Cleanup job for old tokens
  - `initialize_user_notification_settings()` - Sets defaults for new users

### Mobile App

#### New Files
1. **`apps/mobile/src/hooks/usePushNotifications.ts`**
   - Main hook for push notification management
   - Handles permissions, token registration, settings
   - Provides notification listeners and local scheduling

2. **`apps/mobile/src/components/NotificationSettings.tsx`**
   - UI component for notification preferences
   - Toggle switches for each notification type
   - Push/Email channel controls

3. **`apps/mobile/src/lib/notifications.ts`**
   - Utility functions for notification handling
   - Deep link navigation from notifications
   - Badge management

#### Modified Files
1. **`apps/mobile/src/screens/ProfileScreen.tsx`**
   - Added Notifications menu item
   - Integrated NotificationSettings component
   - Added navigation to notification settings

2. **`apps/mobile/package.json`**
   - Added `expo-notifications: ~0.29.13`
   - Added `expo-device: ~7.0.1`
   - Added `expo-constants: ~17.0.5`

3. **`apps/mobile/app.json`**
   - Added iOS notification permissions
   - Added Android notification configuration
   - Added expo-notifications plugin

### Edge Functions

1. **`apps/functions/supabase/functions/notifications-token-mgmt/index.ts`**
   - GET: List user's tokens
   - POST: Register/update token
   - DELETE: Deactivate token

2. **`apps/functions/supabase/functions/notifications-send/index.ts`**
   - POST: Send push notifications via Expo
   - Validates user preferences
   - Handles token invalidation
   - Logs delivery status

3. **`apps/functions/supabase/functions/notifications-settings/index.ts`**
   - GET: Fetch user notification settings
   - POST: Update single setting
   - PUT: Bulk update settings

4. **`apps/functions/supabase/functions/notifications-history/index.ts`**
   - GET: Fetch notification history with pagination
   - PATCH: Mark notification as read
   - DELETE: Clear old history

### Configuration Updates

1. **`apps/functions/supabase/config.toml`**
   - Added function configurations for all 4 notification functions

2. **`apps/functions/supabase/functions/_shared/env.ts`**
   - Added `internalApiKey` for service-to-service authentication

## Notification Types

| Type | Description |
|------|-------------|
| `round_invitation` | When invited to a round |
| `round_reminder` | Before scheduled rounds |
| `trust_update` | Trust score changes |
| `reputation_update` | Reputation updates |
| `event_registration` | Event registration updates |
| `message` | New messages |
| `connection_request` | Connection requests |
| `session_reminder` | Session reminders |
| `general` | General announcements |

## Setup Instructions

### 1. Install Dependencies

```bash
cd apps/mobile
pnpm install
```

### 2. Run Database Migration

```bash
cd packages/db
pnpm supabase db push
```

### 3. Deploy Edge Functions

```bash
cd apps/functions
pnpm supabase functions deploy notifications-token-mgmt
pnpm supabase functions deploy notifications-send
pnpm supabase functions deploy notifications-settings
pnpm supabase functions deploy notifications-history
```

### 4. Configure Environment Variables

Add to your `.env` file:

```bash
# For notifications-send function
INTERNAL_API_KEY=your-secure-random-key
```

### 5. Configure Expo Project

Ensure your EAS project is set up:

```bash
cd apps/mobile
eas build:configure
```

## Usage

### Requesting Permissions

```typescript
import { usePushNotifications } from '../hooks/usePushNotifications';

function MyComponent() {
  const { requestPermissions, hasPermissions } = usePushNotifications(userId);
  
  const enableNotifications = async () => {
    const granted = await requestPermissions();
    if (granted) {
      console.log('Push notifications enabled!');
    }
  };
}
```

### Sending Notifications (from backend)

```typescript
// Using the edge function
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/notifications-send`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: targetUserId,
      notification_type: 'round_invitation',
      title: 'New Round Invitation',
      body: 'John invited you to play at Pebble Beach',
      data: {
        round_id: '123-456',
        inviter_name: 'John',
      },
      priority: 'high',
    }),
  }
);
```

### Handling Notification Taps

```typescript
import { handleNotificationResponse } from '../lib/notifications';

usePushNotifications(userId, undefined, (response) => {
  const data = response.notification.request.content.data;
  const deepLink = handleNotificationResponse(data);
  
  if (deepLink) {
    Linking.openURL(deepLink);
  }
});
```

## Deep Link Routing

Notifications automatically route to the correct screen:

| Notification Type | Deep Link |
|------------------|-----------|
| round_invitation | `spotter://rounds/{round_id}` |
| message | `spotter://profile/{user_id}` |
| connection_request | `spotter://network` |
| event_registration | `spotter://events/{event_id}` |
| trust/reputation | `spotter://profile` |
| session_reminder | `spotter://sessions/{session_id}` |

## Testing

### Local Testing

1. **Test permission request:**
   ```bash
   cd apps/mobile
   pnpm dev
   ```
   Navigate to Profile → Notifications → Enable

2. **Test sending:**
   ```bash
   curl -X POST http://localhost:54321/functions/v1/notifications-send \
     -H "Authorization: Bearer ${TOKEN}" \
     -H "Content-Type: application/json" \
     -d '{
       "user_id": "your-user-id",
       "notification_type": "general",
       "title": "Test",
       "body": "Hello from Spotter!"
     }'
   ```

### Production Testing

1. Build and deploy:
   ```bash
   cd apps/mobile
   eas build --platform ios
   ```

2. Test on physical device (simulators don't support push)

## Security Considerations

1. **Token Storage**: Push tokens are stored per-user with RLS policies
2. **Permission Checks**: Users can only manage their own tokens/settings
3. **Service Auth**: Internal API key for service-to-service calls
4. **Token Cleanup**: Invalid tokens are automatically deactivated

## Performance

- **Batching**: Expo Push API supports 100 messages per request
- **Token Deduplication**: Unique constraint on (user_id, token)
- **Inactive Token Cleanup**: Automatic deactivation of stale tokens
- **Pagination**: History API supports pagination (default 20 items)

## Monitoring

Check notification delivery status:

```sql
-- Recent deliveries
SELECT notification_type, status, COUNT(*)
FROM notification_deliveries
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY notification_type, status;

-- Failed deliveries
SELECT * FROM notification_deliveries
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 10;
```

## Troubleshooting

### Token not registering
- Check device permissions in Settings
- Verify `expo-notifications` is properly configured in app.json
- Check console for errors in `usePushNotifications`

### Notifications not received
- Verify token is active in `push_tokens` table
- Check user has push_enabled for the notification type
- Review `notification_deliveries` for error messages

### Deep links not working
- Ensure URL scheme `spotter://` is registered
- Check `Linking` configuration in App.tsx
- Verify notification data contains correct screen info

## Future Enhancements

- [ ] Rich notifications with images
- [ ] Notification grouping by type
- [ ] Scheduled/local notifications for reminders
- [ ] Notification analytics dashboard
- [ ] A/B testing notification content
