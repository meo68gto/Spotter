# Legal and Consent

## Surfaces

- In-app legal consent screen (mobile) blocks product usage until consent is accepted.
- Hosted legal docs:
  - Terms of Service (`LEGAL_TOS_URL`)
  - Privacy Policy (`LEGAL_PRIVACY_URL`)
  - Cookie Policy (`LEGAL_COOKIE_URL`)

## Data capture

`user_legal_consents` stores:

- `user_id`
- `tos_version`
- `privacy_version`
- `cookie_version`
- `locale`
- `accepted_at`

## APIs

- `GET /functions/v1/legal-status`
- `POST /functions/v1/legal-consent`

## Policy

- New legal versions require incrementing `LEGAL_*_VERSION` in runtime env.
- Users are re-prompted automatically when accepted versions no longer match required versions.
