import { test, expect } from "../fixtures/auth.fixture";

test.describe("Theme Toggle", () => {
  test("toggle between dark and light mode", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/");

    // Find theme toggle button (in sidebar)
    const themeButton = page.locator(
      'button:has([class*="Sun"]), button:has([class*="Moon"]), button[aria-label*="theme"], button[aria-label*="Theme"]',
    );

    // Get initial theme
    const initialClass = await page
      .locator("html")
      .getAttribute("class");
    const isDark = initialClass?.includes("dark") ?? false;

    // Click toggle
    await themeButton.first().click();

    // Wait for class change
    if (isDark) {
      await expect(page.locator("html")).not.toHaveClass(/dark/, {
        timeout: 3_000,
      });
    } else {
      await expect(page.locator("html")).toHaveClass(/dark/, {
        timeout: 3_000,
      });
    }

    // Click toggle again to revert
    await themeButton.first().click();

    if (isDark) {
      await expect(page.locator("html")).toHaveClass(/dark/, {
        timeout: 3_000,
      });
    } else {
      await expect(page.locator("html")).not.toHaveClass(/dark/, {
        timeout: 3_000,
      });
    }
  });
});
