import { buildPaginationMeta } from "../../core/http/pagination.js";

export const serializeModerationQueue = ({ reports, page, limit, total }) => ({
  success: true,
  reports,
  pagination: buildPaginationMeta({ page, limit, total }),
});

export const serializeReportStatusUpdate = (report) => ({
  success: true,
  report,
});

export const serializeReportSubmitted = (report) => ({
  success: true,
  reportId: report._id,
  message: "Report submitted successfully.",
});

export const serializeModerationActionMessage = (message) => ({
  success: true,
  message,
});
