# Accessibility Mobile Standards

## Required for interactive elements
1. Set `accessibilityRole` and clear `accessibilityLabel`.
2. Ensure minimum touch target is 44x44 pt equivalent.
3. Ensure keyboard/switch traversal and screen-reader focus order match visual order.
4. Do not encode status with color alone.
5. Prefer concise labels with action verbs.

## Lists and cards
1. Group card content semantically when cards are actionable.
2. Expose unread counts and statuses as text, not only badges.
3. Ensure `accessibilityHint` on destructive or irreversible actions.

## Forms
1. Inputs must have labels and error messaging discoverable by screen readers.
2. Validation errors should be announced and focused.
3. Primary submit button should include action intent.

## Motion and feedback
1. Avoid rapid flashing animation.
2. Toasts must include accessible text and should not be the sole indicator for critical state.
3. Haptics are additive only; provide non-haptic signal as well.

## Required pass criteria
- VoiceOver pass on iOS.
- TalkBack pass on Android.
- No P0 accessibility defects in auth, onboarding, home, inbox, booking, and settings flows.
