import type { APIRequestContext } from "@playwright/test";

const API = "http://localhost:8000";

export async function apiSignup(
  request: APIRequestContext,
  user: { email: string; password: string; displayName: string },
): Promise<string> {
  const res = await request.post(`${API}/api/auth/signup`, {
    data: {
      email: user.email,
      display_name: user.displayName,
      password: user.password,
    },
  });
  const body = (await res.json()) as { access_token: string };
  return body.access_token;
}

export async function apiUploadDocument(
  request: APIRequestContext,
  token: string,
  title: string,
  text: string,
): Promise<{ id: string; chunk_count: number }> {
  const res = await request.post(`${API}/api/documents/`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: { title, text },
  });
  return (await res.json()) as { id: string; chunk_count: number };
}

export async function apiGenerateQuiz(
  request: APIRequestContext,
  token: string,
  documentId: string,
  nQuestions = 3,
  quizTypes = ["mcq"],
): Promise<{ id: string; item_count: number }> {
  const res = await request.post(`${API}/api/quiz/generate`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    data: {
      document_id: documentId,
      n_questions: nQuestions,
      quiz_types: quizTypes,
    },
  });
  return (await res.json()) as { id: string; item_count: number };
}
