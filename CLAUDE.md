# Note2Quiz – Project Memory (Claude Code)

## 목표
대학생들이 강의자료/노트 기반으로 **퀴즈 + 오답노트**를 자동 생성하고, 반복 학습(Spaced Repetition)까지 할 수 있는 웹 서비스.

## 기술 스택
- Frontend: Next.js (App Router) + TypeScript **strict**
- Backend: FastAPI + Python **strict typing**
- Code quality: ESLint/TSConfig strict, Ruff + Pyright(또는 MyPy)
- Claude Code 인프라: `.claude/` (hooks + skills + rules)

## 리포 구조(기본 가정)
- `apps/web/` : Next.js
- `apps/api/` : FastAPI

구조가 다르면 `.claude/skills/skill-rules.json`의 `pathPatterns`만 수정.

## 개발 원칙(중요)
### 타입(빡세게)
- Python: 모든 public 함수/메서드에 타입 힌트 필수. `from __future__ import annotations` 사용.
- 반환 타입/Optional/Union 명확히.
- Pydantic 모델은 입력/출력 경계를 명확히(요청/응답 스키마 분리 권장).

### AI 기능 설계(저비용)
- “항상 LLM 호출” 대신 캐시/재사용/증분 업데이트.
- 생성 결과는 **구조화(JSON)** 로 저장 → 재생성/검증/수정 비용 절감.
- 긴 원문을 그대로 저장/노출하지 말고, 필요한 최소 정보만(저작권/개인정보 주의).

### API 설계
- FastAPI 라우터는 기능 단위로 분리 (`/quiz`, `/notes`, `/auth` 등)
- 에러는 HTTPException에 일관된 에러 코드/메시지 스키마를 유지.

## Claude Code 사용 규칙
- 새로운 작업 시작 시: 필요한 skill이 있으면 Skill tool로 먼저 로드.
- 파일을 변경했으면: 가능하면 프론트는 `lint/typecheck`, 백엔드는 `ruff/pyright`를 통과하도록 마무리.
- 위험한 Bash(`rm -rf`, 시스템 파일 삭제/포맷 등)는 훅이 차단할 수 있음(필요하면 사람이 직접 실행).

## 어디에 무엇을 둘까?
- 프론트 UI/페이지/컴포넌트: `apps/web/src/…`
- 백엔드 도메인/서비스 로직: `apps/api/app/…`
- 생성 로직(퀴즈/오답): `apps/api/app/services/quiz_generation.py` 같은 형태 권장
- 프롬프트/템플릿/스키마: `apps/api/app/prompts/` 또는 `apps/api/app/schemas/`

## 시작용 TODO(추천)
1) PDF/텍스트 입력 → 정제 → “학습 단위(Chunk)” 생성
2) Chunk → 문제/정답/해설(JSON) 생성
3) 사용자 정답 제출 → 오답노트(오답 이유/개념 태그/재학습 일정) 생성
4) 대시보드: 진도/취약 개념/복습 스케줄 표시
