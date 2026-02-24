# apps/web (Next.js)

권장: Next.js App Router + TypeScript strict로 생성

예시(pnpm):
```bash
pnpm create next-app apps/web --ts --eslint --tailwind --app --src-dir --import-alias "@/*"
```

생성 후:
- `apps/web/package.json`에 `typecheck` 스크립트 추가:
  - `"typecheck": "tsc -p tsconfig.json --noEmit"`
