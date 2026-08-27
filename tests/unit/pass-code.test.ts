import { describe, it, expect } from "vitest";
import {
  generatePassCode,
  normalizePassCode,
  isValidPassCodeFormat,
} from "@/lib/qr/pass-code";

describe("generatePassCode", () => {
  it("produces the RP-XXXX-XXXX format", () => {
    for (let i = 0; i < 100; i++) {
      expect(generatePassCode()).toMatch(/^RP-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    }
  });

  it("avoids ambiguous characters (0, O, 1, I, L)", () => {
    for (let i = 0; i < 200; i++) {
      const body = generatePassCode().replace(/^RP-/, "").replace("-", "");
      expect(body).not.toMatch(/[01OIL]/);
    }
  });

  it("is non-sequential (unique across a batch)", () => {
    const codes = new Set(Array.from({ length: 1000 }, () => generatePassCode()));
    expect(codes.size).toBe(1000);
  });
});

describe("normalizePassCode", () => {
  it("uppercases and restores hyphens", () => {
    expect(normalizePassCode("rp7k4m9q2f")).toBe("RP-7K4M-9Q2F");
  });

  it("handles pasted codes with spaces", () => {
    expect(normalizePassCode("RP 7K4M 9Q2F")).toBe("RP-7K4M-9Q2F");
  });

  it("handles the bare 8-char body", () => {
    expect(normalizePassCode("7K4M9Q2F")).toBe("RP-7K4M-9Q2F");
  });
});

describe("isValidPassCodeFormat", () => {
  it("accepts a well-formed code", () => {
    expect(isValidPassCodeFormat("RP-7K4M-9Q2F")).toBe(true);
  });

  it("rejects malformed input", () => {
    expect(isValidPassCodeFormat("XX-1234-5678")).toBe(false);
    expect(isValidPassCodeFormat("RP-123-45678")).toBe(false);
    expect(isValidPassCodeFormat("'; DROP TABLE--")).toBe(false);
  });
});
