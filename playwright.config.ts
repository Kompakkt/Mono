import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/",
  globalSetup: "./tests/util/global-setup",
  globalTeardown: "./tests/util/global-teardown",
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
