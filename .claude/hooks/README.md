# Claude Code Hooks (QuizNote AI)

이 폴더는 **Claude Code hooks** 스크립트 모음입니다. (stdlib-only Python)

## 포함된 훅

### 1) UserPromptSubmit → `skill_activation.py`
- 사용자가 프롬프트를 입력할 때 실행
- `.claude/skills/skill-rules.json`을 읽어서 “지금 필요한 Skill”을 추천
- 출력은 `additionalContext`로 주입되어 Claude가 Skill을 먼저 로드하도록 유도

### 2) PostToolUse(Edit|Write) → `file_change_tracker.py`
- Claude가 파일을 수정/생성한 뒤 실행
- 최근 수정 파일 목록을 `.claude/state/<session_id>/edited_files.json`에 저장

### 3) PreToolUse(Bash) → `pretooluse_guard.py`
- `rm -rf`, `curl | bash` 같은 위험 명령을 “자동 차단”
- 필요 시 패턴을 수정하거나 훅을 끄면 됩니다.

### 4) Stop → `quality_gate.py`
- “멈추기(Stop)” 시점에 최근 변경분 기준으로 lint/typecheck 수행
- 실패하면 Stop을 막고(=계속 작업하도록) 실패 요약을 Claude에게 전달
- 기본은 **fail-open**(툴이 없으면 스킵). 엄격 모드로 바꾸려면:
  - `CLAUDE_QG_STRICT=1`

## 훅 끄는 방법
- `.claude/settings.json`에서 해당 이벤트 항목을 제거하거나
- 특정 훅은 env로 끌 수 있음:
  - `CLAUDE_DISABLE_SKILL_HOOK=1`
