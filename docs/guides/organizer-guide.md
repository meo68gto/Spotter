# Organizer Guide

Complete guide for Spotter Tournament Organizers (Bronze, Silver, Gold tiers).

## Overview

As a Spotter Organizer, you can:
- **Create and manage** tournaments and events
- **Track registrations** and check-ins
- **Send invites** to Spotter members
- **Analyze** event performance and attendee engagement
- **Build your golf community** with professional tools

## Organizer Tiers

### Bronze Tier (Free)

**Best for:** Small golf groups, informal tournaments

**Includes:**
- Up to **5 events per year**
- Up to **500 registrations**
- Basic event management
- Email notifications
- Registration tracking
- Simple analytics

**Cost:** Free

### Silver Tier ($29.99/month)

**Best for:** Growing golf associations, regular tournaments

**Includes:**
- Up to **20 events per year**
- Up to **2,500 registrations**
- Priority email support
- Advanced analytics
- Custom branding (logo, colors)
- Waitlist management
- Early access to new features

**Cost:** $29.99/month or $299.90/year (17% savings)

### Gold Tier ($99.99/month)

**Best for:** Professional tournament organizers, corporate events

**Includes:**
- **Unlimited events**
- **Unlimited registrations**
- White-label options (custom domain)
- **API access** for integrations
- Dedicated support
- Advanced integrations
- Custom workflows
- Team collaboration (up to 10 members)

**Cost:** $99.99/month or $999.90/year (17% savings)

## Getting Started

### 1. Create Your Organizer Account

1. Open the Spotter app
2. Go to Profile → Become an Organizer
3. Enter organization details:
   - Organization name
   - Description
   - Website (optional)
   - Contact email
   - Physical address
4. Choose your tier (Bronze, Silver, or Gold)
5. Complete payment (for Silver/Gold)

### 2. Set Up Your Team

**Gold tier only:**

1. Go to Organizer Dashboard → Team
2. Invite team members by email
3. Assign roles:
   - **Owner**: Full control, billing access
   - **Admin**: Manage events, members, settings
   - **Manager**: Create/edit events, view registrations
   - **Viewer**: View-only access

### 3. Customize Your Brand (Silver+)

1. Go to Organizer Dashboard → Settings → Branding
2. Upload your logo
3. Set your brand colors
4. Add custom email templates

**Gold only:** Configure white-label domain

## Creating Events

### Event Types

| Type | Description | Best For |
|------|-------------|----------|
| **Tournament** | Competitive with scoring | Championships, leagues |
| **Scramble** | Team format, best ball | Fundraisers, corporate |
| **Charity** | Fundraising event | Nonprofits, causes |
| **Corporate** | Team building/entertainment | Company outings |
| **Social** | Casual gathering | Member meetups |

### Event Settings

**Basic Settings:**
- Title and description
- Course selection
- Date and time
- Max participants
- Public or invite-only

**Registration Settings:**
- Registration open/close times
- Entry fee (optional)
- Custom registration fields
- Waitlist options

**Visibility Settings:**
- Which member tiers can see the event
- Geographic targeting
- Connection-based invites

### Creating Your First Event

1. Go to Organizer Dashboard → Events
2. Tap "Create New Event"
3. Select event type
4. Fill in event details
5. Choose registration settings
6. Set visibility (target tiers)
7. Preview and publish

### Custom Registration Fields

Collect additional information:

- Handicap (number)
- Team/Group name (text)
- Dietary restrictions (text)
- Shirt size (select: S, M, L, XL, XXL)
- Cart preference (select: walking, riding)
- Waiver agreement (checkbox)

## Managing Registrations

### Registration Dashboard

View all registrations with filters:
- Status (registered, confirmed, waitlisted, checked-in, cancelled)
- Payment status
- Registration date
- Custom field responses

### Check-In Process

**Day of event:**
1. Open the event in Organizer Dashboard
2. Tap "Check-In Mode"
3. Scan QR code or search by name
4. Mark attendees as checked-in
5. Track no-shows

**Export:** Download check-in list as CSV

### Managing Waitlists

When event is full:
1. New registrations go to waitlist
2. If spot opens (cancellation), waitlisted person is notified
3. They have 24 hours to confirm
4. If no response, spot goes to next waitlisted person

### Sending Invites

**To Spotter members:**
1. Go to Event → Invites
2. Search members (filtered by your tier visibility)
3. Select members to invite
4. Add personalized message
5. Send invites

**To non-members (via email):**
1. Go to Event → Invites
2. Switch to "Email Invites" tab
3. Enter email addresses
4. Add message
5. Send

Recipients get an email with registration link

## Analytics

### Registration Metrics

