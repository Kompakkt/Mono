import { test, expect } from "@playwright/test";
import { generateMockData, getMockData } from "./util/mock-data";

const MockData = await getMockData();

test.describe.parallel("Authentication", () => {
  test("Registration (without global mock data)", async ({ page }) => {
    const { account } = generateMockData(Math.round(Math.random() * 1_000_000));
    await page.goto("https://localhost:4200/home?locale=en");
    await page.getByText("Register").click();
    await page.getByLabel("E-Mail address").click();
    await page.getByLabel("E-Mail address").fill(account.email);
    await page.getByLabel("E-Mail address").press("Tab");
    await page.getByLabel("Given name").fill(account.prename);
    await page.getByLabel("Given name").press("Tab");
    await page.getByLabel("Last name").fill(account.surname);
    await page.getByLabel("Last name").press("Tab");
    await page.getByLabel("Username").fill(account.username);
    await page.getByLabel("Username").press("Tab");
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByLabel("Password", { exact: true }).press("Tab");
    await page.getByLabel("Repeat password").fill(account.password);
    await page.getByRole("button", { name: "Create new account" }).click();
    await expect(
      page.locator("button").filter({ hasText: "account_circle" }),
    ).toBeVisible();
  });

  test("Login & Logout (using mock data from auth setup)", async ({ page }) => {
    await page.goto("https://localhost:4200/home?locale=en");

    const isLoggedIn = await page
      .locator("button")
      .filter({ hasText: "account_circle" })
      .isVisible();

    if (!isLoggedIn) {
      await page.getByText("Login").click();
      await page
        .getByLabel("Enter your username")
        .fill(MockData.account.username);
      await page.getByLabel("Enter your username").press("Tab");
      await page
        .getByLabel("Enter your password")
        .fill(MockData.account.password);
      await page.getByRole("button", { name: "Login" }).click();

      await expect(
        page.locator("button").filter({ hasText: "account_circle" }),
      ).toBeVisible();
    }

    await page.locator("button").filter({ hasText: "account_circle" }).click();
    await page.getByRole("menuitem", { name: "Logout" }).click();

    await expect(page.getByText("Login")).toBeVisible();
  });
});
