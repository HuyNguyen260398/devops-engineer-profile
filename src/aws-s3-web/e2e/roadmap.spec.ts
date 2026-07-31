import { expect, test } from "@playwright/test";

test("renders the flowchart with a box per stage and a legend", async ({ page }) => {
  await page.goto("/roadmap");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("DevOps Engineer Roadmap");

  for (const stage of ["Foundations", "Modern DevOps", "AI Layer", "Senior Impact"]) {
    await expect(page.locator(".rm-topic").filter({ hasText: stage })).toBeVisible();
  }

  await expect(page.locator(".rm-legend li")).toHaveCount(3);
  await expect(page.locator(".rm-wire")).not.toHaveCount(0);
});

test("opens a node detail panel from a subtopic box", async ({ page }) => {
  await page.goto("/roadmap");

  await page.locator(".rm-subtopic").filter({ hasText: "Kubernetes" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Kubernetes" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("opens a stage panel from a topic box and drills into a node", async ({ page }) => {
  await page.goto("/roadmap");

  await page.locator(".rm-topic").filter({ hasText: "AI Layer" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "AI Layer" })).toBeVisible();

  await dialog.getByRole("button", { name: /AIOps/ }).click();
  await expect(dialog.getByRole("heading", { name: "AIOps" })).toBeVisible();
});

test("reveals experience annotations when the overlay is toggled", async ({ page }) => {
  await page.goto("/roadmap");

  const toggle = page.getByRole("button", { name: /my experience/i });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/Hands-on with \d+ of \d+ topics/i)).toBeVisible();
  await expect(page.locator(".rm-box-badge").first()).toBeVisible();
});

test("scales the canvas to fit a mobile viewport without page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/roadmap");

  // The graph scales down inside its own scroll container, so the document
  // itself must never scroll sideways.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);

  const scaled = await page.locator(".rm-canvas").evaluate((el) => getComputedStyle(el).transform);
  expect(scaled).not.toBe("none");
});
