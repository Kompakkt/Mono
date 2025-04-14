import { test as setup, expect } from "@playwright/test";
import { getMockData } from "./mock-data";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const authFile = join(__dirname, ".auth.json");
const MockData = await getMockData();

setup("Authentication setup", async ({ page }) => {
  await page.goto("http://localhost:8080/home?locale=en");
  await page.getByText("Register").click();
  await page.getByLabel("E-Mail address").click();
  await page.getByLabel("E-Mail address").fill(MockData.account.email);
  await page.getByLabel("E-Mail address").press("Tab");
  await page.getByLabel("Given name").fill(MockData.account.prename);
  await page.getByLabel("Given name").press("Tab");
  await page.getByLabel("Last name").fill(MockData.account.surname);
  await page.getByLabel("Last name").press("Tab");
  await page.getByLabel("Username").fill(MockData.account.username);
  await page.getByLabel("Username").press("Tab");
  await page
    .getByLabel("Password", { exact: true })
    .fill(MockData.account.password);
  await page.getByLabel("Password", { exact: true }).press("Tab");
  await page.getByLabel("Repeat password").fill(MockData.account.password);
  await (await page.$("div.register-btn"))?.click();
  await expect(
    page.locator("button").filter({ hasText: "account_circle" }),
  ).toBeVisible();

  await page.context().storageState({ path: authFile });
});
