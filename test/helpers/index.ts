/**
 * Shared helpers for SDK e2e/localnet tests.
 *
 * See `docs/E2E_TEST_COVERAGE_PLAN.md` Phase 0 for the rationale.
 *
 * `wallets.ts` (fresh-funded-wallet factory) and `events.ts` (Anchor
 * event ws subscriber) intentionally don't live here yet — they had
 * no consumer at Phase 0 acceptance and their designs (kit-native
 * mint-to, Node 18 WebSocket compatibility) need consumer-side
 * pressure before they're usable. Re-add when Phase 1.3 (vault tests
 * → mint-to) and the F51 events test land.
 */
export * from './errors.js';
export * from './time.js';
