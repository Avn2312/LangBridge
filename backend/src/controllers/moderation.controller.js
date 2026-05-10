import Report from "../models/Report.js";
import { sendError } from "../lib/apiResponse.js";
import { logger } from "../lib/logger.js";
import {
  buildPaginationMeta,
  countMatchingDocuments,
  getPagination,
} from "../lib/pagination.js";

export async function getModerationQueueController(req, res) {
  try {
    const { page, limit, skip } = getPagination(req.query, {
      defaultLimit: 20,
      maxLimit: 100,
    });
    const status = String(req.query.status || "open");
    const filter =
      status === "all"
        ? {}
        : { status: ["open", "reviewing", "actioned", "closed"].includes(status) ? status : "open" };

    const [reports, total] = await Promise.all([
      Report.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .populate("reporter", "fullName email profilePic")
        .populate("reported", "fullName email profilePic")
        .populate("message", "text createdAt")
        .lean(),
      countMatchingDocuments(Report, filter),
    ]);

    return res.status(200).json({
      success: true,
      reports,
      pagination: buildPaginationMeta({ page, limit, total }),
    });
  } catch (error) {
    logger.error("Error in getModerationQueueController", error);
    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}

export async function updateReportStatusController(req, res) {
  try {
    const status = String(req.body?.status || "").trim();
    if (!["open", "reviewing", "actioned", "closed"].includes(status)) {
      return sendError(res, 400, "Invalid moderation status.", {
        code: "INVALID_REPORT_STATUS",
      });
    }

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      {
        status,
        moderatorNote: String(req.body?.moderatorNote || "").trim(),
      },
      { new: true },
    )
      .populate("reporter", "fullName email profilePic")
      .populate("reported", "fullName email profilePic")
      .populate("message", "text createdAt");

    if (!report) {
      return sendError(res, 404, "Report not found.", {
        code: "REPORT_NOT_FOUND",
      });
    }

    return res.status(200).json({ success: true, report });
  } catch (error) {
    logger.error("Error in updateReportStatusController", error);
    return sendError(res, 500, "Internal Server Error.", {
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}
