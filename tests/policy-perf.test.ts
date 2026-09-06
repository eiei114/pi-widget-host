import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultConfig } from "../lib/config.ts";
import { evaluateProviderEntries } from "../lib/policy.ts";
import type { ProviderEntry } from "../lib/types.ts";

const PROVIDER_COUNT = 200;
const MUTED_COUNT = 20;
const WARMUP_ITERATIONS = 500;
const MEASURED_ITERATIONS = 5_000;
/**
 * Pre-optimization baseline (2026-W36, dev machine): ~80.5 µs/call.
 * Post Set lookup (dev machine): ~68 µs/call.
 * CI (ubuntu-latest shared runner) observed ~134.6 µs/call for the same code,
 * so the budget is calibrated with headroom for shared-runner variance while
 * still rejecting pre-optimization-level regressions on CI hardware.
 */
const MAX_MICROSECONDS_PER_CALL = 150;

function buildStressEntries(now: Date): ProviderEntry[] {
  const tags = ["music", "sports", "playing-now", "matchday", "idle", "unknown"] as const;
  return Array.from({ length: PROVIDER_COUNT }, (_, index) => ({
    providerId: `provider-${index}`,
    available: true,
    lines: ["line"],
    updatedAt: now.toISOString(),
    priority: index % 50,
    tags: [tags[index % tags.length], tags[(index + 1) % tags.length]],
    ttlMs: 60_000,
  }));
}

test("evaluateProviderEntries stays within the large-registry budget", () => {
  const config = createDefaultConfig();
  config.mutedProviderIds = Array.from({ length: MUTED_COUNT }, (_, index) => `provider-${index * 7}`);
  const now = new Date("2026-06-15T12:00:00.000Z");
  const entries = buildStressEntries(now);

  for (let index = 0; index < WARMUP_ITERATIONS; index++) {
    evaluateProviderEntries(entries, config, now);
  }

  const started = performance.now();
  for (let index = 0; index < MEASURED_ITERATIONS; index++) {
    evaluateProviderEntries(entries, config, now);
  }
  const elapsedMs = performance.now() - started;
  const microsecondsPerCall = (elapsedMs / MEASURED_ITERATIONS) * 1_000;

  assert.ok(
    microsecondsPerCall < MAX_MICROSECONDS_PER_CALL,
    `expected < ${MAX_MICROSECONDS_PER_CALL} µs/call, got ${microsecondsPerCall.toFixed(2)} µs/call`,
  );
});
