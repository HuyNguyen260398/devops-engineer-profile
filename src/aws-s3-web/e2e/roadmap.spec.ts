import { expect, test } from "@playwright/test";

test("renders every stage and opens a node detail panel", async ({ page }) => {
  await page.goto("/roadmap");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("DevOps Engineer Roadmap");

  for (const stage of ["Foundations", "Modern DevOps", "AI Layer", "Senior Impact"]) {
    await expect(page.getByRole("heading", { name: stage })).toBeVisible();
  }

  await page.getByRole("button", { name: /Kubernetes/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Kubernetes" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("reveals experience annotations when the overlay is toggled", async ({ page }) => {
  await page.goto("/roadmap");

  const toggle = page.getByRole("button", { name: /my experience/i });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Production experience").first()).toBeVisible();
});

test("navigates to a stage from the rail", async ({ page }) => {
  await page.goto("/roadmap");

  await page.getByRole("navigation", { name: /roadmap stages/i })
    .getByRole("button", { name: /AI Layer/ })
    .click();

  await expect(page.locator("#ai-layer")).toBeInViewport();
});

test("fits a mobile viewport without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/roadmap");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});