Track:
- Total registrations
- Registration sources (invite, public, direct)
- Conversion rate (view to register)
- Registration velocity (signups per day)
- Device breakdown (mobile vs desktop)

### Attendance Metrics

Analyze:
- Check-in rate
- No-show rate
- Average arrival time
- Check-in time distribution

### Revenue Metrics (paid events)

View:
- Total revenue
- Revenue by event
- Payment method breakdown
- Refunds processed
- Average transaction value

### Engagement Metrics

Monitor:
- Email open rate
- Email click rate
- Social shares
- Return attendee rate

### Exporting Reports

Export data as:
- CSV (spreadsheets)
- PDF (formatted reports)
- JSON (API data - Gold only)

## Event Communication

### Automated Emails

Spotter automatically sends:
- Registration confirmation
- Payment receipt (paid events)
- Reminder (24 hours before)
- Check-in instructions (day of)
- Thank you (after event)
- Survey request (after event)

### Custom Email Templates (Silver+)

1. Go to Organizer Dashboard → Communications
2. Create custom templates
3. Use variables: `{{firstName}}`, `{{eventName}}`, etc.
4. Set trigger conditions

### Bulk Messaging

Send messages to:
- All registered participants
- Checked-in participants
- No-shows
- Waitlisted

## Advanced Features

### API Access (Gold)

Integrate with your systems:

```bash
# Get API key from Dashboard → Settings → API

# Example: List your events
curl https://api.spotter.golf/functions/v1/organizer-events \
  -H "Authorization: Bearer ORG_API_KEY"

# Example: Get registrations
curl https://api.spotter.golf/functions/v1/organizer-registrations?eventId=xxx \
  -H "Authorization: Bearer ORG_API_KEY"
```

See [API Documentation](../api/README.md) for complete reference.

### White Label (Gold)

Configure custom domain:
1. Purchase domain
2. Configure DNS (CNAME to spotter.golf)
3. Go to Dashboard → Settings → White Label
4. Enter domain and upload SSL certificate
5. Customize branding

### Zapier Integration (Gold)

Connect to 5000+ apps:
- Google Sheets (auto-update registration lists)
- Mailchimp (sync attendees to lists)
- Slack (notify team of new registrations)
- Salesforce (track corporate contacts)

## Best Practices

### Event Planning

1. **Plan early** - Give members 2-4 weeks notice
2. **Set clear expectations** - Format, skill level, pace of play
3. **Communicate often** - Weekly reminders leading up
4. **Over-communicate day-of** - Parking, check-in, weather

### Registration Management

1. **Review registrations daily** - Watch for issues
2. **Follow up on unpaid** - Send reminders
3. **Confirm with waitlist** - 24-hour response window
4. **Export backup** - Day before event

### Day-of Execution

1. **Arrive early** - 30 minutes before first tee time
2. **Have check-in system ready** - Test QR scanner
3. **Bring backup** - Printed list in case tech fails
4. **Collect feedback** - Quick survey after round

### Post-Event

1. **Send thank you** - Within 24 hours
2. **Share photos** - If members consent
3. **Analyze metrics** - What worked, what didn't
4. **Plan next event** - While momentum is high

## Troubleshooting

### Registration not appearing

Check:
- Email spam folder
- Payment status (if paid event)
- Waitlist status (if event full)

### Can't invite certain members

You can only invite members in your organizer tier or higher:
- Bronze organizer → Can invite Bronze+
- Silver organizer → Can invite Silver+
- Gold organizer → Can invite any tier

### Payment failed

For paid events:
1. Check Stripe dashboard
2. Verify webhook is configured
3. Contact support if persistent

### Check-in app not working

1. Ensure stable internet connection
2. Try web version as backup
3. Use printed list if needed

## FAQ

**Q: Can I downgrade my organizer tier?**
A: Yes, at end of billing period. Events over new tier limits remain active.

**Q: What happens if I exceed my event limit?**
A: Bronze/Silver: Must upgrade or archive old events. Gold: Unlimited.

**Q: Can I transfer ownership?**
A: Yes, in Team settings. New owner assumes billing responsibility.

**Q: Do I need to be a Spotter member?**
A: Yes, you need a Spotter account, but your member tier is separate from organizer tier.

**Q: Can I cancel my organizer account?**
A: Yes, but you'll lose access to analytics and historical data.

**Q: How do I get API access?**
A: API access is a Gold tier feature. Create API keys in Dashboard → Settings → API.

## Support

- **Bronze:** Community forums, documentation
- **Silver:** Email support (24-hour response)
- **Gold:** Priority support (4-hour response), dedicated account manager

Contact: organizers@spotter.golf

## Related Documentation

- [API Reference](../api/README.md)
- [Tier Upgrade Guide](./tier-upgrade.md)
- [Member Guide](./member-guide.md)
