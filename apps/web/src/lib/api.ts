import type {
  AnswerItem,
  AttemptDetail,
  AttemptSummary,
  AuthUser,
  ChangePasswordPayload,
  DashboardStats,
  DashboardTrends,
  DeleteAccountPayload,
  Document,
  DocumentDetail,
  DocumentMovePayload,
  FlashcardItem,
  FlashcardQuiz,
  Folder,
  FolderCreatePayload,
  FolderUpdatePayload,
  GenerateQuizPayload,
  ListParams,
  LoginPayload,
  PasswordResetConfirmPayload,
  PasswordResetRequestPayload,
  QuizItemCreatePayload,
  QuizItemUpdatePayload,
  QuizCopyResponse,
  QuizListParams,
  PaginatedResponse,
  Quiz,
  QuizListItem,
  QuizStreamComplete,
  QuizStreamError,
  QuizStreamProgress,
  ShareInfoResponse,
  SharedQuiz,
  SignupPayload,
  SubmitResult,
  TokenResponse,
  UpdateProfilePayload,
  WrongNote,
  WrongNoteListResponse,
} from "@/types/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TOKEN_KEY = "quiznote_token";
const REFRESH_KEY = "quiznote_refresh_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_KEY, token);
}

export function clearRefreshToken(): void {
  localStorage.removeItem(REFRESH_KEY);
}

function clearAllTokens(): void {
  clearToken();
  clearRefreshToken();
}

function redirectToLogin(): void {
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  // Deduplicate concurrent refresh attempts
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const rt = getRefreshToken();
    if (!rt) return false;
    try {
      const res = await fetch(`${BASE}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: rt }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as TokenResponse;
      setToken(data.access_token);
      setRefreshToken(data.refresh_token);
      return true;
    } catch {
      return false;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  _retried = false,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/api/auth/") && !_retried) {
      const refreshed = await tryRefresh();
      if (refreshed) return apiFetch(path, init, true);
      clearAllTokens();
      redirectToLogin();
    }
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      (body as { detail?: string }).detail ?? `HTTP ${res.status}`,
      res.status,
    );
  }
  return res.json() as Promise<T>;
}

// Auth
export async function signup(payload: SignupPayload): Promise<TokenResponse> {
  const data = await apiFetch<TokenResponse>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  setToken(data.access_token);
  setRefreshToken(data.refresh_token);
  return data;
}

export async function login(payload: LoginPayload): Promise<TokenResponse> {
  const data = await apiFetch<TokenResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  setToken(data.access_token);
  setRefreshToken(data.refresh_token);
  return data;
}

export async function logoutApi(): Promise<void> {
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Ignore logout errors
  }
}

export function getMe(): Promise<AuthUser> {
  return apiFetch<AuthUser>("/api/auth/me");
}

export function updateProfile(payload: UpdateProfilePayload): Promise<AuthUser> {
  return apiFetch<AuthUser>("/api/auth/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function changePassword(payload: ChangePasswordPayload): Promise<void> {
  await apiFetch("/api/auth/me/password", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteAccount(payload: DeleteAccountPayload): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api/auth/me`, {
    method: "DELETE",
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      (body as { detail?: string }).detail ?? `HTTP ${res.status}`,
      res.status,
    );
  }
}

export async function forgotPassword(
  payload: PasswordResetRequestPayload,
): Promise<void> {
  await apiFetch("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function resetPassword(
  payload: PasswordResetConfirmPayload,
): Promise<void> {
  await apiFetch("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Multipart form fetch (for file uploads — no Content-Type header; browser sets boundary)
async function apiFormFetch<T>(
  path: string,
  formData: FormData,
  _retried = false,
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/api/auth/") && !_retried) {
      const refreshed = await tryRefresh();
      if (refreshed) return apiFormFetch(path, formData, true);
      clearAllTokens();
      redirectToLogin();
    }
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      (body as { detail?: string }).detail ?? `HTTP ${res.status}`,
      res.status,
    );
  }
  return res.json() as Promise<T>;
}

async function apiDelete(path: string, _retried = false): Promise<void> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}${path}`, { method: "DELETE", headers });
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/api/auth/") && !_retried) {
      const refreshed = await tryRefresh();
      if (refreshed) return apiDelete(path, true);
      clearAllTokens();
      redirectToLogin();
    }
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      (body as { detail?: string }).detail ?? `HTTP ${res.status}`,
      res.status,
    );
  }
}

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );
  if (entries.length === 0) return "";
  return "?" + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

// Folders
export function listFolders(): Promise<Folder[]> {
  return apiFetch<Folder[]>("/api/folders/");
}

export function createFolder(payload: FolderCreatePayload): Promise<Folder> {
  return apiFetch<Folder>("/api/folders/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateFolder(id: string, payload: FolderUpdatePayload): Promise<Folder> {
  return apiFetch<Folder>(`/api/folders/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteFolder(id: string): Promise<void> {
  return apiDelete(`/api/folders/${id}`);
}

