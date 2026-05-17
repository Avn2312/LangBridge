import { logger } from "../../core/observability/logger.js";
import { sendError } from "../../core/http/api-response.js";
import { listRecommendations } from "./matching.service.js";

export async function getRecommendations(req, res) {
  try {
    const result = await listRecommendations({
      currentUser: req.user,
      query: req.query,
    });

    return res.status(200).json(result);
  } catch (error) {
    logger.error("Error in getRecommendations controller", error);
    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}
