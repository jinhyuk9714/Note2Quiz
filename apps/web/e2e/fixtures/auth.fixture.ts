/* eslint-disable react-hooks/rules-of-hooks */
import { test as base, type Page } from "@playwright/test";

const API = "http://localhost:8000";

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`;
}

export interface TestUser {
  email: string;
  password: string;
  displayName: string;
}

interface AuthFixtures {
  authenticatedPage: Page;
  testUser: TestUser;
}

export const test = base.extend<AuthFixtures>({
  testUser: async ({}, use) => {
    await use({
      email: uniqueEmail(),
      password: "TestPass123!",
      displayName: `E2E User`,
    });
  },

  authenticatedPage: async ({ page, testUser }, use) => {
    // Create user via API (faster than going through UI)
    const res = await page.request.post(`${API}/api/auth/signup`, {
      data: {
        email: testUser.email,
        display_name: testUser.displayName,
        password: testUser.password,
      },
    });
    const { access_token } = (await res.json()) as { access_token: string };

    // Inject token into localStorage
    await page.goto("/login");
    await page.evaluate(
      (token: string) => localStorage.setItem("quiznote_token", token),
      access_token,
    );

    // Navigate to dashboard and confirm auth
    await page.goto("/");
    await page.waitForSelector("text=안녕하세요");

    await use(page);
  },
});

export { expect } from "@playwright/test";
