---
name: fastapi-dev-guidelines
description: FastAPI + Pydantic + Python strict typing 개발 가이드
---

# FastAPI Dev Guidelines (Python strict typing)

## 언제 이 Skill을 쓰나
- `apps/api`에서 엔드포인트/라우터/서비스 로직 작성 시
- Pydantic 스키마(요청/응답) 설계 시
- Pyright/Ruff에서 타입/스타일 에러를 줄이고 싶을 때

## 구조 추천(예시)
```
apps/api/app/
  main.py
  api/
    router.py
    routes/
      quiz.py
      notes.py
  schemas/            # Pydantic models
  services/           # 비즈니스 로직(LLM 호출 포함)
  repos/              # DB 접근
  core/               # settings, logging, security
```

## 타입/스키마 원칙
- 요청(Request) / 응답(Response) 모델을 분리.
- `Optional`은 진짜로 값이 없을 수 있을 때만.
- `Any` 금지(필요하면 `Protocol`, `TypedDict`, `Literal`로 좁히기).

## 라우터 패턴(예시)
```py
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/quiz", tags=["quiz"])

class QuizRequest(BaseModel):
    text: str

class QuizResponse(BaseModel):
    questions: list[str]

@router.post("/generate", response_model=QuizResponse)
async def generate_quiz(payload: QuizRequest) -> QuizResponse:
    ...
```

## 체크리스트
- [ ] `python -m ruff check apps/api`
- [ ] `python -m pyright apps/api` (또는 `pyright`)
- [ ] (필요 시) `pytest`

