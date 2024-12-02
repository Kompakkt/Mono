import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./modules/tests/",
  globalSetup: "./modules/tests/util/global-setup",
  globalTeardown: "./modules/tests/util/global-teardown",
  projects: [
    {
      name: "auth-setup",
      testMatch: "auth.setup.ts",
      use: {
        ignoreHTTPSErrors: true,
      },
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ignoreHTTPSErrors: true,
      },
      dependencies: ["auth-setup"],
    },
  ],
});
