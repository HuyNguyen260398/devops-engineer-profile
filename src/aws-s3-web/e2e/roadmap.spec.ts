import { expect, test, type Page } from "@playwright/test";

/** Rough perceived brightness of a computed `rgb()`/`rgba()` value, 0–1. */
function luma(color: string): number {
  const [r, g, b] = color.match(/[\d.]+/g)!.map(Number);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** The surfaces the roadmap paints itself, as opposed to the shared window chrome. */
function surfaceColors(page: Page) {
  return page.evaluate(() => {
    const read = (selector: string, property: string) =>
      getComputedStyle(document.querySelector(selector)!).getPropertyValue(property);

    return {
      viewport: read(".rm-viewport", "background-color"),
      stageLabel: read(".rm-stage-label", "background-color"),
      legend: read(".rm-legend", "background-color"),
      topicText: read(".rm-topic", "color"),
    };
  });
}

test("renders the flowchart with stage dividers, topics, subtopics, and a legend", async ({
  page,
}) => {
  await page.goto("/roadmap");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("DevOps Engineer Roadmap");

  for (const stage of ["Foundations", "Modern DevOps", "AI Layer", "Senior Impact"]) {
    await expect(page.locator(".rm-stage-label").filter({ hasText: stage })).toBeVisible();
  }

  expect(await page.locator(".rm-topic").count()).toBeGreaterThanOrEqual(20);
  expect(await page.locator(".rm-subtopic").count()).toBeGreaterThanOrEqual(100);
  await expect(page.locator(".rm-legend li")).toHaveCount(3);
  await expect(page.locator(".rm-wire")).not.toHaveCount(0);
});

test("opens a topic panel and drills into one of its subtopics", async ({ page }) => {
  await page.goto("/roadmap");

  await page.locator(".rm-topic").filter({ hasText: "Kubernetes" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Kubernetes" })).toBeVisible();

  await dialog.getByRole("button", { name: /^Helm/ }).click();
  await expect(dialog.getByRole("heading", { name: "Helm" })).toBeVisible();
  await expect(dialog.getByText("Branches off")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("opens a subtopic panel directly from its box on the canvas", async ({ page }) => {
  await page.goto("/roadmap");

  await page.locator(".rm-subtopic").filter({ hasText: "Argo CD" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Argo CD" })).toBeVisible();
});

test("opens a stage panel from its divider on the spine", async ({ page }) => {
  await page.goto("/roadmap");

  await page.locator(".rm-stage-label").filter({ hasText: "AI Layer" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "AI Layer" })).toBeVisible();
  await expect(dialog.getByText("Topics in this stage")).toBeVisible();
});

test("reveals experience annotations when the overlay is toggled", async ({ page }) => {
  await page.goto("/roadmap");

  const toggle = page.getByRole("button", { name: /my experience/i });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/Hands-on with \d+ of \d+ subtopics/i)).toBeVisible();
  await expect(page.locator(".rm-box-badge").first()).toBeVisible();
});

test("repaints the graph and its detail panel when the theme flips dark to light", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/roadmap");
  await expect(page.locator(".rm-topic").first()).toBeVisible();

  const dark = await surfaceColors(page);
  expect(luma(dark.viewport)).toBeLessThan(0.25);
  expect(luma(dark.stageLabel)).toBeLessThan(0.25);
  expect(luma(dark.topicText)).toBeGreaterThan(0.6);

  await page.getByRole("button", { name: /switch to light theme/i }).click();

  // The window chrome already themes via globals.css; the graph inside it has to
  // follow, or the panel reads as a black hole punched into a white page.
  const light = await surfaceColors(page);
  expect(luma(light.viewport)).toBeGreaterThan(0.75);
  expect(luma(light.stageLabel)).toBeGreaterThan(0.75);
  expect(luma(light.legend)).toBeGreaterThan(0.75);
  expect(luma(light.topicText)).toBeLessThan(0.3);

  await page.locator(".rm-topic").filter({ hasText: "Kubernetes" }).click();
  const panelText = await page
    .locator(".rm-panel-title")
    .evaluate((el) => getComputedStyle(el).color);
  expect(luma(panelText)).toBeLessThan(0.3);
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
