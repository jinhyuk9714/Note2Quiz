#!/usr/bin/env python3
"""Claude Code PreToolUse hook: block obviously dangerous Bash commands.

This is a *guardrail*, not a complete security solution.
You can customize the patterns in `DANGEROUS_SUBSTRINGS`.
"""

from __future__ import annotations

import json
import re
import sys
from typing import Any, Dict, Optional


DANGEROUS_REGEXES = [
    re.compile(r"\brm\s+-rf\b", re.IGNORECASE),
    re.compile(r"\brm\s+-fr\b", re.IGNORECASE),
    re.compile(r"\bgit\s+clean\s+-[^
]*f[^
]*d\b", re.IGNORECASE),
    re.compile(r"\bmkfs\b", re.IGNORECASE),
    re.compile(r"\bdd\s+if=", re.IGNORECASE),
    re.compile(r"\bshutdown\b", re.IGNORECASE),
    re.compile(r"\breboot\b", re.IGNORECASE),
    # Common supply-chain/prompt-injection pattern
    re.compile(r"\bcurl\b[^\n]*\|\s*(bash|sh)\b", re.IGNORECASE),
    re.compile(r"\bwget\b[^\n]*\|\s*(bash|sh)\b", re.IGNORECASE),
    # Fork bomb
    re.compile(r":\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:\b"),
]


def _read_stdin_json() -> Dict[str, Any]:
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            return {}
        return json.loads(raw)
    except Exception:
        return {}


def _extract_command(payload: Dict[str, Any]) -> Optional[str]:
    tool_input = payload.get("tool_input") or {}
    cmd = tool_input.get("command")
    if isinstance(cmd, str) and cmd.strip():
        return cmd
    return None


def main() -> int:
    payload = _read_stdin_json()
    tool_name = str(payload.get("tool_name") or "")
    if tool_name != "Bash":
        return 0

    command = _extract_command(payload)
    if not command:
        return 0

    for rx in DANGEROUS_REGEXES:
        if rx.search(command):
            decision = {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": (
                        "Blocked potentially destructive Bash command by project guardrail hook.\n"
                        f"Command: {command}\n\n"
                        "If you *really* need to run this, run it manually (outside Claude Code)\n"
                        "or edit `.claude/hooks/pretooluse_guard.py` to allow it."
                    ),
                }
            }
            print(json.dumps(decision, ensure_ascii=False))
            return 0

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
