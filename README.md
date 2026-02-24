# QuizNote AI – Claude Code Starter (Next.js + FastAPI)

이 저장소는 **Claude Code(클로드 코드)** 를 “제대로” 쓰기 위한 기초 인프라 템플릿입니다.

- Frontend: Next.js (TypeScript strict)
- Backend: FastAPI (Python strict typing)
- Claude Code: skills 자동 추천 + 파일 변경 추적 + (선택) 품질 게이트 훅

## 1) 가장 먼저 할 일

1. 이 템플릿을 프로젝트 루트로 복사
2. Claude Code 실행 (`claude`)
3. 첫 실행 후 `/plugin`에서 아래 플러그인 설치(권장)
   - `typescript-lsp@claude-plugins-official`
   - `pyright-lsp@claude-plugins-official`
   - `security-guidance@claude-plugins-official`
   - `claude-md-management@claude-plugins-official`

> 공식 마켓플레이스(`claude-plugins-official`)는 Claude Code 시작 시 자동으로 사용 가능합니다.  
> `/plugin install plugin-name@claude-plugins-official` 형태로 설치합니다.

## 2) Claude Code 인프라 구조

- `.claude/settings.json` : 훅/권한/플러그인 설정
- `.claude/hooks/` : 훅 스크립트 (Python으로 작성)
- `.claude/skills/` : 프로젝트 스킬(규칙 포함)
- `CLAUDE.md` : Claude가 항상 읽는 “프로젝트 메모리”

## 3) 폴더 구조(권장)

이 템플릿은 아래 구조를 기본 가정합니다. 이미 다른 구조라면 `.claude/skills/skill-rules.json`의 `pathPatterns`만 바꿔도 잘 동작합니다.

```
apps/
  web/   # Next.js
  api/   # FastAPI
```

## 4) 다음 단계

- `apps/web`에 Next.js 생성: `pnpm create next-app apps/web --ts --eslint --tailwind --app`
- `apps/api`에 FastAPI 시작: `uv init` 또는 `python -m venv` 후 `pip install -r ...`

(이 템플릿은 “Claude Code 인프라” 중심이라 앱 보일러플레이트는 최소만 포함합니다.)
