import { test, expect } from "../fixtures/auth.fixture";

test.describe("Settings", () => {
  test("update display name", async ({ authenticatedPage: page }) => {
    await page.goto("/settings");

    // Clear and type new name
    await page.fill("#display_name", "");
    await page.fill("#display_name", "New Display Name");

    // Click save
    await page.getByRole("button", { name: /프로필 저장/ }).click();

    // Wait for success toast
    await expect(page.getByText("프로필이 업데이트되었습니다")).toBeVisible({
      timeout: 10_000,
    });

    // Verify on dashboard
    await page.goto("/");
    await expect(page.getByText("New Display Name")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("password mismatch shows error", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/settings");

    await page.fill("#current_password", "TestPass123!");
    await page.fill("#new_password", "NewPassword1!");
    await page.fill("#confirm_password", "DifferentPassword1!");

    // Error message should appear
    await expect(page.getByText("비밀번호가 일치하지 않습니다")).toBeVisible();
  });

  test("change password", async ({ authenticatedPage: page, testUser }) => {
    await page.goto("/settings");

    await page.fill("#current_password", testUser.password);
    await page.fill("#new_password", "NewSecurePass1!");
    await page.fill("#confirm_password", "NewSecurePass1!");

    await page.getByRole("button", { name: /비밀번호 변경/ }).click();

    await expect(page.getByText("비밀번호가 변경되었습니다")).toBeVisible({
      timeout: 10_000,
    });
  });
});
