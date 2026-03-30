# Eval Criteria — tier.ts (All Night Auto Research)

The agent can only edit `src/tier.ts`.

Eval: `pnpm --filter=@spotter/types vitest run` — must exit 0.

Binary questions:
1. Does `canSeeTier(free, select)` return false?
2. Does `canSeeTier(select, select)` return true?
3. Does `canAccessFeature(free, 'discovery')` return false?
4. Does `canAccessFeature(select, 'discovery')` return true?
5. Does `canAccessFeature(select, 'hunt_mode')` return true?
