# Note2Quiz

> 강의자료 업로드 → AI 퀴즈 자동 생성 → 풀기 → 오답노트 → SM-2 반복 학습

![Next.js](https://img.shields.io/badge/Next.js_16-black?logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![Claude API](https://img.shields.io/badge/Claude_API-CC785C?logo=anthropic&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL_16-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/Python_3.11+-3776AB?logo=python&logoColor=white)

---

## 소개

대학생이 강의자료나 노트를 업로드하면 **AI가 퀴즈를 자동 생성**하고, 틀린 문제를 **오답노트로 정리**한 뒤 **SM-2 알고리즘 기반 간격 반복 학습**까지 지원하는 웹 서비스입니다.

```
문서 업로드 → 청크 분할 → AI 퀴즈 생성 → 풀기 & 채점 → 오답 분석 → 복습 스케줄
```

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **문서 관리** | PDF/텍스트 업로드, OCR 지원, 폴더 정리 |
| **AI 퀴즈 생성** | 4가지 유형 (객관식, 단답형, OX, 빈칸채우기), 청크 단위 스트리밍 생성 |
| **의미 기반 채점** | Claude API로 동의어·오타·약어까지 허용하는 지능형 채점 |
| **오답노트** | 틀린 문제 자동 수집, 오답 이유 분석, 개념 태그 분류 |
| **SM-2 반복 학습** | 간격 반복 알고리즘으로 최적 복습 시점 자동 계산 |
| **대시보드** | 학습 진도, 정답률 추이, 취약 개념, 스트릭, 복습 스케줄 |
| **퀴즈 공유** | 공유 코드로 다른 사용자에게 퀴즈 전달 |
| **내보내기** | 오답노트·퀴즈 결과를 CSV/PDF로 내보내기 |

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| **Frontend** | Next.js 16 (App Router), TypeScript strict, Tailwind CSS, TanStack Query, Recharts, Framer Motion |
| **Backend** | FastAPI, Python 3.11+, SQLAlchemy 2.0 (async), Pydantic v2 |
| **AI** | Claude API — 퀴즈 생성 (Haiku), 의미 채점, OCR |
| **Database** | PostgreSQL 16, Alembic 마이그레이션 (12개) |
| **Infra** | Docker Compose, Caddy (자동 HTTPS), Sentry 모니터링, 구조화 로깅 |
| **Testing** | pytest 489+ 테스트 (유닛/통합/벤치마크), Playwright E2E, Vitest |
| **Resilience** | Circuit Breaker, Rate Limiting, 보안 헤더, GZip 압축 |

---

## 아키텍처

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   Next.js   │────▶│   FastAPI    │────▶│  PostgreSQL  │
│  (Frontend) │◀────│  (Backend)  │◀────│   (Database) │
└─────────────┘     └──────┬──────┘     └──────────────┘
                           │
                    ┌──────▼──────┐
                    │  Claude API │
                    │ (퀴즈 생성,  │
                    │  채점, OCR)  │
                    └─────────────┘
```

**미들웨어 스택** (요청 순서):
```
CORS → Request Logging → Security Headers → GZip → Rate Limiting → Route Handler
```

---

## 프로젝트 구조

```
apps/
├── web/                    # Next.js 프론트엔드
│   └── src/
│       ├── app/            # 페이지 (App Router)
│       ├── components/     # UI 컴포넌트
│       ├── hooks/          # 커스텀 훅
│       ├── lib/            # API 클라이언트, 유틸
│       └── types/          # TypeScript 타입
│
└── api/                    # FastAPI 백엔드
    ├── app/
    │   ├── api/routes/     # 엔드포인트 (auth, quiz, documents, dashboard, ...)
    │   ├── services/       # 비즈니스 로직 (퀴즈 생성, 채점, 오답노트, ...)
    │   ├── models/         # SQLAlchemy 모델
    │   ├── schemas/        # Pydantic 스키마
    │   ├── prompts/        # AI 프롬프트 (퀴즈 생성, 채점)
    │   ├── core/           # 설정, DB, 인증, 미들웨어
    │   └── middleware/     # 로깅, 보안 헤더
    ├── alembic/            # DB 마이그레이션
    └── tests/
        ├── services/       # 서비스 유닛 테스트
        ├── prompts/        # 프롬프트 테스트
        ├── api/            # API 엔드포인트 테스트
        ├── integration/    # 통합 테스트
        └── benchmarks/     # 성능 벤치마크
```

---

## AI 퀴즈 생성 프롬프트 설계

퀴즈 생성의 핵심은 **프롬프트 엔지니어링**입니다. 단순히 "문제 만들어줘"가 아니라, 교육적으로 의미 있는 문제를 안정적으로 생성하기 위한 구조화된 프롬프트를 설계했습니다.

### 생성 파이프라인

```
문서 → 청크 분할 → 문서 프로파일링 → StudyUnit 추출 → 퀴즈 생성 → 검증/필터링 → DB 저장
                        │                   │                │
                  ┌─────▼─────┐       ┌─────▼─────┐   ┌─────▼─────┐
                  │ Claude API │       │ Claude API │   │ Claude API │
                  │ (프로파일링)│       │(학습단위추출)│   │ (퀴즈생성) │
                  └───────────┘       └───────────┘   └───────────┘
```

1. **문서 프로파일링**: 문서 유형(교과서/어휘집/논문 등), 언어, 퀴즈 적합 블록 자동 분류
2. **StudyUnit 추출**: 퀴즈 적합 블록에서 개별 학습 단위(정의/개념/비교/공식 등) 추출
3. **퀴즈 생성**: StudyUnit 기반으로 문맥 있는 퀴즈 생성 (단순 청크 → 퀴즈보다 품질 향상)

- **병렬 처리**: `asyncio.gather()` + 세마포어(동시 3~5개)로 배치 병렬 처리
- **재시도**: 배치별 최대 3회 재시도 (지수 백오프)
- **Circuit Breaker**: 연속 5회 실패 시 60초 차단 → 연쇄 장애 방지
- **OCR 텍스트 정리**: 스캔 PDF의 반복 텍스트 자동 제거
- **잘린 JSON 복구**: max_tokens 초과 시 완성된 항목만 회수

### 프롬프트 구조

프롬프트는 7개 핵심 섹션으로 구성됩니다:

**1. 역할 & 출제 목표**
```
"You are an expert university-level instructional designer and quiz writer."
→ 대학 수준의 교육 전문가 역할 부여
→ 핵심 학습 포인트를 효율적으로 복습할 수 있는 문제 생성에 집중
```

**2. 출제 대상 / 제외 대상**

| 출제 대상 | 제외 대상 |
|-----------|-----------|
| 핵심 정의, 용어 | 표지, 목차, 머리글/바닥글 |
| 개념 간 관계, 메커니즘 | 강의 일정, 과제 안내 |
| 프로세스, 알고리즘 순서 | 참고문헌, URL, 각주 |
| 비교, 구분, 트레이드오프 | OCR 노이즈, 깨진 텍스트 |
| 가정, 예외, 제한사항 | 장식적 일화, 표면적 예시 |

**3. 수식/코드/다이어그램 활용 규칙**

단순 암기가 아닌 **개념적 이해**를 테스트하도록 규칙을 정했습니다:

```
코드 → "이 코드가 무엇을 하는지, 시간복잡도, 엣지 케이스" (줄별 암기 X)
수식 → "각 변수의 의미, 적용 조건, 파라미터 변화의 영향" (수식 복사 X)
표  → "행/열 간의 차이점, 트레이드오프, 패턴" (개별 셀 값 X)
```

**4. 문제 유형별 규칙**

| 유형 | 형식 규칙 |
|------|-----------|
| **객관식 (MCQ)** | A~D 4개 보기, 정답 1개, 그럴듯한 오답 (같은 의미 범주) |
| **단답형** | 간결한 핵심 구문/짧은 문장, 에세이 X |
| **OX (True/False)** | 선언문 형태, 정답은 O 또는 X, 이중부정 금지 |
| **빈칸채우기** | `___` 마커 1개, 핵심 용어/개념을 빈칸으로 |

**5. 난이도 3단계**

| 레벨 | 설명 | 예시 |
|------|------|------|
| 1 | 직접적 정의, 기본 식별 | "OOP에서 캡슐화란?" |
| 2 | 비교, 관계, 기본 응용 | "상속 vs 합성의 차이" |
| 3 | 추론, 예외, 조건부 추론 | "다형성이 실패하는 경우" |

**6. 개념 태그 & 중복 방지**
- 문제당 1~3개 개념 태그 (포커스 개념 우선)
- 이미 출제된 개념 목록(`already_covered_concepts`)을 전달하여 청크 간 중복 방지
- "introduction", "overview" 같은 범용 태그 금지

**7. 언어 매칭**
- 학습자료의 언어를 자동 감지하여 동일 언어로 문제 생성
- 기술 용어는 원어 형태 보존 (정확성 우선)

### 후처리: 검증 & 필터링

LLM 출력은 100% 신뢰할 수 없으므로, `validate_quiz_items()` 함수로 모든 문제를 검증합니다:

```python
# 검증 항목:
# - quiz_type이 허용된 유형인지
# - question, correct_answer, explanation이 비어있지 않은지
# - difficulty가 1/2/3 중 하나인지 (아니면 2로 보정)
# - concept_tags가 1~3개인지
# - MCQ: options에 A/B/C/D 4개 키가 정확히 있는지, 정답이 A~D인지
# - OX: 정답이 O 또는 X인지
# - 빈칸: question에 ___ 마커가 있는지
# → 부적합한 문제는 조용히 제거 (사용자 경험 보호)
```

### 의미 기반 채점 프롬프트

단답형/빈칸 문제는 **정확히 일치하지 않아도** 맞을 수 있어야 합니다:

| 정답 처리 | 오답 처리 |
|-----------|-----------|
| 동의어 (OS = Operating System) | 사실과 다른 답변 |
| 경미한 오타 (photosythesis) | 핵심 부분 누락 |
| 어순 차이 | 구체적 답이 필요한데 모호한 답변 |
| 약어, 조사/관사 차이 | |

---

## 성능 최적화

실제 병목을 측정하고 개선한 6가지 최적화 사례입니다. 각 최적화는 벤치마크 테스트로 전후 비교가 가능합니다.

### 벤치마크 인프라

대규모 테스트 데이터(문서 100개, 퀴즈 200개, 문항 2,000개, 시도 3,000개, 오답노트 1,000개)를 생성하고, `async_benchmark()` 유틸로 N회 반복 측정하여 min/max/mean/median을 비교합니다.

```bash
# 벤치마크 실행
pytest tests/benchmarks/ -v -s -m benchmark
```

### 최적화 1: 대시보드 API 병렬화

대시보드 API는 6개의 독립적인 통계 쿼리를 실행합니다.

| | Before | After |
|---|--------|-------|
| **실행 방식** | 순차 (`await` 6번) | `asyncio.gather()` 병렬 |
| **세션 관리** | 단일 세션 공유 | 쿼리별 독립 세션 |
| **총 latency** | 6개 쿼리 합산 | 가장 느린 쿼리 1개 |
| **예상 개선** | — | **~3-5x 빠름** |

```python
# Before: 순차 실행
learning_progress = await _get_learning_progress(db, user_id)
weak_concepts     = await _get_weak_concepts(db, user_id)
review_schedule   = await _get_review_schedule(db, user_id)
# ... 총 6개

# After: 병렬 실행 (각 쿼리에 독립 세션)
results = await asyncio.gather(
    _run(_get_learning_progress, user_id),
    _run(_get_weak_concepts, user_id),
    _run(_get_review_schedule, user_id),
    # ... 총 6개
)
```

> SQLAlchemy `AsyncSession`은 단일 코루틴에서만 사용 가능하므로, `session_factory`로 각 쿼리에 별도 세션을 생성합니다.

### 최적화 2: 문서 목록 쿼리 통합

| | Before | After |
|---|--------|-------|
| **쿼리 수** | 4개 (count + 문서 + 퀴즈수 + 폴더명) | 2개 (count + JOIN 통합) |
| **방식** | 개별 쿼리 후 Python에서 조합 | `LEFT JOIN` + `GROUP BY` |
| **개선** | — | **쿼리 -50%** |

```python
# After: 단일 쿼리로 문서 + 퀴즈 수 + 폴더명 조회
select(
    Document,
    func.coalesce(func.count(Quiz.id), 0).label("quiz_count"),
    Folder.name.label("folder_name"),
)
.outerjoin(Quiz, Quiz.document_id == Document.id)
.outerjoin(Folder, Folder.id == Document.folder_id)
.group_by(Document.id, Folder.id)
```

### 최적화 3: 퀴즈 목록 CTE + 필터 추출

| | Before | After |
|---|--------|-------|
| **Window Function** | count/data 쿼리에서 2번 계산 | CTE로 1번 계산, 재사용 |
| **필터 코드** | 40줄 중복 (count/data 각각) | 헬퍼 함수 1곳에서 관리 |
| **유지보수성** | 필터 추가 시 2곳 수정 필요 | 1곳만 수정 |

```python
# CTE: 퀴즈별 시도 통계를 1번만 계산
attempt_stats = _build_attempt_stats_cte(user_id)

# 필터 헬퍼: count/data 쿼리 양쪽에 동일 조건 적용
count_q = _apply_quiz_filters(base_count_q, attempt_stats, ...)
data_q  = _apply_quiz_filters(base_data_q,  attempt_stats, ...)
```

### 최적화 4: 오답노트 배치 처리

| | Before | After |
|---|--------|-------|
| **삽입 방식** | 루프 내 `db.add(note)` 개별 호출 | `db.add_all(new_notes)` 배치 |
| **조회 방식** | 항목별 개별 SELECT | `WHERE quiz_item_id IN (...)` 배치 |

### 최적화 5: Export 선택적 컬럼 로딩

| | Before | After |
|---|--------|-------|
| **로딩** | `selectinload(quiz_item)` — 전체 컬럼 | `.load_only(QuizItem.question)` — 필요 컬럼만 |
| **효과** | 불필요한 데이터 전송 | 메모리 사용량 감소 |

### 최적화 6: GZip 응답 압축

| | Before | After |
|---|--------|-------|
| **전송** | JSON 원본 그대로 | GZip 압축 (1KB 이상) |
| **예상 감소** | — | **응답 크기 ~70-80% 감소** |

---

## 시작하기

### 환경 변수

```bash
# .env (apps/api/)
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/note2quiz
JWT_SECRET_KEY=your-secret-key
ANTHROPIC_API_KEY=your-api-key

# .env.local (apps/web/)
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Docker Compose로 실행

```bash
# 개발 환경
docker compose up -d

# 프로덕션
docker compose -f docker-compose.prod.yml up -d
```

### 로컬 개발

```bash
# Backend
cd apps/api
uv sync
alembic upgrade head
uvicorn app.main:app --reload

# Frontend
cd apps/web
pnpm install
pnpm dev
```

---

## 테스트

```bash
# 백엔드 전체 테스트
cd apps/api && pytest tests/ -x

# 성능 벤치마크 (before/after 비교표 출력)
pytest tests/benchmarks/ -v -s -m benchmark

# 코드 품질
ruff check . && pyright

# 프론트엔드
cd apps/web && pnpm test

# E2E
pnpm test:e2e
```

---

## API 엔드포인트

| 그룹 | 주요 엔드포인트 | 설명 |
|------|----------------|------|
| **Auth** | `POST /api/auth/signup, login, refresh` | JWT + Refresh Token 인증 |
| **Documents** | `POST /api/documents/`, `GET /api/documents/` | 문서 업로드/관리 |
| **Quiz** | `POST /api/quiz/generate-stream` | SSE 스트리밍 퀴즈 생성 |
| | `POST /api/quiz/{id}/submit` | 퀴즈 제출 + 채점 |
| **Wrong Notes** | `GET /api/wrong-notes/`, `PATCH /{id}/review` | 오답노트 조회/복습 |
| **Dashboard** | `GET /api/dashboard/stats, trends` | 학습 통계 + 추이 |
| **Export** | `GET /api/export/wrong-notes/csv, pdf` | 내보내기 |
| **Share** | `POST /api/share/{quiz_id}/enable` | 퀴즈 공유 |
