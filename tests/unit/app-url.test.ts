import { afterEach, describe, expect, it } from "vitest";
import { configuredAppUrl, normalizeAppUrl } from "@/lib/app-url";

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  if (originalAppUrl === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  }
});

describe("normalizeAppUrl", () => {
  it("adds HTTPS to a production hostname", () => {
    expect(normalizeAppUrl("residentpass.net/")).toBe("https://residentpass.net");
  });

  it("preserves an explicit absolute origin", () => {
    expect(normalizeAppUrl("https://www.residentpass.net/")).toBe(
      "https://www.residentpass.net"
    );
  });

  it("uses HTTP for a bare localhost address", () => {
    expect(normalizeAppUrl("localhost:3000/")).toBe("http://localhost:3000");
  });
});

describe("configuredAppUrl", () => {
  it("normalizes a hostname-only environment value", () => {
    process.env.NEXT_PUBLIC_APP_URL = " residentpass.net/ ";
    expect(configuredAppUrl()).toBe("https://residentpass.net");
  });

  it("uses and normalizes the supplied fallback", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(configuredAppUrl("https://preview.example.com/")).toBe(
      "https://preview.example.com"
    );
  });
});
