import { describe, expect, it } from "vitest";
import { authErrorMessage } from "@/components/resident/AuthForm";

describe("authErrorMessage", () => {
  it("explains Supabase auth rate limits", () => {
    expect(authErrorMessage({ code: "over_request_rate_limit", status: 429 }))
      .toBe("Too many attempts. Please wait a few minutes and try again.");
  });

  it("does not reveal whether an account exists", () => {
    expect(authErrorMessage({ code: "invalid_credentials", status: 400 })).toBe(
      "The email or password is incorrect."
    );
  });

  it("uses a clear fallback for sign-in failures", () => {
    expect(authErrorMessage({ code: "unexpected_failure", status: 500 })).toBe(
      "Could not sign in. Please try again."
    );
  });
});
