import { test, expect } from "@playwright/test";

const API = "http://localhost:8000";

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`;
}

test.describe("Auth", () => {
  test("new user can sign up and lands on dashboard", async ({ page }) => {
    const email = uniqueEmail();

    await page.goto("/signup");
    await page.fill("#displayName", "Test User");
    await page.fill("#email", email);
    await page.fill("#password", "SecurePass1!");
    await page.getByRole("button", { name: "회원가입" }).click();

    await page.waitForURL("/", { timeout: 15_000 });
    await expect(page.getByText("안녕하세요")).toBeVisible();
  });

  test("existing user can log in", async ({ page, request }) => {
    const email = uniqueEmail();
    // Create user via API
    await request.post(`${API}/api/auth/signup`, {
      data: {
        email,
        display_name: "Login User",
        password: "SecurePass1!",
      },
    });

    await page.goto("/login");
    await page.fill("#email", email);
    await page.fill("#password", "SecurePass1!");
    await page.getByRole("button", { name: "시작하기" }).click();

    await page.waitForURL("/", { timeout: 15_000 });
    await expect(page.getByText("안녕하세요")).toBeVisible();
  });

  test("unauthenticated user is redirected to /login", async ({ page }) => {
    // Clear any token
    await page.goto("/login");
    await page.evaluate(() => localStorage.removeItem("quiznote_token"));

    await page.goto("/documents");
    // The auth guard should redirect to /login
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("signup with existing email shows error", async ({
    page,
    request,
  }) => {
    const email = uniqueEmail();
    // Create user first
    await request.post(`${API}/api/auth/signup`, {
      data: {
        email,
        display_name: "Existing",
        password: "SecurePass1!",
      },
    });

    await page.goto("/signup");
    await page.fill("#displayName", "Duplicate");
    await page.fill("#email", email);
    await page.fill("#password", "SecurePass1!");
    await page.getByRole("button", { name: "회원가입" }).click();

    // Should show error
    await expect(page.locator("[role=alert], .text-red-600, .text-red-400").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("login with wrong password shows error", async ({
    page,
    request,
  }) => {
    const email = uniqueEmail();
    await request.post(`${API}/api/auth/signup`, {
      data: {
        email,
        display_name: "Wrong PW",
        password: "SecurePass1!",
      },
    });

    await page.goto("/login");
    await page.fill("#email", email);
    await page.fill("#password", "WrongPassword!");
    await page.getByRole("button", { name: "시작하기" }).click();

    await expect(page.locator("[role=alert], .text-red-600, .text-red-400").first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
