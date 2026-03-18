# Mobile Screen Audit Checklist

Use this checklist for release signoff. Pair this with generated inventory:
- `/Users/brucewayne/Documents/Spotter/docs/qa/_generated-screen-index.md`

## Legend
- Status: `NOT STARTED` | `PASS` | `FAIL` | `N/A`
- Priority: `P0` (ship blocking), `P1` (should fix before launch), `P2` (post-launch acceptable)

## Audit Matrix
| Area | Screen / State | Functional Happy Path | Error / Empty / Loading | Pull-to-Refresh | Offline / Network Failure | Deep Link Entry | Accessibility | Theme Parity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Auth | SplashScreen | NOT STARTED | NOT STARTED | N/A | N/A | `spotter://welcome` | NOT STARTED | NOT STARTED |
| Auth | WelcomeScreen | NOT STARTED | N/A | N/A | N/A | `spotter://welcome` | NOT STARTED | NOT STARTED |
| Auth | LoginScreen | NOT STARTED | NOT STARTED | N/A | NOT STARTED | `spotter://login` | NOT STARTED | NOT STARTED |
| Auth | SignUpScreen | NOT STARTED | NOT STARTED | N/A | NOT STARTED | `spotter://signup` | NOT STARTED | NOT STARTED |
| Onboarding | OnboardingWizard steps 1-4 | NOT STARTED | NOT STARTED | N/A | NOT STARTED | N/A | NOT STARTED | NOT STARTED |
| Home | HomeScreen + quick actions | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | `spotter://home` | NOT STARTED | NOT STARTED |
| Discover | MapScreen native/web fallback | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | `spotter://discover` | NOT STARTED | NOT STARTED |
| Coaching | Browse/Profile/Availability/Book | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | `spotter://coaching` | NOT STARTED | NOT STARTED |
| Coaching | Active Session/Chat/Video/Review | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | `spotter://coaching/session/:sessionId` | NOT STARTED | NOT STARTED |
| Inbox | Conversations list | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | `spotter://inbox` | NOT STARTED | NOT STARTED |
| Inbox | Chat screen | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | N/A | NOT STARTED | NOT STARTED |
| Inbox | Notifications | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | N/A | NOT STARTED | NOT STARTED |
| Profile | Dashboard + cards | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | `spotter://profile` | NOT STARTED | NOT STARTED |
| Profile | Edit/Skill/History/Video/Settings | NOT STARTED | NOT STARTED | NOT STARTED | NOT STARTED | N/A | NOT STARTED | NOT STARTED |
| Global | Toast/Skeleton/Error Boundary | NOT STARTED | NOT STARTED | N/A | N/A | N/A | NOT STARTED | NOT STARTED |

## Signoff
- QA Owner:
- Date:
- Build:
- Summary:
- Open defects (P0/P1/P2):
