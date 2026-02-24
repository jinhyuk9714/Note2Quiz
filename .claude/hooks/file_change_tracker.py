#!/usr/bin/env python3

"""Claude Code PostToolUse hook: track edited files.

This hook runs after Edit/MultiEdit/Write and records a per-session list of recently
changed files under:

  .claude/state/<session_id>/edited_files.json

It is intentionally dependency-free (stdlib only) and cross-platform.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, TypedDict


class EditedFilesState(TypedDict, total=False):
    files: List[str]
    last_updated: int
    last_tool: str


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


def _extract_file_path(payload: Dict[str, Any]) -> Optional[str]:
    tool_input = payload.get("tool_input") or {}
    tool_resp = payload.get("tool_response") or {}

    # Common keys for file tools
    for k in ("file_path", "path", "filename"):
        v = tool_input.get(k)
        if isinstance(v, str) and v.strip():
            return v

    # Some tools return a filePath in response
    for k in ("filePath", "file_path", "path"):
        v = tool_resp.get(k)
        if isinstance(v, str) and v.strip():
            return v

    return None


def _to_relpath(file_path: str, project_dir: Path) -> str:
    p = Path(file_path).expanduser()
    try:
        rp = p.resolve()
    except Exception:
        rp = p

    try:
        rel = rp.relative_to(project_dir)
        return rel.as_posix()
    except Exception:
        # Not under project dir -> keep as given (posix-like for consistency)
        return rp.as_posix()


def main() -> int:
    payload = _read_stdin_json()
    session_id = str(payload.get("session_id") or "unknown-session")
    tool_name = str(payload.get("tool_name") or "")
    file_path = _extract_file_path(payload)
    if not file_path:
        return 0

    project_dir = _project_dir(payload)
    relpath = _to_relpath(file_path, project_dir)

    state_dir = project_dir / ".claude" / "state" / session_id
    state_dir.mkdir(parents=True, exist_ok=True)
    state_file = state_dir / "edited_files.json"

    state: EditedFilesState = {"files": []}
    if state_file.exists():
        try:
            state = json.loads(state_file.read_text(encoding="utf-8"))
        except Exception:
            state = {"files": []}

    files = list(state.get("files", []))
    # Move to end (most recent)
    if relpath in files:
        files.remove(relpath)
    files.append(relpath)
    # Keep last 80 entries
    files = files[-80:]

    state["files"] = files
    state["last_updated"] = int(time.time())
    if tool_name:
        state["last_tool"] = tool_name

    state_file.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
