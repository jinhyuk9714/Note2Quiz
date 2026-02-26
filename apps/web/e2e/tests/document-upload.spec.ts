import { test, expect } from "../fixtures/auth.fixture";

const SAMPLE_TEXT =
  "운영체제는 컴퓨터 하드웨어와 소프트웨어 리소스를 관리하는 시스템 소프트웨어입니다. " +
  "프로세스 관리, 메모리 관리, 파일 시스템, 입출력 관리 등의 기능을 제공합니다. " +
  "대표적인 운영체제로는 Windows, macOS, Linux가 있습니다. " +
  "운영체제의 핵심인 커널은 하드웨어와 직접 상호작용하며, " +
  "사용자 프로그램이 시스템 자원에 안전하게 접근할 수 있도록 합니다.";

test.describe("Document Upload", () => {
  test("upload text document successfully", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/documents");

    await page.fill("#doc-title", "운영체제 강의 노트");

    // Text mode should be active by default
    await page.fill("#doc-text", SAMPLE_TEXT);

    // Click submit
    await page.getByRole("button", { name: /분석 및 퀴즈 생성하기/ }).click();

    // Wait for success toast
    await expect(page.getByText("업로드 완료!")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("submit button disabled when title is empty", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/documents");

    // Leave title empty, fill text
    await page.fill("#doc-text", SAMPLE_TEXT);

    await expect(
      page.getByRole("button", { name: /분석 및 퀴즈 생성하기/ }),
    ).toBeDisabled();
  });

  test("submit button disabled when text is too short", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/documents");

    await page.fill("#doc-title", "짧은 문서");
    await page.fill("#doc-text", "짧은글");

    await expect(
      page.getByRole("button", { name: /분석 및 퀴즈 생성하기/ }),
    ).toBeDisabled();
  });
});
