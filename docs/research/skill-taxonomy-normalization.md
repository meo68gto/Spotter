# Research Memo: Universal Skill Taxonomy Strategy

## Input Systems
- USGA handicap (inverse scale)
- NTRP rating (ordinal ranges)
- Soccer federation descriptors (tiered competency)
- Ski ability descriptors (qualitative levels)

## Proposed Normalization
- Store raw source value + source scale unchanged.
- Derive canonical 0-100 score per activity-specific mapping function.
- Preserve sub-dimensions (technique, endurance, tactical, safety) in JSONB.
- Include confidence score and recency decay function.

## Schema Implications
- `skill_profiles.source_scale`
- `skill_profiles.source_value`
- `skill_profiles.canonical_score`
- `skill_profiles.dimensions` (JSONB)
- `skill_profiles.embedding` reserved for vector ranking
