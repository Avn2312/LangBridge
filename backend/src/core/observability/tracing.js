import crypto from "crypto";
import { AsyncLocalStorage } from "async_hooks";

const traceStorage = new AsyncLocalStorage();

const TRACEPARENT_REGEX =
  /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i;

const createTraceId = () => crypto.randomBytes(16).toString("hex");
const createSpanId = () => crypto.randomBytes(8).toString("hex");

export const parseTraceparent = (value) => {
  if (!value || typeof value !== "string") {
    return null;
  }

  const match = value.trim().match(TRACEPARENT_REGEX);
  if (!match) {
    return null;
  }

  return {
    traceId: match[1].toLowerCase(),
    parentSpanId: match[2].toLowerCase(),
    traceFlags: match[3].toLowerCase(),
  };
};

export const buildTraceparent = ({ traceId, spanId, traceFlags = "01" }) =>
  `00-${traceId}-${spanId}-${traceFlags}`;

export const createTraceContext = (headers = {}) => {
  const incoming = parseTraceparent(headers.traceparent);
  const traceId = incoming?.traceId || createTraceId();
  const spanId = createSpanId();

  return {
    traceId,
    spanId,
    parentSpanId: incoming?.parentSpanId,
    traceFlags: incoming?.traceFlags || "01",
    requestId:
      headers["x-request-id"]?.toString?.().trim() || crypto.randomUUID(),
  };
};

export const runWithTraceContext = (context, callback) =>
  traceStorage.run(context, callback);

export const getTraceContext = () => traceStorage.getStore();

export const traceContextMiddleware = (req, res, next) => {
  const context = createTraceContext(req.headers);

  req.id = context.requestId;
  req.traceId = context.traceId;
  req.spanId = context.spanId;

  res.setHeader("X-Request-Id", context.requestId);
  res.setHeader("traceparent", buildTraceparent(context));

  runWithTraceContext(context, next);
};
