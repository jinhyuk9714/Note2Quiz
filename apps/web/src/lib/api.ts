import type {
  AnswerItem,
  Document,
  DocumentDetail,
  GenerateQuizPayload,
  Quiz,
  SubmitResult,
  WrongNote,
  WrongNoteListResponse,
} from "@/types/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { detail?: string }).detail ?? `HTTP ${res.status}`,
    );
  }
  return res.json() as Promise<T>;
}

// Documents
export function listDocuments() {
  return apiFetch<Document[]>("/api/documents/");
}

export function getDocument(id: string) {
  return apiFetch<DocumentDetail>(`/api/documents/${id}`);
}

export function uploadDocument(title: string, text: string) {
  return apiFetch<Document>("/api/documents/", {
    method: "POST",
    body: JSON.stringify({ title, text }),
  });
}

// Quiz
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
