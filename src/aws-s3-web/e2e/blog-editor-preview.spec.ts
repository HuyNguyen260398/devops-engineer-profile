import { expect, test } from "@playwright/test";

test("editor preview toggle renders the live content read-only", async ({ page }) => {
  await page.goto("/blogs/editor");

  await page.getByPlaceholder("Post title").fill("My Preview Title");

  await page.getByRole("button", { name: "preview", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "My Preview Title" })).toBeVisible();
  // The editing toolbar is hidden while previewing.
  await expect(page.getByRole("button", { name: "B", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "edit", exact: true }).click();
  await expect(page.getByRole("button", { name: "B", exact: true })).toBeVisible();
});
