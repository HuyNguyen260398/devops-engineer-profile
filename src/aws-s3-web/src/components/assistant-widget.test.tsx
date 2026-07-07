import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import { AssistantWidget } from "./assistant-widget";

it("opens, answers a local suggestion, minimizes, and closes", async () => {
  const user = userEvent.setup();
  render(<AssistantWidget />);

  await user.click(screen.getByRole("button", { name: "Open sample assistant" }));
  expect(screen.getByText("Local demo — no data leaves this browser")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Show sample projects" }));
  expect(screen.getByText(/Cloud Control Plane/)).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Minimize sample assistant" }));
  await user.click(screen.getByRole("button", { name: "Restore sample assistant" }));
  await user.click(screen.getByRole("button", { name: "Close sample assistant" }));

  expect(screen.getByRole("button", { name: "Open sample assistant" })).toBeInTheDocument();
});
