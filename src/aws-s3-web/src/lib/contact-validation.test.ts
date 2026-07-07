import { describe, expect, it } from "vitest";

import { validateContact } from "./contact-validation";

describe("validateContact", () => {
  it("returns field errors for empty required values and malformed email", () => {
    expect(
      validateContact({ name: "", email: "bad", subject: "", message: "" }),
    ).toEqual({
      name: "Enter your name.",
      email: "Enter a valid email address.",
      message: "Enter a message of at least 10 characters.",
    });
  });

  it("accepts a complete demo inquiry", () => {
    expect(
      validateContact({
        name: "Sample Visitor",
        email: "visitor@example.com",
        subject: "Example project",
        message: "This is a complete sample inquiry.",
      }),
    ).toEqual({});
  });
});
