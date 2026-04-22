const LOG_LEVELS = ["debug", "info", "warn", "error"];
const LEVEL_PRIORITY = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const configuredLevel = (process.env.LOG_LEVEL || "info").toLowerCase();
const activeLevel = LOG_LEVELS.includes(configuredLevel)
  ? configuredLevel
  : "info";

const shouldLog = (level) =>
  LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[activeLevel];

const serializeError = (error) => {
  if (!(error instanceof Error)) {
    return error;
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
};

const normalizeContext = (context) => {
  if (context === undefined || context === null) {
    return {};
  }

  if (context instanceof Error) {
    return { error: serializeError(context) };
  }

  if (typeof context !== "object") {
    return { value: context };
  }

  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [key, serializeError(value)]),
  );
};

const writeLog = (level, message, context = {}) => {
  if (!shouldLog(level)) {
    return;
  }

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context: normalizeContext(context),
  };

  const output = `${JSON.stringify(entry)}\n`;
  if (level === "error") {
    process.stderr.write(output);
    return;
  }

  process.stdout.write(output);
};

export const logger = {
  debug: (message, context) => writeLog("debug", message, context),
  info: (message, context) => writeLog("info", message, context),
  warn: (message, context) => writeLog("warn", message, context),
  error: (message, context) => writeLog("error", message, context),
};

export default logger;