export function moveDocumentToFolder(
  documentId: string,
  payload: DocumentMovePayload,
): Promise<Document> {
  return apiFetch<Document>(`/api/documents/${documentId}/folder`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// Documents
export function listDocuments(
  params?: ListParams & { source_type?: string; folder_id?: string },
) {
  const qs = buildQuery({
    limit: params?.limit,
    offset: params?.offset,
    search: params?.search,
    source_type: params?.source_type,
    folder_id: params?.folder_id,
    sort_by: params?.sort_by,
    order: params?.order,
  });
  return apiFetch<PaginatedResponse<Document>>(`/api/documents/${qs}`);
}

export function getDocument(id: string) {
  return apiFetch<DocumentDetail>(`/api/documents/${id}`);
}

export function uploadDocument(title: string, text: string, folderId?: string) {
  const formData = new FormData();
  formData.append("title", title);
  formData.append("text", text);
  if (folderId) formData.append("folder_id", folderId);
  return apiFormFetch<Document>("/api/documents/", formData);
}

export function uploadDocumentFile(title: string, file: File, folderId?: string) {
  const formData = new FormData();
  formData.append("title", title);
  formData.append("file", file);
  if (folderId) formData.append("folder_id", folderId);
  return apiFormFetch<Document>("/api/documents/", formData);
}

export function updateDocument(id: string, data: { title: string }): Promise<Document> {
  return apiFetch<Document>(`/api/documents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteDocument(id: string): Promise<void> {
  return apiDelete(`/api/documents/${id}`);
}

// Quiz
export function listQuizzes(params?: QuizListParams) {
  const qs = buildQuery({
    limit: params?.limit,
    offset: params?.offset,
    search: params?.search,
    document_id: params?.document_id,
    sort_by: params?.sort_by,
    order: params?.order,
    attempt_status: params?.attempt_status,
    score_min: params?.score_min,
    score_max: params?.score_max,
  });
  return apiFetch<PaginatedResponse<QuizListItem>>(`/api/quiz/${qs}`);
}
export function generateQuiz(payload: GenerateQuizPayload) {
  return apiFetch<Quiz>("/api/quiz/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function generateQuizStream(
  payload: GenerateQuizPayload,
  callbacks: {
    onProgress: (data: QuizStreamProgress) => void;
    onComplete: (data: QuizStreamComplete) => void;
    onError: (message: string) => void;
  },
): AbortController {
  const controller = new AbortController();
  const token = getToken();

  void (async () => {
    try {
      const res = await fetch(`${BASE}/api/quiz/generate-stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        if (res.status === 401) {
          clearAllTokens();
          redirectToLogin();
          return;
        }
        const body = (await res.json().catch(() => ({}))) as { detail?: string };
        callbacks.onError(body.detail ?? `HTTP ${res.status}`);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        callbacks.onError("Stream not available");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ") && currentEvent) {
            try {
              const data: unknown = JSON.parse(line.slice(6));
              if (currentEvent === "progress") {
                callbacks.onProgress(data as QuizStreamProgress);
              } else if (currentEvent === "complete") {
                callbacks.onComplete(data as QuizStreamComplete);
              } else if (currentEvent === "error") {
                callbacks.onError((data as QuizStreamError).message);
              }
            } catch {
              // Ignore malformed JSON
            }
            currentEvent = "";
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      callbacks.onError(err instanceof Error ? err.message : "Stream failed");
    }
  })();

  return controller;
}

