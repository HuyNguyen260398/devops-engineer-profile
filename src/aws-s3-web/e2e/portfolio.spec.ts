import { expect, test } from "@playwright/test";

test("navigates sections and completes local interactions", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Sample Developer");
  await expect(page.locator("#main-content")).toHaveAttribute("data-motion-ready", "true");

  await page.getByRole("button", { name: "Projects" }).first().click();
  await expect(page.locator("#projects")).toBeInViewport();

  await page.getByRole("button", { name: "Open sample assistant" }).click();
  await expect(page.getByText("Local demo — no data leaves this browser")).toBeVisible();
});

test("mounts the skills canvas without deprecated Three.js APIs", async ({ page }) => {
  const deprecationWarnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning" && message.text().includes("THREE.Clock")) {
      deprecationWarnings.push(message.text());
    }
  });

  await page.goto("/");
  await expect(page.locator("#skills canvas")).toBeAttached();
  await page.waitForTimeout(250);

  expect(deprecationWarnings).toEqual([]);
});

test("fits a mobile viewport without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
  await expect(page.getByRole("navigation", { name: "Mobile portfolio sections" })).toBeVisible();
});

test("hydrates a saved dark theme without a React mismatch", async ({ page }) => {
  const hydrationErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("Hydration failed")) {
      hydrationErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    if (error.message.includes("Hydration failed")) hydrationErrors.push(error.message);
  });
  await page.addInitScript(() => window.localStorage.setItem("portfolio-theme", "dark"));

  await page.goto("/");
  await page.getByRole("status", { name: "Portfolio boot sequence" }).waitFor({ state: "detached" });

  await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();
  await expect(page.locator(".theme-toggle svg")).toHaveClass(/lucide-sun/);
  expect(hydrationErrors).toEqual([]);
});
