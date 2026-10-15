# React + TypeScript + Jest market-data example

## Pinned toolchain
- Node.js: v22.16.0 (runtime used for validation)
- React / React DOM: 18.3.1
- Jest / jest-environment-jsdom: 29.7.0
- ts-jest: 29.2.5
- TypeScript: 5.7.2
- @testing-library/react: 16.1.0
- @testing-library/jest-dom: 6.6.3

Exact dependency versions are pinned in `package.json`. For a reproducible install, generate and commit `package-lock.json` with `npm install` in the target repository, then use `npm ci` in CI.

## Commands
```bash
npm install
npm test
npm run typecheck
```

`npm test` runs `jest --runInBand`. TypeScript `ignoreDeprecations: "5.0"` is set explicitly in `tsconfig.json` for the pinned TypeScript 5.7.2 compiler.

## Retry and timeout behavior
- `maxRetries` means retries **after** the initial attempt. The default is 2 retries (3 total attempts).
- Each attempt has a timeout. `AbortController` asks a real `fetch` request to stop; `Promise.race` also ensures the attempt settles if a custom transport ignores its signal.
- When retries are exhausted, the in-flight entry is removed in `finally`, so a later call for the same normalized symbol can start a new request.
- HTTP 429 and selected 5xx responses (500, 502, 503, 504) are retryable. Other HTTP errors, invalid market-data shapes, and malformed JSON are not retried. Malformed JSON is wrapped as `MarketDataValidationError` rather than being treated as a generic transient error.
- Network failures and timeouts are treated as transient and are retried up to the configured limit. Production implementations may also honor `Retry-After` and use jitter.

## React stale-result handling
`MarketQuote` marks each effect invocation inactive during cleanup. A result or error from an older symbol is ignored after the symbol changes, and the previous quote is cleared while the new symbol loads. The shared service request is not cancelled by the component, because another component may be sharing it through request deduplication.

## Test coverage added
- A transport that ignores abort times out, exhausts its configured retries, and does not leave a stuck in-flight entry; a fresh call for the same symbol then succeeds.
- Malformed JSON causes one attempt even with default retry settings.
- A stale response resolving after a symbol change cannot overwrite the newer quote.

The tests use standard Jest APIs and React Testing Library. `fetchImpl` is injected into the service for deterministic API tests; no Vitest-only global stubbing APIs are used.
