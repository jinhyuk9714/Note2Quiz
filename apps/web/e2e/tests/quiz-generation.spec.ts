import { test, expect } from "../fixtures/auth.fixture";
import { apiUploadDocument } from "../helpers/api-client";

const SAMPLE_TEXT =
  "운영체제는 컴퓨터 하드웨어와 소프트웨어 리소스를 관리하는 시스템 소프트웨어입니다. " +
  "프로세스 관리, 메모리 관리, 파일 시스템, 입출력 관리 등의 기능을 제공합니다. " +
  "대표적인 운영체제로는 Windows, macOS, Linux가 있습니다. " +
  "운영체제의 핵심인 커널은 하드웨어와 직접 상호작용하며, " +
  "사용자 프로그램이 시스템 자원에 안전하게 접근할 수 있도록 합니다.";

test.describe("Quiz Generation", () => {
  test("generate quiz via streaming SSE", async ({
    authenticatedPage: page,
  }) => {
    // Get token from page's localStorage
    const token = await page.evaluate(() =>
      localStorage.getItem("quiznote_token"),
    );

    // Upload a document via API
    const doc = await apiUploadDocument(
      page.request,
      token!,
      "E2E 테스트 문서",
      SAMPLE_TEXT,
    );

    // Navigate to quiz generation with pre-selected document
    await page.goto(`/quiz/generate?document_id=${doc.id}`);

    // Wait for the generate button to appear and click it
    const generateBtn = page.getByRole("button", {
      name: /퀴즈 생성|생성 시작/,
    });
    await expect(generateBtn).toBeVisible({ timeout: 10_000 });
    await generateBtn.click();

    // Wait for the quiz page to load (generation completes and redirects)
    await page.waitForURL(/\/quiz\/[a-f0-9-]+$/, { timeout: 30_000 });

    // Quiz page should show quiz items
    await expect(page.getByText(/Mock Q1/)).toBeVisible({ timeout: 10_000 });
  });
});
