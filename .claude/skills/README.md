# Project Skills

- `skill-rules.json` : 어떤 상황에서 어떤 Skill을 추천할지 규칙 정의
- 각 Skill은 `<skill-name>/SKILL.md` 형태

## 이 프로젝트에서 기본 제공하는 Skill
- `nextjs-dev-guidelines`
- `fastapi-dev-guidelines`
- `quiznote-domain`
- `ai-cost-aware-generation`

## 커스터마이징
- 폴더 구조가 다르면 `skill-rules.json`의 `pathPatterns`만 수정하면 됩니다.
- 키워드/정규식은 과하면 오탐이 늘어납니다. “적당히” 유지하세요.
