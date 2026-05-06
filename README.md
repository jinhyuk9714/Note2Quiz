# Note2Quiz

> 강의자료 업로드 → AI 퀴즈 생성 → 풀이와 채점 → 오답노트 → SM-2 복습

Note2Quiz는 PDF나 텍스트 강의자료를 업로드하면 학습 단위로 나누고, Claude API를 이용해 퀴즈를 생성한 뒤, 풀이 결과를 오답노트와 반복 학습 일정으로 연결하는 웹 서비스입니다.

## 문제와 방향

강의자료를 읽는 것만으로는 어떤 개념을 이해했는지 확인하기 어렵고, 틀린 문제를 다시 복습하는 흐름도 따로 관리해야 합니다. 이 저장소는 자료 업로드, 퀴즈 생성, 풀이, 오답 분석, 복습 스케줄을 하나의 학습 루프로 묶는 데 초점을 둡니다.

## 주요 기능

- 문서 업로드: 텍스트와 PDF 자료 등록, 폴더 정리
- AI 퀴즈 생성: 객관식, 단답형, O/X, 빈칸 채우기 유형 지원
- 스트리밍 생성: 퀴즈 생성 진행 상황을 SSE로 전달
- 의미 기반 채점: 단답형과 빈칸 답변을 Claude API로 평가
- 오답노트: 틀린 문항, 오답 이유, 개념 태그 저장
- SM-2 복습: `ease_factor`, `interval_days`, `next_review_at` 기반 반복 학습
- 대시보드: 학습 진도, 정답률, 취약 개념, 복습 일정 요약
- 공유: 공유 코드로 퀴즈를 공개하고 다른 사용자가 풀 수 있는 흐름
- 내보내기: 오답노트와 학습 결과 export endpoint 제공

## 아키텍처

```text
Next.js Web
  ↕
FastAPI API
  ├─ PostgreSQL
  ├─ Alembic migration
  ├─ Claude API
  └─ email / reminder script
```

요청 흐름은 `CORS → Request Logging → Security Headers → GZip → Rate Limiting → Route Handler` 순서로 구성되어 있습니다.

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS, TanStack Query, Vitest, Playwright |
| Backend | FastAPI, Python 3.11+, SQLAlchemy 2.0 async, Pydantic v2 |
| AI | Anthropic Claude API |
| Database | PostgreSQL 16, Alembic |
| Infra | Docker Compose, Caddy, Sentry |
| Quality | pytest, ruff, pyright, ESLint, TypeScript |

## 프로젝트 구조

```text
.
├─ apps/
│  ├─ api/
│  │  ├─ app/
│  │  │  ├─ api/routes/      # auth, documents, quiz, wrong_notes, dashboard, share
│  │  │  ├─ models/          # SQLAlchemy 모델
│  │  │  ├─ schemas/         # Pydantic 스키마
│  │  │  ├─ services/        # 문서 처리, 퀴즈 생성, 채점, 복습 로직
│  │  │  └─ prompts/         # 퀴즈 생성과 채점 프롬프트
│  │  └─ alembic/            # DB 마이그레이션
│  └─ web/
│     └─ src/app/            # App Router 페이지
├─ docker-compose.yml
├─ docker-compose.prod.yml
├─ Caddyfile
└─ .env.example
```

## 로컬 실행

### Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

기본 포트:

- Web: `http://localhost:3000`
- API: `http://localhost:8000`
- PostgreSQL: `localhost:5432`

### API 단독 실행

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

### Web 단독 실행

```bash
cd apps/web
npm install
npm run dev
```

## 검증 명령

API:

```bash
cd apps/api
ruff check .
pyright .
pytest
```

Web:

```bash
cd apps/web
npm run lint
npm run typecheck
npm run test:run
npm run test:e2e
```

## 주요 API 그룹

- `auth`: 회원가입, 로그인, 토큰 갱신, 비밀번호 재설정
- `documents`: 문서 업로드, 목록, 상세, 삭제
- `folders`: 문서 폴더 관리
- `quiz`: 퀴즈 생성, 풀이, 이력, 문항 편집
- `wrong_notes`: 오답노트 조회, 복습, 삭제
- `dashboard`: 학습 통계와 복습 일정
- `share`: 공유 퀴즈 조회와 제출
- `export`: 오답노트와 결과 내보내기

## 참고 사항

- `.env.example`에는 운영용 도메인, JWT, Anthropic, 이메일, Sentry 설정 예시가 포함되어 있습니다.
- Claude API 키가 없으면 AI 퀴즈 생성과 의미 기반 채점 흐름은 정상 동작하지 않습니다.
