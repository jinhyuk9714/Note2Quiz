import { test, expect } from "../fixtures/auth.fixture";
import {
  apiUploadDocument,
  apiGenerateQuiz,
} from "../helpers/api-client";

const SAMPLE_TEXT =
  "운영체제는 컴퓨터 하드웨어와 소프트웨어 리소스를 관리하는 시스템 소프트웨어입니다. " +
  "프로세스 관리, 메모리 관리, 파일 시스템, 입출력 관리 등의 기능을 제공합니다. " +
  "대표적인 운영체제로는 Windows, macOS, Linux가 있습니다.";

async function setupQuiz(page: import("@playwright/test").Page) {
  const token = await page.evaluate(() =>
    localStorage.getItem("quiznote_token"),
  );
  const doc = await apiUploadDocument(
    page.request,
    token!,
    "Quiz Test 문서",
    SAMPLE_TEXT,
  );
  const quiz = await apiGenerateQuiz(page.request, token!, doc.id, 3, [
    "mcq",
  ]);
  return quiz;
}

test.describe("Quiz Taking", () => {
  test("take MCQ quiz and submit", async ({ authenticatedPage: page }) => {
    const quiz = await setupQuiz(page);

    await page.goto(`/quiz/${quiz.id}`);
    await expect(page.getByText(/Mock Q1/)).toBeVisible({ timeout: 10_000 });

    // Answer all MCQ questions by clicking option "A" for each
    const radioButtons = page.locator(
      'button:has-text("정답 선택지"), button:has-text("A")',
    );
    const count = await radioButtons.count();
    for (let i = 0; i < count; i++) {
      await radioButtons.nth(i).click();
    }

    // Click submit
    const submitBtn = page.getByRole("button", { name: /퀴즈 제출/ });
    await submitBtn.click();

    // Wait for results
    await expect(page.getByText(/퀴즈 결과 분석|점/)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("submit with unanswered questions shows confirm", async ({
    authenticatedPage: page,
  }) => {
    const quiz = await setupQuiz(page);

    await page.goto(`/quiz/${quiz.id}`);
    await expect(page.getByText(/Mock Q1/)).toBeVisible({ timeout: 10_000 });

    // Answer only the first question
    const firstOption = page
      .locator('button:has-text("정답 선택지"), button:has-text("A")')
      .first();
    await firstOption.click();

    // Try to submit
    const submitBtn = page.getByRole("button", { name: /퀴즈 제출/ });
    await submitBtn.click();

    // Confirm dialog should appear
    await expect(page.getByText("미답변 문항 있음")).toBeVisible({
      timeout: 5_000,
    });

    // Click confirm
    await page.getByRole("button", { name: "제출" }).click();

    // Wait for results
    await expect(page.getByText(/퀴즈 결과 분석|점/)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("retake clears answers", async ({ authenticatedPage: page }) => {
    const quiz = await setupQuiz(page);

    await page.goto(`/quiz/${quiz.id}`);
    await expect(page.getByText(/Mock Q1/)).toBeVisible({ timeout: 10_000 });

    // Answer all questions
    const radioButtons = page.locator(
      'button:has-text("정답 선택지"), button:has-text("A")',
    );
    const count = await radioButtons.count();
    for (let i = 0; i < count; i++) {
      await radioButtons.nth(i).click();
    }

    // Submit
    await page.getByRole("button", { name: /퀴즈 제출/ }).click();
    await expect(page.getByText(/퀴즈 결과 분석|점/)).toBeVisible({
      timeout: 15_000,
    });

    // Click retake
    await page.getByRole("button", { name: "다시 풀기" }).click();

    // Should be back in taking phase with questions visible
    await expect(page.getByText(/Mock Q1/)).toBeVisible({ timeout: 5_000 });
  });
});
