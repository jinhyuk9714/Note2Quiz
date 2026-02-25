import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useQuizGenerateStream } from "../useQuizGenerateStream";
import type { GenerateQuizPayload } from "@/types/api";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Helper to create a ReadableStream from SSE text chunks
function createSSEStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

function mockFetchResponse(
  stream: ReadableStream<Uint8Array>,
  status = 200,
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "text/event-stream" }),
    body: stream,
    json: () => Promise.resolve({}),
  } as unknown as Response;
}

const PAYLOAD: GenerateQuizPayload = {
  document_id: "doc-1",
  n_questions: 5,
  quiz_types: ["mcq"],
};

describe("useQuizGenerateStream", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockPush.mockClear();
  });

  it("starts in idle state", () => {
    const { result } = renderHook(() => useQuizGenerateStream());
    expect(result.current.state).toEqual({
      status: "idle",
      progress: null,
      errorMessage: null,
    });
  });

  it("transitions to streaming on startGeneration", async () => {
    // Create a stream that never closes (to test intermediate state)
    const stream = new ReadableStream<Uint8Array>({
      start() {
        // never close — simulate ongoing stream
      },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockFetchResponse(stream),
    );

    const { result } = renderHook(() => useQuizGenerateStream());

    act(() => {
      result.current.startGeneration(PAYLOAD);
    });

    expect(result.current.state.status).toBe("streaming");
  });

  it("updates progress on progress events", async () => {
    const sseText = [
      'event: progress\ndata: {"step":"analyzing","current":1,"total":3,"message":"청크 1/3 분석 중..."}\n\n',
      'event: progress\ndata: {"step":"analyzing","current":2,"total":3,"message":"청크 2/3 분석 중..."}\n\n',
      'event: complete\ndata: {"quiz_id":"quiz-123","item_count":5}\n\n',
    ];

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockFetchResponse(createSSEStream(sseText)),
    );

    const { result } = renderHook(() => useQuizGenerateStream());

    await act(async () => {
      result.current.startGeneration(PAYLOAD);
      // Wait for stream to complete
      await new Promise((r) => setTimeout(r, 50));
    });

    // After complete, should navigate
    expect(mockPush).toHaveBeenCalledWith("/quiz/quiz-123");
  });

  it("navigates to quiz page on complete event", async () => {
    const sseText = [
      'event: progress\ndata: {"step":"analyzing","current":1,"total":1,"message":"청크 1/1 분석 중..."}\n\n',
      'event: complete\ndata: {"quiz_id":"abc-456","item_count":3}\n\n',
    ];

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockFetchResponse(createSSEStream(sseText)),
    );

    const { result } = renderHook(() => useQuizGenerateStream());

    await act(async () => {
      result.current.startGeneration(PAYLOAD);
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockPush).toHaveBeenCalledWith("/quiz/abc-456");
    expect(result.current.state.status).toBe("idle");
  });

  it("sets error state on error event", async () => {
    const sseText = [
      'event: error\ndata: {"message":"No chunks found"}\n\n',
    ];

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockFetchResponse(createSSEStream(sseText)),
    );

    const { result } = renderHook(() => useQuizGenerateStream());

    await act(async () => {
      result.current.startGeneration(PAYLOAD);
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.state.status).toBe("error");
    expect(result.current.state.errorMessage).toBe("No chunks found");
  });

  it("sets error state on HTTP error", async () => {
    const stream = createSSEStream([]);
    const response = {
      ok: false,
      status: 500,
      headers: new Headers(),
      body: stream,
      json: () => Promise.resolve({ detail: "Server error" }),
    } as unknown as Response;

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response);

    const { result } = renderHook(() => useQuizGenerateStream());

    await act(async () => {
      result.current.startGeneration(PAYLOAD);
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.current.state.status).toBe("error");
    expect(result.current.state.errorMessage).toBe("Server error");
  });

  it("resets state on cancel", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start() {
        // never close
      },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockFetchResponse(stream),
    );

    const { result } = renderHook(() => useQuizGenerateStream());

    act(() => {
      result.current.startGeneration(PAYLOAD);
    });
    expect(result.current.state.status).toBe("streaming");

    act(() => {
      result.current.cancel();
    });
    expect(result.current.state.status).toBe("idle");
    expect(result.current.state.progress).toBeNull();
  });
});
