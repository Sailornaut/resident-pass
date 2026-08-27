import { describe, it, expect } from "vitest";
import { evaluatePassRequest, type RuleContext, type PassRequest } from "@/lib/parking-rules";
import type { Community, Membership, ParkingPass, ParkingRuleSet } from "@/lib/db/types";

const NOW = new Date("2026-08-27T12:00:00Z");
const HOUR = 60 * 60 * 1000;

const community: Community = {
  id: "comm-1",
  management_company_id: null,
  name: "Oak Ridge",
  slug: "oak-ridge",
  timezone: "America/New_York",
  status: "active",
  created_at: "",
  updated_at: "",
};

const rules: ParkingRuleSet = {
  id: "rules-1",
  community_id: "comm-1",
  max_active_passes: 2,
  max_duration_hours: 72,
  monthly_limit: 8,
  advance_window_days: 14,
  allow_resident_cancel: true,
  created_at: "",
  updated_at: "",
};

const membership: Membership = {
  id: "mem-1",
  user_id: "user-1",
  community_id: "comm-1",
  unit_id: "unit-1",
  role: "resident",
  status: "active",
  created_at: "",
  updated_at: "",
};

function makeRequest(overrides: Partial<PassRequest> = {}): PassRequest {
  return {
    unit_id: "unit-1",
    plate: "ABC1234",
    valid_from: new Date(NOW.getTime() + 1 * HOUR),
    valid_until: new Date(NOW.getTime() + 25 * HOUR),
    now: NOW,
    ...overrides,
  };
}

function makeContext(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    memberships: [membership],
    community,
    rules,
    unitActivePasses: [],
    monthlyIssuedCount: 0,
    samePlatePasses: [],
    ...overrides,
  };
}

function makePass(overrides: Partial<ParkingPass> = {}): ParkingPass {
  return {
    id: "pass-x",
    public_code: "RP-TEST-0001",
    community_id: "comm-1",
    unit_id: "unit-1",
    requester_user_id: "user-1",
    plate: "ABC1234",
    plate_state: "NC",
    vehicle_make: null,
    vehicle_color: null,
    guest_name: null,
    note: null,
    valid_from: new Date(NOW.getTime() - 2 * HOUR).toISOString(),
    valid_until: new Date(NOW.getTime() + 22 * HOUR).toISOString(),
    status: "active",
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("evaluatePassRequest", () => {
  it("allows a valid request", () => {
    const result = evaluatePassRequest(makeRequest(), makeContext());
    expect(result.allowed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("rejects when requester has no active membership", () => {
    const result = evaluatePassRequest(
      makeRequest(),
      makeContext({ memberships: [{ ...membership, status: "inactive" }] })
    );
    expect(result.allowed).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain("NO_ACTIVE_MEMBERSHIP");
  });

  it("rejects a unit the requester is not associated with", () => {
    const result = evaluatePassRequest(
      makeRequest({ unit_id: "someone-elses-unit" }),
      makeContext()
    );
    expect(result.allowed).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain("UNIT_NOT_AUTHORIZED");
  });

  it("rejects when community is inactive", () => {
    const result = evaluatePassRequest(
      makeRequest(),
      makeContext({ community: { ...community, status: "suspended" } })
    );
    expect(result.allowed).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain("COMMUNITY_INACTIVE");
  });

  it("rejects an inverted date range", () => {
    const result = evaluatePassRequest(
      makeRequest({
        valid_from: new Date(NOW.getTime() + 10 * HOUR),
        valid_until: new Date(NOW.getTime() + 5 * HOUR),
      }),
      makeContext()
    );
    expect(result.allowed).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain("INVALID_INTERVAL");
  });

  it("rejects a pass exceeding the max duration", () => {
    const result = evaluatePassRequest(
      makeRequest({
        valid_until: new Date(NOW.getTime() + 100 * HOUR),
      }),
      makeContext()
    );
    expect(result.allowed).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain("DURATION_EXCEEDED");
  });

  it("rejects a start beyond the advance window", () => {
    const result = evaluatePassRequest(
      makeRequest({
        valid_from: new Date(NOW.getTime() + 20 * 24 * HOUR),
        valid_until: new Date(NOW.getTime() + 21 * 24 * HOUR),
      }),
      makeContext()
    );
    expect(result.allowed).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain("ADVANCE_WINDOW_EXCEEDED");
  });

  it("rejects when the unit is at its active-pass limit", () => {
    const result = evaluatePassRequest(
      makeRequest({ plate: "NEW9999" }),
      makeContext({
        unitActivePasses: [
          makePass({ id: "p1", plate: "AAA1111" }),
          makePass({ id: "p2", plate: "BBB2222" }),
        ],
      })
    );
    expect(result.allowed).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain("ACTIVE_LIMIT_REACHED");
  });

  it("rejects when the monthly limit is exhausted", () => {
    const result = evaluatePassRequest(
      makeRequest(),
      makeContext({ monthlyIssuedCount: 8 })
    );
    expect(result.allowed).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain("MONTHLY_LIMIT_REACHED");
  });

  it("allows an administrator-approved resident allowance above the base limit", () => {
    const result = evaluatePassRequest(
      makeRequest(),
      makeContext({ monthlyIssuedCount: 8, monthlyAllowanceBonus: 1 })
    );
    expect(result.allowed).toBe(true);
    expect(result.violations.map((v) => v.code)).not.toContain("MONTHLY_LIMIT_REACHED");
  });

  it("rejects a duplicate overlapping pass for the same plate", () => {
    const result = evaluatePassRequest(
      makeRequest(),
      makeContext({ samePlatePasses: [makePass()] })
    );
    expect(result.allowed).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain("DUPLICATE_OVERLAPPING_PASS");
  });

  it("allows the same plate when windows do not overlap", () => {
    const result = evaluatePassRequest(
      makeRequest({
        valid_from: new Date(NOW.getTime() + 30 * HOUR),
        valid_until: new Date(NOW.getTime() + 40 * HOUR),
      }),
      makeContext({
        samePlatePasses: [
          makePass({
            valid_from: new Date(NOW.getTime() - 10 * HOUR).toISOString(),
            valid_until: new Date(NOW.getTime() + 2 * HOUR).toISOString(),
          }),
        ],
      })
    );
    expect(result.allowed).toBe(true);
  });

  it("ignores revoked/cancelled passes for the overlap check", () => {
    const result = evaluatePassRequest(
      makeRequest(),
      makeContext({
        samePlatePasses: [
          makePass({ status: "revoked" }),
          makePass({ status: "cancelled" }),
        ],
      })
    );
    expect(result.allowed).toBe(true);
  });
});
