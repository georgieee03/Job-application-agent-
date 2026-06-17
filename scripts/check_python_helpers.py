#!/usr/bin/env python3
"""Smoke-check the repository's Python helper scripts."""

from __future__ import annotations

import py_compile
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
PYTHON_HELPERS = [
    REPO_ROOT / "scripts" / "ashby_api_apply.py",
    REPO_ROOT / "scripts" / "text_resume_to_pdf.py",
]
SHELL_HELPERS = [
    REPO_ROOT / "scripts" / "job_board_fetch.sh",
]


def main() -> int:
    for helper in PYTHON_HELPERS:
        py_compile.compile(str(helper), doraise=True)

    bash = find_bash()
    for helper in SHELL_HELPERS:
        subprocess.run([bash, "-n", str(helper)], check=True)

    with tempfile.TemporaryDirectory(prefix="resume-pdf-smoke-") as tmp:
        tmp_path = Path(tmp)
        resume_text = tmp_path / "resume.txt"
        resume_pdf = tmp_path / "resume.pdf"
        resume_text.write_text(
            "\n".join(
                [
                    "Alex Candidate",
                    "alex@example.com | Phoenix, AZ | R&D <Platform>",
                    "",
                    "# Experience & Impact",
                    "- Built reliable job-application automations for R&D <platform> teams.",
                    "- Improved tracker workflows, validation, and A/B review loops.",
                    "",
                ]
            ),
            encoding="utf8",
        )

        subprocess.run(
            [
                sys.executable,
                str(REPO_ROOT / "scripts" / "text_resume_to_pdf.py"),
                str(resume_text),
                str(resume_pdf),
            ],
            check=True,
            cwd=REPO_ROOT,
        )

        if resume_pdf.read_bytes()[:4] != b"%PDF":
            raise RuntimeError("text_resume_to_pdf.py did not produce a PDF file.")

    print("Python helper checks passed.")
    return 0


def find_bash() -> str:
    candidates: list[Path | str | None] = []

    if sys.platform == "win32":
        for env_name in ("ProgramFiles", "ProgramFiles(x86)"):
            root = os.environ.get(env_name)
            if root:
                candidates.extend([
                    Path(root) / "Git" / "usr" / "bin" / "bash.exe",
                    Path(root) / "Git" / "bin" / "bash.exe",
                ])
        candidates.append(Path("C:/msys64/usr/bin/bash.exe"))

    candidates.append(shutil.which("bash"))

    for candidate in candidates:
        if not candidate:
            continue

        candidate_path = str(candidate)
        if sys.platform == "win32" and candidate_path.lower().endswith("\\system32\\bash.exe"):
            continue

        if Path(candidate_path).exists() or shutil.which(candidate_path):
            return candidate_path

    raise RuntimeError("Unable to find bash. Install Git Bash or add bash to PATH.")


if __name__ == "__main__":
    raise SystemExit(main())
