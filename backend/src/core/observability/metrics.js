const buckets = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

const counters = new Map();
const gauges = new Map();
const histograms = new Map();

const labelKey = (labels = {}) =>
  Object.entries(labels)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(",");

const metricKey = (name, labels) => `${name}{${labelKey(labels)}}`;

const escapeLabelValue = (value) =>
  String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const formatLabels = (labels = {}) => {
  const entries = Object.entries(labels).filter(
    ([, value]) => value !== undefined && value !== null,
  );

  if (entries.length === 0) {
    return "";
  }

  return `{${entries
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}="${escapeLabelValue(value)}"`)
    .join(",")}}`;
};

export const incrementCounter = (name, labels = {}, value = 1) => {
  const key = metricKey(name, labels);
  const current = counters.get(key) || { name, labels, value: 0 };
  current.value += value;
  counters.set(key, current);
};

export const setGauge = (name, labels = {}, value = 0) => {
  gauges.set(metricKey(name, labels), { name, labels, value });
};

export const observeHistogram = (name, labels = {}, value = 0) => {
  const key = metricKey(name, labels);
  const histogram =
    histograms.get(key) ||
    {
      name,
      labels,
      count: 0,
      sum: 0,
      buckets: new Map(buckets.map((bucket) => [bucket, 0])),
    };

  histogram.count += 1;
  histogram.sum += value;

  for (const bucket of buckets) {
    if (value <= bucket) {
      histogram.buckets.set(bucket, histogram.buckets.get(bucket) + 1);
    }
  }

  histograms.set(key, histogram);
};

export const observeHttpRequest = ({ method, route, statusCode, durationMs }) => {
  const labels = {
    method,
    route,
    status_code: statusCode,
  };

  incrementCounter("http_requests_total", labels);
  observeHistogram("http_request_duration_ms", labels, durationMs);

  if (statusCode >= 500) {
    incrementCounter("http_errors_total", {
      method,
      route,
      status_code: statusCode,
    });
  }
};

export const observeSocketAckLatency = ({ event, ok, durationMs }) => {
  observeHistogram(
    "socket_ack_duration_ms",
    { event, ok: ok ? "true" : "false" },
    durationMs,
  );
};

export const incrementSocketRetry = ({ event, reason }) => {
  incrementCounter("socket_retries_total", { event, reason });
};

export const observeKafkaConsumerLag = ({ topic, partition, lag }) => {
  if (!Number.isFinite(lag) || lag < 0) {
    return;
  }

  setGauge("kafka_consumer_lag", { topic, partition }, lag);
};

export const incrementKafkaEvent = ({ topic, outcome }) => {
  incrementCounter("kafka_consumer_events_total", { topic, outcome });
};

export const incrementKafkaPublish = ({ topic, outcome }) => {
  incrementCounter("kafka_publish_events_total", { topic, outcome });
};

export const renderMetrics = () => {
  const lines = [
    "# HELP http_requests_total Total HTTP requests.",
    "# TYPE http_requests_total counter",
  ];

  for (const { name, labels, value } of counters.values()) {
    lines.push(`${name}${formatLabels(labels)} ${value}`);
  }

  lines.push("# HELP process_uptime_seconds Process uptime in seconds.");
  lines.push("# TYPE process_uptime_seconds gauge");
  lines.push(`process_uptime_seconds ${process.uptime()}`);
  lines.push("# HELP process_memory_rss_bytes Resident memory size in bytes.");
  lines.push("# TYPE process_memory_rss_bytes gauge");
  lines.push(`process_memory_rss_bytes ${process.memoryUsage().rss}`);

  for (const { name, labels, value } of gauges.values()) {
    lines.push(`${name}${formatLabels(labels)} ${value}`);
  }

  for (const histogram of histograms.values()) {
    for (const [bucket, count] of histogram.buckets.entries()) {
      lines.push(
        `${histogram.name}_bucket${formatLabels({
          ...histogram.labels,
          le: bucket,
        })} ${count}`,
      );
    }
    lines.push(
      `${histogram.name}_bucket${formatLabels({
        ...histogram.labels,
        le: "+Inf",
      })} ${histogram.count}`,
    );
    lines.push(
      `${histogram.name}_sum${formatLabels(histogram.labels)} ${histogram.sum}`,
    );
    lines.push(
      `${histogram.name}_count${formatLabels(histogram.labels)} ${
        histogram.count
      }`,
    );
  }

  return `${lines.join("\n")}\n`;
};
