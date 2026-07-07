import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import { ContactSection } from "./contact-section";

it("validates locally and reports a simulated success", async () => {
  const user = userEvent.setup();
  render(<ContactSection />);

  await user.click(screen.getByRole("button", { name: "Send demo message" }));
  expect(screen.getByText("Enter your name.")).toBeInTheDocument();

  await user.type(screen.getByLabelText("Name"), "Sample Visitor");
  await user.type(screen.getByLabelText("Email"), "visitor@example.com");
  await user.type(screen.getByLabelText("Message"), "A complete sample inquiry.");
  await user.click(screen.getByRole("button", { name: "Send demo message" }));

  expect(await screen.findByText(/Demo message accepted locally/)).toBeInTheDocument();
});

