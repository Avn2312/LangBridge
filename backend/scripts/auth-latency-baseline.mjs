import process from "node:process";
import { performance } from "node:perf_hooks";

const baseUrl = process.env.BENCH_BASE_URL || "http://localhost:3000";
const endpoint = process.env.BENCH_AUTH_ENDPOINT || "/api/auth/login";
const runs = Number.parseInt(process.env.BENCH_RUNS || "50", 10);
const warmupRuns = Number.parseInt(process.env.BENCH_WARMUP_RUNS || "5", 10);
const timeoutMs = Number.parseInt(process.env.BENCH_TIMEOUT_MS || "5000", 10);

const email = process.env.BENCH_EMAIL || "bench-user@example.com";
const password = process.env.BENCH_PASSWORD || "invalid-password";

if (!Number.isFinite(runs) || runs <= 0) {
  throw new Error("BENCH_RUNS must be a positive integer.");
}

const url = `${baseUrl.replace(/\/$/, "")}${endpoint}`;

const requestOnce = async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const startedAt = performance.now();

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ email, password }),
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
  console.log("Running auth latency baseline...");
  console.log(
    JSON.stringify(
      {
        url,
        runs,
        warmupRuns,
        timeoutMs,
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
  console.log("Auth latency summary:");
  console.log(JSON.stringify(summary, null, 2));

  if (summary.p95Ms > 250) {
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error("Auth latency benchmark failed:", error);
  process.exit(1);
});
