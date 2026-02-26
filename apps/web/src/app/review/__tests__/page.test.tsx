import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen, waitFor } from "@/test/test-utils";
import ReviewPage from "../page";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const mockGetDashboardStats = vi.fn();
const mockListWrongNotes = vi.fn();

vi.mock("@/lib/api", () => ({
  getDashboardStats: (...args: unknown[]) => mockGetDashboardStats(...args),
  listWrongNotes: (...args: unknown[]) => mockListWrongNotes(...args),
}));

const EMPTY_STATS = {
  learning_progress: {
    total_quizzes: 0,
    total_questions_answered: 0,
    accuracy_rate: 0,
    total_documents: 0,
  },
  weak_concepts: [],
  review_schedule: {
    overdue_count: 0,
    today_count: 0,
    upcoming: [],
  },
  streak: { current_streak_days: 0, longest_streak_days: 0 },
  mastery_summary: { mastered: 0, learning: 0, new: 0 },
  recent_activity: [],
};

describe("ReviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders heading", async () => {
    mockGetDashboardStats.mockResolvedValue(EMPTY_STATS);
    mockListWrongNotes.mockResolvedValue({ notes: [], total: 0 });

    renderWithProviders(<ReviewPage />);

    await waitFor(() => {
      expect(screen.getByText("복습")).toBeInTheDocument();
    });
  });

  it("renders empty state when no due items", async () => {
    mockGetDashboardStats.mockResolvedValue(EMPTY_STATS);
    mockListWrongNotes.mockResolvedValue({ notes: [], total: 0 });

    renderWithProviders(<ReviewPage />);

    await waitFor(() => {
      expect(
        screen.getByText("모든 복습을 마쳤습니다!"),
      ).toBeInTheDocument();
    });
  });

  it("renders stats cards with counts", async () => {
    mockGetDashboardStats.mockResolvedValue({
      ...EMPTY_STATS,
      review_schedule: {
        overdue_count: 3,
        today_count: 5,
        upcoming: [],
      },
    });
    mockListWrongNotes.mockResolvedValue({ notes: [], total: 8 });

    renderWithProviders(<ReviewPage />);

    await waitFor(() => {
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();
    });
    expect(screen.getByText("기한 지남")).toBeInTheDocument();
    expect(screen.getByText("오늘 복습")).toBeInTheDocument();
  });

  it("shows start button with due count", async () => {
    mockGetDashboardStats.mockResolvedValue(EMPTY_STATS);
    mockListWrongNotes.mockResolvedValue({ notes: [], total: 12 });

    renderWithProviders(<ReviewPage />);

    await waitFor(() => {
      expect(screen.getByText("복습 시작 (12개)")).toBeInTheDocument();
    });
  });

  it("renders concept tag filter pills", async () => {
    mockGetDashboardStats.mockResolvedValue({
      ...EMPTY_STATS,
      weak_concepts: [
        { tag: "미적분", wrong_count: 5, mastered_count: 0, total_count: 5 },
        { tag: "확률", wrong_count: 3, mastered_count: 1, total_count: 4 },
      ],
    });
    mockListWrongNotes.mockResolvedValue({ notes: [], total: 0 });

    renderWithProviders(<ReviewPage />);

    await waitFor(() => {
      expect(screen.getByText("미적분")).toBeInTheDocument();
      expect(screen.getByText("확률")).toBeInTheDocument();
    });
  });
});
