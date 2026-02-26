import { test, expect } from "../fixtures/auth.fixture";
import {
  apiUploadDocument,
  apiGenerateQuiz,
} from "../helpers/api-client";

const SAMPLE_TEXT =
  "운영체제는 컴퓨터 하드웨어와 소프트웨어 리소스를 관리하는 시스템 소프트웨어입니다. " +
  "프로세스 관리, 메모리 관리, 파일 시스템, 입출력 관리 등의 기능을 제공합니다. " +
  "대표적인 운영체제로는 Windows, macOS, Linux가 있습니다.";

test.describe("Wrong Notes", () => {
  test("empty state when no wrong notes", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/wrong-notes");

    // Should show empty state message
    await expect(
      page.getByText(/오답노트가|아직 오답노트가|텅 비어/),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("wrong notes appear after quiz with wrong answers", async ({
    authenticatedPage: page,
  }) => {
    const token = await page.evaluate(() =>
      localStorage.getItem("quiznote_token"),
    );
    const doc = await apiUploadDocument(
      page.request,
      token!,
      "Wrong Note Test",
      SAMPLE_TEXT,
    );
    const quiz = await apiGenerateQuiz(page.request, token!, doc.id, 3, [
      "mcq",
    ]);

    // Take quiz and answer wrong (select B instead of A which is correct)
    await page.goto(`/quiz/${quiz.id}`);
    await expect(page.getByText(/Mock Q1/)).toBeVisible({ timeout: 10_000 });

    // Select wrong answer "B" for all questions
    const wrongOptions = page.locator('button:has-text("오답 1")');
    const count = await wrongOptions.count();
    for (let i = 0; i < count; i++) {
      await wrongOptions.nth(i).click();
    }

    // Submit
    const submitBtn = page.getByRole("button", { name: /퀴즈 제출/ });
    await submitBtn.click();

    // Wait for results
    await expect(page.getByText(/퀴즈 결과 분석|점/)).toBeVisible({
      timeout: 15_000,
    });

    // Navigate to wrong notes
    await page.goto("/wrong-notes");

    // Should see wrong note cards
    await expect(page.getByText(/Mock Q/)).toBeVisible({ timeout: 10_000 });
  });
});
