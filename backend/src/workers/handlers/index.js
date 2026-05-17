import { aiCorrectionHandlers } from "./ai-correction.handler.js";
import { analyticsHandlers } from "./analytics.handler.js";
import { moderationHandlers } from "./moderation.handler.js";
import { notificationHandlers } from "./notification.handler.js";

export const eventHandlers = {
  ...analyticsHandlers,
  ...aiCorrectionHandlers,
  ...moderationHandlers,
  ...notificationHandlers,
};
