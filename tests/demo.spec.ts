import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("four tabs, date filters, leaderboard and channel feed", async ({
  page,
}) => {
  await page.goto("/demo");
  await expect(
    page.getByRole("heading", { name: "Your team, in the spotlight." }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }).getByRole("link"),
  ).toHaveText(["Home", "Team", "Rewards", "AI"]);
  await expect(page.locator(".v1-post")).toHaveCount(6);
  await page
    .getByRole("button", { name: /See more of/ })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: /See less of/ }).first(),
  ).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "Show more posts" }).click();
  await expect(page.locator(".v1-post")).toHaveCount(12);
  await page.getByLabel("Feed channel").selectOption("x");
  await expect(page.locator(".v1-post")).toHaveCount(6);
  await page.getByLabel("From", { exact: true }).fill("2026-08-01");
  await page.getByRole("button", { name: "Apply dates" }).click();
  await page.getByLabel("Feed channel").selectOption("all");
  await expect(page.locator(".v1-post")).toHaveCount(6);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
test("team search and sample daily routine", async ({ page }) => {
  await page.goto("/demo/team");
  await page.getByLabel("Find a teammate").fill("Sarah");
  await expect(
    page.getByRole("list", { name: "Team members" }).getByRole("listitem"),
  ).toHaveCount(1);
  await page.getByRole("link", { name: "AI", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Today’s post" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Approve post", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm approval", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Copy approved post", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Preview as").selectOption("engineering");
  await expect(page.getByText(/technical/).first()).toBeVisible();
  await page.getByRole("button", { name: "My Profile", exact: true }).click();
  await page
    .getByRole("button", { name: "Pause preparation", exact: true })
    .click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your content is paused." }),
  ).toBeVisible();
});
test("sample reward creation", async ({ page }) => {
  await page.goto("/demo/rewards");
  await expect(
    page.getByRole("heading", { name: "$1,000", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "MacBook Pro", exact: true }),
  ).toBeVisible();
  const reward = page.locator(".reward-row").first();
  await expect(reward.getByRole("listitem")).toHaveCount(3);
  await reward.getByText("See all 12 participants").click();
  await expect(reward.getByRole("listitem")).toHaveCount(12);
  await page.getByRole("button", { name: "Create sample reward" }).click();
  await page.getByLabel("Title", { exact: true }).fill("October creativity");
  await page.getByLabel("What’s the prize?").fill("A team lunch");
  await page.getByRole("button", { name: "Save sample reward" }).click();
  await expect(
    page.getByRole("heading", { name: "October creativity" }),
  ).toBeVisible();
});
test("four tabs are accessible in dark mode", async ({ page }) => {
  for (const route of ["", "team", "rewards", "ai"]) {
    await page.goto("/demo/" + route);
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
    });
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
      route,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      route,
    ).toBe(true);
  }
});
