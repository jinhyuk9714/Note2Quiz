// Backend Pydantic 스키마 미러링

export interface Document {
  id: string;
  title: string;
  source_type: string;
  char_count: number;
  chunk_count: number;
  created_at: string;
}

export interface Chunk {
  id: string;
  index: number;
  content: string;
  token_count: number;
}

export interface DocumentDetail extends Document {
  chunks: Chunk[];
}

export interface QuizItem {
  id: string;
  quiz_type: "mcq" | "short_answer" | "true_false" | "fill_blank";
  question: string;
  correct_answer: string;
  explanation: string;
  options: Record<string, string> | null;
  concept_tags: string[];
  difficulty: number;
}

export interface Quiz {
  id: string;
  title: string;
  item_count: number;
  created_at: string;
  items: QuizItem[];
}

export interface GenerateQuizPayload {
  document_id: string;
  chunk_ids?: string[] | null;
  n_questions: number;
  quiz_types: string[];
}

export interface AnswerItem {
  quiz_item_id: string;
  user_answer: string;
}

export interface AnswerResult {
  quiz_item_id: string;
  user_answer: string;
  correct_answer: string;
  is_correct: boolean;
  explanation: string;
}

export interface SubmitResult {
  attempt_id: string;
  score: number;
  total: number;
  results: AnswerResult[];
  wrong_notes_created: number;
}

export interface WrongNote {
  id: string;
  quiz_item_id: string;
  question: string;
  user_answer: string;
  correct_answer: string;
  wrong_reason: string;
  concept_tags: string[];
  next_review_at: string | null;
  consecutive_correct: number;
  is_mastered: boolean;
  created_at: string;
}

export interface WrongNoteListResponse {
  notes: WrongNote[];
  total: number;
}

// Dashboard
export interface LearningProgressStats {
  total_quizzes_taken: number;
  total_questions_answered: number;
  total_correct: number;
  accuracy_rate: number;
  documents_studied: number;
}

export interface WeakConceptItem {
  tag: string;
  wrong_count: number;
  mastered_count: number;
  total_count: number;
}

export interface ReviewScheduleDay {
  date: string;
  count: number;
}

export interface ReviewScheduleStats {
  overdue_count: number;
  today_count: number;
  upcoming: ReviewScheduleDay[];
}

export interface DashboardStats {
  learning_progress: LearningProgressStats;
  weak_concepts: WeakConceptItem[];
  review_schedule: ReviewScheduleStats;
}
