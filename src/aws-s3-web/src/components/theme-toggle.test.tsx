import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it } from "vitest";

import { ThemeToggle } from "./theme-toggle";

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

it("uses the system theme until the visitor chooses a preference", async () => {
  render(<ThemeToggle />);

  await waitFor(() => expect(document.documentElement.dataset.theme).toBe("light"));
  expect(screen.getByRole("button", { name: "Switch to dark theme" })).toBeInTheDocument();
});

it("persists an explicit theme choice", async () => {
  window.localStorage.setItem("portfolio-theme", "dark");
  const user = userEvent.setup();

  render(<ThemeToggle />);

  const toggle = await screen.findByRole("button", { name: "Switch to light theme" });
  expect(document.documentElement.dataset.theme).toBe("dark");

  await user.click(toggle);

  expect(document.documentElement.dataset.theme).toBe("light");
  expect(window.localStorage.getItem("portfolio-theme")).toBe("light");
});
