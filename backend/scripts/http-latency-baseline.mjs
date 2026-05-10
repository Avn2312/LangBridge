import process from "node:process";
import { performance } from "node:perf_hooks";

const baseUrl = process.env.BENCH_BASE_URL || "http://localhost:3000";
const endpoint =
  process.env.BENCH_ENDPOINT || "/api/messages/conversations?page=1&limit=20";
const method = process.env.BENCH_METHOD || "GET";
const runs = Number.parseInt(process.env.BENCH_RUNS || "50", 10);
const warmupRuns = Number.parseInt(process.env.BENCH_WARMUP_RUNS || "5", 10);
const timeoutMs = Number.parseInt(process.env.BENCH_TIMEOUT_MS || "5000", 10);
const cookie = process.env.BENCH_COOKIE || "";
const p95BudgetMs = Number.parseInt(process.env.BENCH_P95_BUDGET_MS || "250", 10);

if (!Number.isFinite(runs) || runs <= 0) {
  throw new Error("BENCH_RUNS must be a positive integer.");
}

const url = `${baseUrl.replace(/\/$/, "")}${endpoint}`;

const requestOnce = async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();

  try {
    const headers = {};
    if (cookie) {
      headers.cookie = cookie;
    }

    const response = await fetch(url, {
      method,
      headers,
      signal: controller.signal,
    });

    await response.text();

    return {
      status: response.status,
      durationMs: performance.now() - startedAt,
      timedOut: false,
    };
  } catch (error) {
    return {
      status: 0,
      durationMs: performance.now() - startedAt,
      timedOut: error?.name === "AbortError",
    };
  } finally {
    clearTimeout(timer);
  }
};

const percentile = (sortedValues, p) => {
  if (!sortedValues.length) {
    return 0;
  }

  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedValues.length) - 1),
  );

  return sortedValues[index];
};

const summarize = (samples) => {
  const durations = samples
    .map((sample) => sample.durationMs)
    .sort((a, b) => a - b);
  const total = durations.reduce((sum, value) => sum + value, 0);
  const timedOutCount = samples.filter((sample) => sample.timedOut).length;
  const statusCounts = samples.reduce((acc, sample) => {
    const key = String(sample.status);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    count: samples.length,
    timedOutCount,
    averageMs: Number((total / durations.length).toFixed(2)),
    p50Ms: Number(percentile(durations, 50).toFixed(2)),
    p95Ms: Number(percentile(durations, 95).toFixed(2)),
    p99Ms: Number(percentile(durations, 99).toFixed(2)),
    minMs: Number(durations[0].toFixed(2)),
    maxMs: Number(durations[durations.length - 1].toFixed(2)),
    statusCounts,
  };
};

const run = async () => {
  console.log("Running HTTP latency baseline...");
  console.log(
    JSON.stringify(
      {
        url,
        method,
        runs,
        warmupRuns,
        timeoutMs,
        hasCookie: Boolean(cookie),
        p95BudgetMs,
      },
      null,
      2,
    ),
  );

  for (let i = 0; i < warmupRuns; i += 1) {
    await requestOnce();
  }

  const samples = [];
  for (let i = 0; i < runs; i += 1) {
    samples.push(await requestOnce());
  }

  const summary = summarize(samples);
  console.log("HTTP latency summary:");
  console.log(JSON.stringify(summary, null, 2));

  if (summary.p95Ms > p95BudgetMs) {
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error("HTTP latency benchmark failed:", error);
  process.exit(1);
});

