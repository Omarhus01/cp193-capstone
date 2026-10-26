import { describe, expect, it } from "vitest";
import { feedbackFormUrl } from "./feedback";

describe("feedbackFormUrl", () => {
  it("returns the form's address", () => {
    expect(feedbackFormUrl("https://forms.gle/abc123")).toBe("https://forms.gle/abc123");
    expect(feedbackFormUrl("  https://example.com/form?x=1  ")).toBe(
      "https://example.com/form?x=1",
    );
  });

  it("is null while no form is set", () => {
    expect(feedbackFormUrl(undefined)).toBeNull();
    expect(feedbackFormUrl("")).toBeNull();
    expect(feedbackFormUrl("   ")).toBeNull();
  });

  it("is null for anything that isn't an http(s) URL", () => {
    expect(feedbackFormUrl("forms.gle/abc123")).toBeNull();
    expect(feedbackFormUrl("javascript:alert(1)")).toBeNull();
    expect(feedbackFormUrl("mailto:someone@example.com")).toBeNull();
  });
});
