# Mobile Store Capture SOP

## Preconditions
1. Use release-candidate build.
2. Seed deterministic demo/test account data.
3. Set locale and theme for each capture set.
4. Disable noisy notifications and dev overlays.

## Capture sequence
1. Boot simulator/emulator target device profile.
2. Reset app state.
3. Navigate to target flow (welcome, login, home, coaching, inbox, profile).
4. Capture screenshots with exact naming convention.
5. Verify dimensions and status-bar consistency.

## Recommended command placeholders
- iOS simulator screenshot:
  - `xcrun simctl io booted screenshot <output.png>`
- Android emulator screenshot:
  - `adb exec-out screencap -p > <output.png>`

## Quality checks
1. No debug text or placeholders.
2. No clipped UI or overlap.
3. Readable contrast in both light/dark showcases if included.
4. Match approved copy and feature claims.

## Output mapping
- Store all captures in:
  - `apps/mobile/assets/store/ios/`
  - `apps/mobile/assets/store/android/`
- Update `apps/mobile/assets/store/manifest.json` with final file mapping.
