#!/usr/bin/env python3
"""Claude Code UserPromptSubmit hook: auto-suggest relevant Skills.

- Reads `.claude/skills/skill-rules.json`
- Matches based on:
  1) user prompt keywords / intent regex
  2) (optional) recently edited files (from file_change_tracker)

Outputs `additionalContext` so Claude can load the right Skill(s) before responding.
"""

from __future__ import annotations

import fnmatch
import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


PRIORITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, None: 9, "": 9}


def _read_stdin_json() -> Dict[str, Any]:
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            return {}
        return json.loads(raw)
    except Exception:
        return {}


def _project_dir(payload: Dict[str, Any]) -> Path:
    env = os.environ.get("CLAUDE_PROJECT_DIR")
    cwd = payload.get("cwd")
    base = env or cwd or os.getcwd()
    return Path(base).expanduser().resolve()


def _load_skill_rules(project_dir: Path) -> Dict[str, Any]:
    rules_path = project_dir / ".claude" / "skills" / "skill-rules.json"
    if not rules_path.exists():
        return {}
    try:
        return json.loads(rules_path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _load_recent_files(project_dir: Path, session_id: str) -> List[str]:
    state_file = project_dir / ".claude" / "state" / session_id / "edited_files.json"
    if not state_file.exists():
        return []
    try:
        data = json.loads(state_file.read_text(encoding="utf-8"))
        files = data.get("files") or []
        return [str(x) for x in files if isinstance(x, str)]
    except Exception:
        return []


def _match_keywords(prompt_l: str, keywords: List[str]) -> List[str]:
    hits: List[str] = []
    for kw in keywords:
        if not isinstance(kw, str) or not kw.strip():
            continue
        if kw.lower() in prompt_l:
            hits.append(kw)
    return hits


def _match_intents(prompt: str, patterns: List[str]) -> List[str]:
    hits: List[str] = []
    for pat in patterns:
        if not isinstance(pat, str) or not pat.strip():
            continue
        try:
            if re.search(pat, prompt, flags=re.IGNORECASE):
                hits.append(pat)
        except re.error:
            continue
    return hits


def _match_paths(files: List[str], path_patterns: List[str], exclusions: List[str]) -> List[str]:
    hits: List[str] = []
    for f in files:
        f_posix = f.replace("\\", "/")
        # Exclude first
        if any(fnmatch.fnmatch(f_posix, ex) for ex in exclusions):
            continue
        if any(fnmatch.fnmatch(f_posix, pat) for pat in path_patterns):
            hits.append(f)
    return hits


def _priority(skill: Dict[str, Any]) -> int:
    p = skill.get("priority")
    if isinstance(p, str):
        return PRIORITY_ORDER.get(p.lower(), 9)
    return 9


def _enforcement(skill: Dict[str, Any]) -> str:
    e = skill.get("enforcement") or "suggest"
    if not isinstance(e, str):
        return "suggest"
    return e


def _build_context(recos: List[Tuple[str, Dict[str, Any], Dict[str, Any]]]) -> str:
    if not recos:
        return ""

    lines: List[str] = []
    lines.append("[Skill Auto-Activation Suggestions]")
    lines.append("- 아래 Skill들을 먼저 로드하면 답변 품질/일관성이 크게 좋아집니다.")
    lines.append("- Claude Code에서 Skill tool로 `SKILL.md`를 로드한 뒤 작업하세요.")
    lines.append("")

    for name, meta, why in recos:
        enforcement = _enforcement(meta)
        badge = "REQUIRED" if enforcement == "block" else "SUGGESTED"
        desc = meta.get("description") or ""
        lines.append(f"• {name}  ({badge})")
        if desc:
            lines.append(f"  - {desc}")
        kw = why.get("keywords") or []
        intents = why.get("intentPatterns") or []
        paths = why.get("paths") or []
        if kw:
            lines.append(f"  - matched keywords: {', '.join(kw[:6])}{'…' if len(kw) > 6 else ''}")
        if intents:
            lines.append("  - matched intents: " + "; ".join(intents[:2]) + ("…" if len(intents) > 2 else ""))
        if paths:
            sample = ", ".join(paths[:3])
            lines.append(f"  - recent file match: {sample}{'…' if len(paths) > 3 else ''}")
        lines.append("")

    lines.append("If you are about to edit code, load the relevant skill(s) first, then proceed.")
    return "\n".join(lines).strip() + "\n"


def main() -> int:
    # Allow quick disable
    if os.environ.get("CLAUDE_DISABLE_SKILL_HOOK") in {"1", "true", "TRUE", "yes", "YES"}:
        return 0

    payload = _read_stdin_json()
    prompt = str(payload.get("prompt") or "")
    if not prompt.strip():
        return 0

    project_dir = _project_dir(payload)
    rules = _load_skill_rules(project_dir)
    skills = rules.get("skills") if isinstance(rules, dict) else None
    if not isinstance(skills, dict) or not skills:
        return 0

    session_id = str(payload.get("session_id") or "unknown-session")
    recent_files = _load_recent_files(project_dir, session_id)

    prompt_l = prompt.lower()

    recos: List[Tuple[str, Dict[str, Any], Dict[str, Any]]] = []
    for name, meta in skills.items():
        if not isinstance(meta, dict):
            continue

        why: Dict[str, Any] = {}
        prompt_triggers = meta.get("promptTriggers") or {}
        if isinstance(prompt_triggers, dict):
            keywords = prompt_triggers.get("keywords") or []
            intents = prompt_triggers.get("intentPatterns") or []
            if isinstance(keywords, list):
                kw_hits = _match_keywords(prompt_l, [str(k) for k in keywords])
                if kw_hits:
                    why["keywords"] = kw_hits
            if isinstance(intents, list):
                intent_hits = _match_intents(prompt, [str(p) for p in intents])
                if intent_hits:
                    why["intentPatterns"] = intent_hits

        file_triggers = meta.get("fileTriggers") or {}
        if isinstance(file_triggers, dict) and recent_files:
            path_patterns = [str(p) for p in (file_triggers.get("pathPatterns") or []) if p]
            exclusions = [str(p) for p in (file_triggers.get("pathExclusions") or []) if p]
            if path_patterns:
                path_hits = _match_paths(recent_files, path_patterns, exclusions)
                if path_hits:
                    why["paths"] = path_hits

        # If no trigger matched, skip
        if not why:
            continue

        recos.append((str(name), meta, why))

    if not recos:
        return 0

    # Sort by enforcement(block first) then priority then name
    def sort_key(item: Tuple[str, Dict[str, Any], Dict[str, Any]]):
        name, meta, _ = item
        enforcement = _enforcement(meta)
        enforcement_rank = 0 if enforcement == "block" else 1
        return (enforcement_rank, _priority(meta), name)

    recos.sort(key=sort_key)

    additional_context = _build_context(recos)
    if not additional_context.strip():
        return 0

    out = {
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": additional_context,
        }
    }
    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
