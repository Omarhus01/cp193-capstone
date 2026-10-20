import { describe, expect, it } from "vitest";
import { readCredentials, validateCredentials } from "./validation";

describe("validateCredentials", () => {
  it("accepts a valid email and a long enough password", () => {
    expect(validateCredentials({ email: "learner@example.com", password: "12345678" })).toBeNull();
  });

  it("rejects an invalid email", () => {
    expect(validateCredentials({ email: "learner", password: "12345678" })).toBe("invalidEmail");
    expect(validateCredentials({ email: "", password: "12345678" })).toBe("invalidEmail");
  });

  it("rejects a short password", () => {
    expect(validateCredentials({ email: "learner@example.com", password: "1234567" })).toBe(
      "passwordTooShort",
    );
  });
});

describe("readCredentials", () => {
  it("trims the email but not the password", () => {
    const formData = new FormData();
    formData.set("email", "  learner@example.com ");
    formData.set("password", " secret  ");
    expect(readCredentials(formData)).toEqual({
      email: "learner@example.com",
      password: " secret  ",
    });
  });

  it("returns empty strings for missing fields", () => {
    expect(readCredentials(new FormData())).toEqual({ email: "", password: "" });
  });
});
