import { describe, expect, it } from "vitest";
import {
  serializeModerationActionMessage,
  serializeModerationQueue,
  serializeReportStatusUpdate,
  serializeReportSubmitted,
} from "./moderation.dto.js";

describe("moderation DTOs", () => {
  it("serializes report queue and status updates", () => {
    const report = { _id: "report-1", status: "open" };

    expect(
      serializeModerationQueue({
        reports: [report],
        page: 1,
        limit: 20,
        total: 1,
      }),
    ).toMatchObject({
      success: true,
      reports: [report],
      pagination: { total: 1 },
    });
    expect(serializeReportStatusUpdate(report)).toEqual({
      success: true,
      report,
    });
  });

  it("serializes report submission and action messages", () => {
    expect(serializeReportSubmitted({ _id: "report-1" })).toEqual({
      success: true,
      reportId: "report-1",
      message: "Report submitted successfully.",
    });
    expect(serializeModerationActionMessage("Done.")).toEqual({
      success: true,
      message: "Done.",
    });
  });
});
