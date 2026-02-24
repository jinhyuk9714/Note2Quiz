#!/usr/bin/env python3
"""Claude Code Stop hook: run lightweight quality gates on changed areas.

Runs only when you try to stop (end the loop). It looks at recently edited files
tracked by `file_change_tracker.py` and executes:
- Frontend checks (if apps/web changed): lint + typecheck
- Backend checks (if apps/api changed): ruff + pyright (if available)

Behavior:
- If checks fail -> blocks stopping with a short error summary.
- If tools are missing (pnpm/ruff/pyright not installed) -> skips those checks (fail-open),
  but prints a hint in the summary.

You can change fail-open to fail-closed by setting:
  CLAUDE_QG_STRICT=1
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import textwrap
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


MAX_REASON_LINES = 60
MAX_CMD_OUTPUT_CHARS = 10_000


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


def _detect_js_pm(project_dir: Path) -> str:
    # Prefer pnpm if lockfile exists anywhere common
    if (project_dir / "pnpm-lock.yaml").exists() or (project_dir / "pnpm-workspace.yaml").exists():
        return "pnpm"
    if (project_dir / "yarn.lock").exists():
        return "yarn"
    if (project_dir / "package-lock.json").exists():
        return "npm"
    # Fallback: check binaries
    for pm in ("pnpm", "yarn", "npm"):
        if shutil.which(pm):
            return pm
    return "npm"


def _js_run(pm: str, workdir: str, script: str) -> List[str]:
    if pm == "pnpm":
        return ["pnpm", "-C", workdir, script]
    if pm == "yarn":
        return ["yarn", "--cwd", workdir, script]
    # npm
    return ["npm", "--prefix", workdir, "run", script]


def _run_cmd(cmd: List[str], cwd: Path) -> Tuple[int, str]:
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(cwd),
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            check=False,
        )
        out = (proc.stdout or "")
        if len(out) > MAX_CMD_OUTPUT_CHARS:
            out = out[:MAX_CMD_OUTPUT_CHARS] + "\n... (truncated)\n"
        return proc.returncode, out
    except FileNotFoundError:
        return 127, f"Command not found: {cmd[0]}\n"
    except Exception as e:
        return 1, f"Failed to run command: {' '.join(cmd)}\n{e}\n"


def _is_strict_mode() -> bool:
    return os.environ.get("CLAUDE_QG_STRICT") in {"1", "true", "TRUE", "yes", "YES"}


def _categorize(files: List[str]) -> Tuple[bool, bool]:
    web = False
    api = False
    for f in files:
        f_posix = f.replace("\\", "/")
        if f_posix.startswith("apps/web/") or f_posix.startswith("frontend/") or f_posix.startswith("web/"):
            web = True
        if f_posix.startswith("apps/api/") or f_posix.startswith("backend/") or f_posix.startswith("api/"):
            api = True
    return web, api


def _write_log(log_path: Path, content: str) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.write_text(content, encoding="utf-8")


def main() -> int:
    payload = _read_stdin_json()
    session_id = str(payload.get("session_id") or "unknown-session")
    project_dir = _project_dir(payload)
    recent_files = _load_recent_files(project_dir, session_id)
    if not recent_files:
        return 0

    web_changed, api_changed = _categorize(recent_files)
    if not (web_changed or api_changed):
        return 0

    strict = _is_strict_mode()
    checks: List[Tuple[str, List[str], str]] = []  # (area, cmd, label)

    if web_changed:
        pm = _detect_js_pm(project_dir)
        web_dir = "apps/web" if (project_dir / "apps" / "web").exists() else "frontend"
        # Only run if package.json exists
        if (project_dir / web_dir / "package.json").exists():
            checks.append(("frontend", _js_run(pm, web_dir, "lint"), f"{pm} {web_dir}:lint"))
            checks.append(("frontend", _js_run(pm, web_dir, "typecheck"), f"{pm} {web_dir}:typecheck"))
        else:
            if strict:
                checks.append(("frontend", ["__missing__"], f"Missing {web_dir}/package.json (cannot run lint/typecheck)"))

    if api_changed:
        api_dir = "apps/api" if (project_dir / "apps" / "api").exists() else "backend"
        # Try to find tools in venv first, then system PATH
        venv_bin = project_dir / api_dir / ".venv" / "bin"
        venv_ruff = str(venv_bin / "ruff") if (venv_bin / "ruff").exists() else None
        venv_pyright = str(venv_bin / "pyright") if (venv_bin / "pyright").exists() else None

        # Ruff
        ruff_cmd = venv_ruff or shutil.which("ruff")
        if ruff_cmd:
            checks.append(("backend", [ruff_cmd, "check", api_dir], "ruff check"))
            checks.append(("backend", [ruff_cmd, "format", "--check", api_dir], "ruff format --check"))
        else:
            # Try python -m ruff
            py = shutil.which("python") or shutil.which("python3")
            if py:
                checks.append(("backend", [py, "-m", "ruff", "check", api_dir], "python -m ruff check"))
                checks.append(("backend", [py, "-m", "ruff", "format", "--check", api_dir], "python -m ruff format --check"))
            elif strict:
                checks.append(("backend", ["__missing__"], "Missing ruff (install ruff to run checks)"))

        # Pyright — must run from api_dir so it reads pyproject.toml (venv config)
        pyright_cmd = venv_pyright or shutil.which("pyright")
        if pyright_cmd:
            checks.append(("backend", [pyright_cmd, "-p", api_dir], "pyright"))
        else:
            # Some setups use basedpyright
            if shutil.which("basedpyright"):
                checks.append(("backend", ["basedpyright", "-p", api_dir], "basedpyright"))
            elif strict:
                checks.append(("backend", ["__missing__"], "Missing pyright (install pyright to run typecheck)"))

    results: List[Dict[str, Any]] = []
    any_fail = False
    any_ran = False

    for area, cmd, label in checks:
        if cmd and cmd[0] == "__missing__":
            results.append({"area": area, "label": label, "status": "missing"})
            any_fail = any_fail or strict
            continue

        code, out = _run_cmd(cmd, cwd=project_dir)
        status = "ok" if code == 0 else ("missing" if code == 127 else "fail")
        results.append({"area": area, "label": label, "status": status, "code": code, "output": out})
        if status in {"ok", "fail"}:
            any_ran = True
        if status == "fail":
            any_fail = True
        if status == "missing" and strict:
            any_fail = True

    # If nothing actually ran and we're not strict, do nothing.
    if not any_ran and not strict:
        return 0

    # Prepare log and reason
    state_dir = project_dir / ".claude" / "state" / session_id
    log_path = state_dir / "quality_gate.log"

    log_lines: List[str] = []
    log_lines.append(f"Quality gate @ {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
    log_lines.append("Recent files (sample):\n" + "\n".join(recent_files[-10:]) + "\n\n")
    for r in results:
        log_lines.append(f"== {r.get('area')} :: {r.get('label')} :: {r.get('status')} ==\n")
        out = r.get("output") or ""
        if out:
            log_lines.append(out + "\n")
    _write_log(log_path, "".join(log_lines))

    if any_fail:
        summary_lines: List[str] = []
        summary_lines.append("Quality gate failed — fix these before stopping.")
        summary_lines.append(f"Log: {log_path.as_posix()}")
        summary_lines.append("")
        for r in results:
            if r.get("status") == "ok":
                continue
            summary_lines.append(f"- {r.get('label')}: {r.get('status')}")
            out = (r.get("output") or "").strip()
            if out:
                # Keep only first few lines in reason
                lines = out.splitlines()[:10]
                snippet = "\n".join(lines)
                summary_lines.append(textwrap.indent(snippet, "  "))
        reason = "\n".join(summary_lines)
        reason_lines = reason.splitlines()
        if len(reason_lines) > MAX_REASON_LINES:
            reason = "\n".join(reason_lines[:MAX_REASON_LINES]) + "\n... (truncated)\n"

        out_json = {"decision": "block", "reason": reason}
        print(json.dumps(out_json, ensure_ascii=False))
        return 0

    # Passed -> clear edited_files so next stop is fast
    try:
        edited = state_dir / "edited_files.json"
        if edited.exists():
            edited.unlink()
    except Exception:
        pass

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
