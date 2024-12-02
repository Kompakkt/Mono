import { test, expect } from "@playwright/test";
import { getMockData } from "./util/mock-data";

test.use({
  ignoreHTTPSErrors: true,
});

const MockData = await getMockData();

test("test", async ({ page }) => {
  await page.goto("https://localhost:4200/home?locale=en");
  await expect(page.getByRole("button", { name: "New Object" })).toBeVisible();
  await page.getByRole("button", { name: "New Object" }).click();
  await expect(
    page.getByRole("button", { name: "Choose files" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Choose files" }).click();
  await page
    .getByRole("button", { name: "Choose files" })
    .setInputFiles("kompakkt.glb");
  await expect(
    page.getByRole("button", { name: "Begin upload" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Begin upload" }).click();
  await expect(page.getByRole("button", { name: "Next" })).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(
    page
      .locator("#viewer-frame")
      .contentFrame()
      .getByText("Save mesh settings"),
  ).toBeVisible();
  await expect(
    page
      .locator("#viewer-frame")
      .contentFrame()
      .getByText("Save mesh settings"),
  ).toBeVisible();
  await expect(
    page
      .locator("#viewer-frame")
      .contentFrame()
      .getByText("Save mesh settings"),
  ).toBeVisible();
  await page
    .locator("#viewer-frame")
    .contentFrame()
    .getByText("Save mesh settings")
    .click();
  await page
    .locator("#viewer-frame")
    .contentFrame()
    .getByText("Yes, finalize")
    .click();
  await page
    .locator("#viewer-frame")
    .contentFrame()
    .getByText("Save background and lights")
    .click();
  await page
    .locator("#viewer-frame")
    .contentFrame()
    .getByText("Save preview and initial")
    .click();
  await page
    .locator("#viewer-frame")
    .contentFrame()
    .getByText("Save", { exact: true })
    .click();
  await expect(page.getByPlaceholder("Enter a title")).toBeVisible();
  await page.getByPlaceholder("Enter a title").click();
  await page.getByPlaceholder("Enter a title").fill("Test Cube");
  await page.getByPlaceholder("Enter a description").click();
  await page
    .getByPlaceholder("Enter a description")
    .fill("Cube for testing Kompakkt");
  await page.getByRole("button", { name: "Licence" }).click();
  await page.getByLabel("Attribution 4.0 International").check();
  await page.getByRole("button", { name: "Persons" }).click();
  await page
    .getByRole("button", { name: "Persons" })
    .getByRole("button")
    .click();
  await page.getByLabel("Prename").click();
  await page.getByLabel("Prename").fill(MockData.account.prename);
  await page.getByLabel("Name", { exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill(MockData.account.surname);
  await page.getByRole("button", { name: "Role selection" }).click();
  await page.getByLabel("Rightsowner").check();
  await page.getByLabel("Contact Person").check();
  await page.getByRole("button", { name: "Contact" }).click();
  await page.getByPlaceholder("Enter the mail address of the").click();
  await page
    .getByPlaceholder("Enter the mail address of the")
    .fill(MockData.account.email);
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("button", { name: "Finish!" })).toBeVisible();
  await page.getByRole("button", { name: "Finish!" }).click();
  await expect(page.getByRole("button", { name: "Publish!" })).toBeVisible();
  await page.getByRole("button", { name: "Publish!" }).click();
});
