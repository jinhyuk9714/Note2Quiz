import type {
  AnswerItem,
  AuthUser,
  DashboardStats,
  Document,
  DocumentDetail,
  GenerateQuizPayload,
  LoginPayload,
  Quiz,
  QuizListItem,
  SignupPayload,
  SubmitResult,
  TokenResponse,
  WrongNote,
  WrongNoteListResponse,
} from "@/types/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TOKEN_KEY = "quiznote_token";

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

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
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
    // Redirect to login on 401 (but not for auth endpoints)
    if (res.status === 401 && !path.startsWith("/api/auth/")) {
      clearToken();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { detail?: string }).detail ?? `HTTP ${res.status}`,
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
  return data;
}

export async function login(payload: LoginPayload): Promise<TokenResponse> {
  const data = await apiFetch<TokenResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  setToken(data.access_token);
  return data;
}

export function getMe(): Promise<AuthUser> {
  return apiFetch<AuthUser>("/api/auth/me");
}

// Multipart form fetch (for file uploads — no Content-Type header; browser sets boundary)
async function apiFormFetch<T>(
  path: string,
  formData: FormData,
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
    if (res.status === 401 && !path.startsWith("/api/auth/")) {
      clearToken();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { detail?: string }).detail ?? `HTTP ${res.status}`,
    );
  }
  return res.json() as Promise<T>;
}

async function apiDelete(path: string): Promise<void> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}${path}`, { method: "DELETE", headers });
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/api/auth/")) {
      clearToken();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { detail?: string }).detail ?? `HTTP ${res.status}`,
    );
  }
}

// Documents
export function listDocuments() {
  return apiFetch<Document[]>("/api/documents/");
}

export function getDocument(id: string) {
  return apiFetch<DocumentDetail>(`/api/documents/${id}`);
}

export function uploadDocument(title: string, text: string) {
  const formData = new FormData();
  formData.append("title", title);
  formData.append("text", text);
  return apiFormFetch<Document>("/api/documents/", formData);
}

export function uploadDocumentFile(title: string, file: File) {
  const formData = new FormData();
  formData.append("title", title);
  formData.append("file", file);
  return apiFormFetch<Document>("/api/documents/", formData);
}

export function deleteDocument(id: string): Promise<void> {
  return apiDelete(`/api/documents/${id}`);
}

// Quiz
export function listQuizzes() {
  return apiFetch<QuizListItem[]>("/api/quiz/");
}
export function generateQuiz(payload: GenerateQuizPayload) {
  return apiFetch<Quiz>("/api/quiz/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getQuiz(id: string) {
  return apiFetch<Quiz>(`/api/quiz/${id}`);
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

// Wrong Notes
export function listWrongNotes(dueOnly = false, limit = 50, offset = 0) {
  return apiFetch<WrongNoteListResponse>(
    `/api/wrong-notes/?due_only=${dueOnly}&limit=${limit}&offset=${offset}`,
  );
}

export function reviewWrongNote(noteId: string, isCorrect: boolean) {
  return apiFetch<WrongNote>(`/api/wrong-notes/${noteId}/review`, {
    method: "POST",
    body: JSON.stringify({ is_correct: isCorrect }),
  });
}

// Dashboard
export function getDashboardStats() {
  return apiFetch<DashboardStats>("/api/dashboard/stats");
}