export function getQuiz(id: string) {
  return apiFetch<Quiz>(`/api/quiz/${id}`);
}

export function getQuizForStudy(id: string) {
  return apiFetch<FlashcardQuiz>(`/api/quiz/${id}/study`);
}

export function submitQuiz(quizId: string, answers: AnswerItem[]) {
  return apiFetch<SubmitResult>(`/api/quiz/${quizId}/submit`, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
}

export function deleteQuiz(id: string): Promise<void> {
  return apiDelete(`/api/quiz/${id}`);
}

export function updateQuiz(id: string, data: { title: string }): Promise<Quiz> {
  return apiFetch<Quiz>(`/api/quiz/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function updateQuizItem(
  quizId: string,
  itemId: string,
  data: QuizItemUpdatePayload,
): Promise<FlashcardItem> {
  return apiFetch<FlashcardItem>(`/api/quiz/${quizId}/items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteQuizItem(quizId: string, itemId: string): Promise<void> {
  return apiDelete(`/api/quiz/${quizId}/items/${itemId}`);
}

export function createQuizItem(
  quizId: string,
  data: QuizItemCreatePayload,
): Promise<FlashcardItem> {
  return apiFetch<FlashcardItem>(`/api/quiz/${quizId}/items`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listQuizAttempts(quizId: string) {
  return apiFetch<AttemptSummary[]>(`/api/quiz/${quizId}/attempts`);
}

export function getAttemptDetail(quizId: string, attemptId: string) {
  return apiFetch<AttemptDetail>(`/api/quiz/${quizId}/attempts/${attemptId}`);
}

// Wrong Notes
export function listWrongNotes(
  params?: {
    due_only?: boolean;
    is_mastered?: boolean;
    limit?: number;
    offset?: number;
    search?: string;
    sort_by?: string;
    order?: string;
    concept_tag?: string;
  },
) {
  const qs = buildQuery({
    due_only: params?.due_only,
    is_mastered: params?.is_mastered,
    limit: params?.limit ?? 50,
    offset: params?.offset ?? 0,
    search: params?.search,
    sort_by: params?.sort_by,
    order: params?.order,
    concept_tag: params?.concept_tag,
  });
  return apiFetch<WrongNoteListResponse>(`/api/wrong-notes/${qs}`);
}

export function reviewWrongNote(noteId: string, quality: 1 | 3 | 5) {
  return apiFetch<WrongNote>(`/api/wrong-notes/${noteId}/review`, {
    method: "POST",
    body: JSON.stringify({ quality }),
  });
}

export function deleteWrongNote(noteId: string): Promise<void> {
  return apiDelete(`/api/wrong-notes/${noteId}`);
}

// Share
export function getShareInfo(quizId: string) {
  return apiFetch<ShareInfoResponse>(`/api/quiz/${quizId}/share`);
}

export function toggleShare(quizId: string, isShared: boolean) {
  return apiFetch<ShareInfoResponse>(`/api/quiz/${quizId}/share`, {
    method: "POST",
    body: JSON.stringify({ is_shared: isShared }),
  });
}

export function regenerateShareCode(quizId: string) {
  return apiFetch<ShareInfoResponse>(`/api/quiz/${quizId}/share/regenerate`, {
    method: "POST",
  });
}

export function getSharedQuiz(shareCode: string) {
  return apiFetch<SharedQuiz>(`/api/share/${shareCode}`);
}

export function submitSharedQuiz(shareCode: string, answers: AnswerItem[]) {
  return apiFetch<SubmitResult>(`/api/share/${shareCode}/submit`, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
}

export function getSharedQuizForStudy(shareCode: string) {
  return apiFetch<FlashcardQuiz>(`/api/share/${shareCode}/study`);
}

export function copySharedQuiz(shareCode: string) {
  return apiFetch<QuizCopyResponse>(`/api/share/${shareCode}/copy`, {
    method: "POST",
  });
}

// Dashboard
export function getDashboardStats() {
  return apiFetch<DashboardStats>("/api/dashboard/stats");
}

export function getDashboardTrends(days = 30) {
  return apiFetch<DashboardTrends>(`/api/dashboard/trends?days=${days}`);
}
