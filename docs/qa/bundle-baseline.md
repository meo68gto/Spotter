# Bundle Baseline

## Baseline policy
- Generate report with:
  - `pnpm qa:mobile-bundle-report`
- Store artifact:
  - `.artifacts/qa/mobile-bundle-report.json`

## Regression threshold
- JS total bytes: block RC if > 15% increase vs previous approved baseline.
- Largest single JS file: investigate if > 20% increase.
- Top asset list must not introduce duplicate large media accidentally.

## Baseline snapshot
- Approved build:
- JS total bytes:
- Asset total bytes:
- Largest JS file:
- Notes:
