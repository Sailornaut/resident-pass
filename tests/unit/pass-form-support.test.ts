import { describe, expect, it } from "vitest";
import {
  getPassDateConstraints,
  ruleViolationsToFormErrors,
} from "@/lib/parking-rules/form-support";

describe("pass form support", () => {
  it("derives date constraints from community-configurable rules", () => {
    const constraints = getPassDateConstraints(
      "2026-09-01T10:00",
      72,
      14,
      new Date(2026, 8, 1, 9, 0)
    );

    expect(constraints.startMax).toBe("2026-09-15T09:00");
    expect(constraints.endMin).toBe("2026-09-01T10:30");
    expect(constraints.endMax).toBe("2026-09-04T10:00");
  });

  it("identifies the correct fields for date and plate rule failures", () => {
    expect(
      ruleViolationsToFormErrors([
        { code: "DURATION_EXCEEDED", message: "Duration is too long." },
        { code: "ADVANCE_WINDOW_EXCEEDED", message: "Start is too far away." },
        { code: "DUPLICATE_OVERLAPPING_PASS", message: "Plate overlaps." },
        { code: "MONTHLY_LIMIT_REACHED", message: "Monthly limit reached." },
      ])
    ).toEqual({
      valid_until: "Duration is too long.",
      valid_from: "Start is too far away.",
      plate: "Plate overlaps.",
      _form: "Monthly limit reached.",
    });
  });
});
