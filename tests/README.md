# Test Suite

This project uses **Vitest** + **Vue Test Utils** with a **jsdom** environment.

## What is covered

- Core composables API surface and behavior (`useSteam`, `useDataSync`, `useSteamLogin`, `useStatsAutoLoad`, `useGameInfoModal`)
- Core utility behavior (`copyToClipboard`)
- Router behavior (`useRouter`)
- Signaling flow smoke path (`attachSignaling`)
- Reusable UI components render/events
- Import smoke coverage for all Vue SFC modules

## Run tests

```powershell
npm test
npm run test:watch
npm run test:coverage
```

## Notes

- The suite is intentionally split into fast unit tests and import smoke tests.
- Import smoke tests catch accidental module breakage across all SFC files.
- For deeper business logic testing, expand cases under `tests/unit/`.

