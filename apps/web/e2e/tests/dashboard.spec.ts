import { test, expect } from "../fixtures/auth.fixture";

test.describe("Dashboard", () => {
  test("new user sees empty state", async ({ authenticatedPage: page }) => {
    await page.goto("/");

    // New user with no data should see the onboarding text
    await expect(page.getByText("성장의 첫 걸음을 떼어보세요")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("quick action links navigate correctly", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/");

    // Click "문서 업로드" action card
    await page.getByText("문서 업로드").first().click();
    await expect(page).toHaveURL(/\/documents/, { timeout: 5_000 });

    // Go back and click "AI 퀴즈 생성"
    await page.goto("/");
    await page.getByText("AI 퀴즈 생성").first().click();
    await expect(page).toHaveURL(/\/quiz\/generate/, { timeout: 5_000 });
  });
});
