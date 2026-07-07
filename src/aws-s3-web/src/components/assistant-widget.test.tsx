import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import { AssistantWidget } from "./assistant-widget";

it("opens, answers a local suggestion, minimizes, and closes", async () => {
  const user = userEvent.setup();
  render(<AssistantWidget />);

  await user.click(screen.getByRole("button", { name: "Open assistant" }));
  expect(screen.getByText("Local demo — no data leaves this browser")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Show pinned projects" }));
  expect(screen.getByText(/devops-engineer-profile/)).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Minimize assistant" }));
  await user.click(screen.getByRole("button", { name: "Restore assistant" }));
  await user.click(screen.getByRole("button", { name: "Close assistant" }));

  expect(screen.getByRole("button", { name: "Open assistant" })).toBeInTheDocument();
});
