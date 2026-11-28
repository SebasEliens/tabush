import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";
import { test } from "./fixtures";

const { Given, When, Then } = createBdd(test);

const LAYERS = ["protected_areas", "indigenous_lands", "rural_properties"];

// Provenance files decide whether a layer is "built"; its tiles are not needed here.
async function stubLayers(page: import("@playwright/test").Page, built: string[]) {
  await page.route("**/tiles/*", (route) => {
    const file = new URL(route.request().url()).pathname.split("/").pop()!;
    const id = file.replace(/\.json$/, "");
    if (file.endsWith(".json") && built.includes(id)) {
      return route.fulfill({
        json: { layer: id, source: "SICAR public WFS", snapshot_date: "2026-11-28", features: 3, flags: { none: 3 } },
      });
    }
    return route.fulfill({ status: 404, body: "" });
  });
}

Given("no land tenure layer is built", async ({ page }) => stubLayers(page, []));
Given("the {string} layer is built", async ({ page }, id: string) => {
  expect(LAYERS).toContain(id);
  await stubLayers(page, [id]);
});

When("I open the map", async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/");
});

Then("I see the fake portfolio", async ({ page }) => {
  await expect(page.getByRole("complementary", { name: "Properties" })).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Colour properties by" })).toBeVisible();
});
Then("I do not see the fake portfolio", async ({ page }) => {
  await expect(page.getByRole("region", { name: "Land tenure, public data" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Properties" })).toHaveCount(0);
  await expect(page.getByRole("radiogroup", { name: "Colour properties by" })).toHaveCount(0);
});
Then("I see the {string} badge", async ({ page }, text: string) => {
  await expect(page.locator(".topbar").getByText(text)).toBeVisible();
});
Then("I do not see the {string} badge", async ({ page }, text: string) => {
  await expect(page.locator(".topbar").getByText(text)).toHaveCount(0);
});

const panelHead = (page: import("@playwright/test").Page, title: string) => page.getByRole("button", { name: title });

Then("I see the panel {string}", async ({ page }, title: string) => {
  await expect(panelHead(page, title)).toHaveAttribute("aria-expanded", "true");
});
When("I fold the panel {string}", async ({ page }, title: string) => {
  await panelHead(page, title).click();
});
Then("the panel {string} shows only its title", async ({ page }, title: string) => {
  await expect(panelHead(page, title)).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("switch")).toHaveCount(0);
});
When("I press {string}", async ({ page }, key: string) => {
  await page.locator("body").press(key.toLowerCase());
});
Then("I see no panels on the map", async ({ page }) => {
  await expect(page.locator(".map-overlay .map-card")).toHaveCount(0);
});
When("I click {string}", async ({ page }, name: string) => {
  await page.getByRole("button", { name }).click();
});
