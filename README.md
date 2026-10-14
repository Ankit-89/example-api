# React + TypeScript + Jest market-data example

## Versions pinned in package.json
- Node.js: v22.16.0 (environment used to run this project)
- React / React DOM: 18.3.1
- Jest / jest-environment-jsdom: 29.7.0
- ts-jest: 29.2.5
- TypeScript: 5.7.2
- @testing-library/react: 16.1.0
- @testing-library/jest-dom: 6.6.3

## Run
```bash
npm install
npm test
```
Test command: `jest --runInBand`.

## Decisions
- `fetchImpl` is injected for deterministic tests. No `stubGlobal` or `unstubAllGlobals` is used.
- Each attempt uses `AbortController` with a timeout. Standard browser `fetch` rejects when its signal is aborted; the in-flight promise then settles, retries are bounded, and `finally` removes the deduplication entry.
- Default retries: 2 retries after the initial request (3 total attempts).
- HTTP 429 is treated as transient and retried; persistent 429 therefore causes 3 attempts by default. In production, honor `Retry-After` when present and add jitter.
- Invalid JSON / invalid price is a `MarketDataValidationError` and is not retried. Retrying malformed payloads will not fix a deterministic contract mismatch and needlessly repeats load.
- Ordinary 4xx responses such as 400 are not retried. Network errors and selected 5xx statuses are retried.
- UI effect cleanup ignores stale results after symbol changes. It does not cancel the shared service request, because cancellation by one component could affect other consumers sharing that request.

This is an illustrative sample, not a claim about changes made in an existing repository.
