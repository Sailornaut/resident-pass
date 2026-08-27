import { describe, it, expect } from "vitest";
import { effectiveStatus, isCancellable } from "@/lib/parking-rules/status";

const NOW = new Date("2026-08-27T12:00:00Z");
const HOUR = 60 * 60 * 1000;

function pass(from: number, until: number, status = "active") {
  return {
    status: status as "active" | "scheduled" | "expired" | "revoked" | "cancelled",
    valid_from: new Date(NOW.getTime() + from * HOUR).toISOString(),
    valid_until: new Date(NOW.getTime() + until * HOUR).toISOString(),
  };
}

describe("effectiveStatus", () => {
  it("is active inside the validity window", () => {
    expect(effectiveStatus(pass(-1, 23), NOW)).toBe("active");
  });

  it("is not_yet_valid before the window starts", () => {
    expect(effectiveStatus(pass(2, 26), NOW)).toBe("not_yet_valid");
  });

  it("is expired after the window ends", () => {
    expect(effectiveStatus(pass(-48, -24), NOW)).toBe("expired");
  });

  it("is expired exactly at valid_until", () => {
    expect(effectiveStatus(pass(-24, 0), NOW)).toBe("expired");
  });

  it("revoked always wins, even inside the window", () => {
    expect(effectiveStatus(pass(-1, 23, "revoked"), NOW)).toBe("revoked");
  });

  it("cancelled always wins, even before the window", () => {
    expect(effectiveStatus(pass(2, 26, "cancelled"), NOW)).toBe("cancelled");
  });

  it("stale stored 'active' status still reads expired by time", () => {
    // DB says active but the clock has moved past valid_until
    expect(effectiveStatus(pass(-50, -2, "active"), NOW)).toBe("expired");
  });
});

describe("isCancellable", () => {
  it("allows cancelling an active pass when policy permits", () => {
    expect(isCancellable(pass(-1, 23), true, NOW)).toBe(true);
  });

  it("allows cancelling a future pass", () => {
    expect(isCancellable(pass(5, 29), true, NOW)).toBe(true);
  });

  it("blocks cancelling when policy forbids", () => {
    expect(isCancellable(pass(-1, 23), false, NOW)).toBe(false);
  });

  it("blocks cancelling an expired pass", () => {
    expect(isCancellable(pass(-48, -24), true, NOW)).toBe(false);
  });

  it("blocks cancelling a revoked pass", () => {
    expect(isCancellable(pass(-1, 23, "revoked"), true, NOW)).toBe(false);
  });
});
