---
name: nextjs-dev-guidelines
description: Next.js(App Router) + TypeScript strict 프론트엔드 개발 가이드
---

# Next.js Dev Guidelines (App Router + TS strict)

## 언제 이 Skill을 쓰나
- `apps/web`에서 페이지/라우트/컴포넌트를 만들거나 리팩토링할 때
- 타입 에러/ESLint 에러를 줄이고 싶을 때
- 서버 컴포넌트/클라이언트 컴포넌트 경계를 정리할 때

## 기본 원칙
- **Server Component 우선**, 필요한 경우에만 `use client`.
- 서버에서 할 수 있는 일(데이터 fetch, 권한 확인)을 최대한 서버에서 처리.
- 프론트 타입은 “추측” 금지: API 응답 타입은 스키마로부터 생성/공유.

## 폴더 추천(예시)
```
apps/web/src/
  app/                # Next.js App Router
  components/         # 공용 컴포넌트
  features/           # 기능 단위 (quiz, notes, auth ...)
  lib/                # api client, utils
```

## 컴포넌트 규칙
- props 타입은 `type` 우선, 복잡하면 `interface`.
- 이벤트 핸들러/비동기 함수는 반환 타입 명시:
```ts
async function onSubmit(): Promise<void> { ... }
```

## 데이터 패칭 패턴(예시)
- API 호출 로직은 `lib/api`에 모으고, UI는 호출만.
- `fetch` 사용 시 `cache`, `revalidate`를 의식적으로 설정(기본값에 의존 X).

## 체크리스트
- [ ] `pnpm -C apps/web lint`
- [ ] `pnpm -C apps/web typecheck`

