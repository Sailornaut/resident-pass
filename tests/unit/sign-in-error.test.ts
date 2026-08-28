import { describe, expect, it } from "vitest";
import { signInErrorMessage } from "@/components/resident/SignInForm";

describe("signInErrorMessage", () => {
  it("explains Supabase email rate limits", () => {
    expect(
      signInErrorMessage({ code: "over_email_send_rate_limit", status: 429 })
    ).toBe("Too many sign-in emails were requested. Please wait and try again later.");
  });

  it("does not blame the address for an unknown provider error", () => {
    expect(signInErrorMessage({ code: "unexpected_failure", status: 500 })).toBe(
      "Could not send the sign-in link. Please try again later."
    );
  });
});
